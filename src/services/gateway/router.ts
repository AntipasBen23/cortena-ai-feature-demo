import { GatewayRequest, GatewayResponse, DistributedTrace, TraceSpan, ServiceHealth } from '@/types/services';
import { eventBus, TOPICS } from '@/lib/eventBus';

/**
 * APIGateway - Routes requests to appropriate microservices
 * Simulates Kong/NGINX/AWS API Gateway functionality
 */

interface RouteConfig {
  path: string;
  service: string;
  method: string[];
  requiresAuth?: boolean;
  rateLimit?: number; // requests per minute
}

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

class APIGateway {
  private routes: RouteConfig[] = [];
  private activeRequests = new Map<string, GatewayRequest>();
  private requestHistory: GatewayRequest[] = [];
  private rateLimitMap = new Map<string, RateLimitEntry>();
  private traces = new Map<string, DistributedTrace>();
  
  // Service registry (simulates service discovery)
  private serviceRegistry = new Map<string, ServiceHealth>([
    ['gateway', { 
      name: 'API Gateway', 
      status: 'healthy', 
      uptime: '99.98%', 
      latency: 12, 
      lastCheck: new Date(),
      errorRate: 0.02 
    }],
    ['transactions', { 
      name: 'Transaction Service', 
      status: 'healthy', 
      uptime: '99.95%', 
      latency: 45, 
      lastCheck: new Date(),
      errorRate: 0.15 
    }],
    ['ml', { 
      name: 'ML Service', 
      status: 'healthy', 
      uptime: '99.12%', 
      latency: 156, 
      lastCheck: new Date(),
      errorRate: 0.45 
    }],
    ['reconciliation', { 
      name: 'Reconciliation Service', 
      status: 'healthy', 
      uptime: '99.89%', 
      latency: 78, 
      lastCheck: new Date(),
      errorRate: 0.08 
    }],
  ]);

  // Metrics
  private metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgLatency: 0,
    requestsPerSecond: 0,
  };

  private latencies: number[] = [];
  private requestsInLastSecond = 0;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeRoutes();
    this.startMetricsCollection();
  }

  /**
   * Initialize route configurations
   */
  private initializeRoutes(): void {
    this.routes = [
      // Transaction routes
      { path: '/api/transactions', service: 'transactions', method: ['GET', 'POST'], rateLimit: 100 },
      { path: '/api/transactions/:id', service: 'transactions', method: ['GET', 'PUT', 'DELETE'], rateLimit: 100 },
      
      // Account routes
      { path: '/api/accounts', service: 'transactions', method: ['GET'], rateLimit: 60 },
      { path: '/api/accounts/:id/balance', service: 'transactions', method: ['GET'], rateLimit: 120 },
      
      // Reconciliation routes
      { path: '/api/reconciliation', service: 'reconciliation', method: ['POST'], rateLimit: 30 },
      { path: '/api/reconciliation/status', service: 'reconciliation', method: ['GET'], rateLimit: 60 },
      
      // ML/Forecast routes
      { path: '/api/forecast', service: 'ml', method: ['GET', 'POST'], rateLimit: 20 },
      { path: '/api/anomalies', service: 'ml', method: ['GET'], rateLimit: 60 },
      { path: '/api/forecast/autopsy', service: 'ml', method: ['POST'], rateLimit: 10 },
      
      // Cash position routes
      { path: '/api/cash/position', service: 'transactions', method: ['GET'], rateLimit: 120 },
      { path: '/api/cash/confidence', service: 'ml', method: ['GET'], rateLimit: 60 },
    ];

    this.log('[Gateway] 📋 Registered ' + this.routes.length + ' routes');
  }

  /**
   * Route a request to appropriate service
   */
  async route<T = any>(
    method: string,
    path: string,
    data?: any,
    userId?: string
  ): Promise<GatewayResponse<T>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    const traceId = this.generateTraceId();

    // Create request record
    const request: GatewayRequest = {
      id: requestId,
      method: method as any,
      path,
      service: '',
      timestamp: new Date(),
      userId,
    };

    this.activeRequests.set(requestId, request);
    this.metrics.totalRequests++;
    this.requestsInLastSecond++;

    // Log incoming request
    this.log(`[Gateway] ← ${method} ${path} (${requestId})`);

    try {
      // Find matching route
      const route = this.findRoute(method, path);
      if (!route) {
        throw new Error(`Route not found: ${method} ${path}`);
      }

      request.service = route.service;

      // Check rate limit
      if (route.rateLimit) {
        const allowed = this.checkRateLimit(userId || 'anonymous', route.rateLimit);
        if (!allowed) {
          throw new Error('Rate limit exceeded');
        }
      }

      // Start distributed trace
      const trace = this.startTrace(traceId, requestId, method, path);

      // Add gateway span
      const gatewaySpan = this.addSpan(trace, {
        service: 'gateway',
        operation: 'route_request',
        parentId: undefined,
      });

      // Simulate gateway processing
      await this.simulateLatency(8, 15);

      // Publish routing event
      await eventBus.publish(
        TOPICS.SYSTEM_HEALTH,
        { type: 'request_routed', service: route.service, path, method },
        'Gateway',
        route.service
      );

      // Route to service (simulated - in real app would call actual service)
      const serviceSpan = this.addSpan(trace, {
        service: route.service,
        operation: `${method.toLowerCase()}_${path.split('/').pop()}`,
        parentId: gatewaySpan.id,
      });

      // Simulate service processing
      const serviceLatency = this.getServiceLatency(route.service);
      await this.simulateLatency(serviceLatency * 0.8, serviceLatency * 1.2);

      // Complete spans
      this.completeSpan(gatewaySpan, 'success');
      this.completeSpan(serviceSpan, 'success');

      // Calculate total latency
      const latency = Date.now() - startTime;
      this.latencies.push(latency);
      if (this.latencies.length > 100) this.latencies.shift();
      this.updateAvgLatency();

      // Complete trace
      this.completeTrace(trace);

      // Remove from active requests
      this.activeRequests.delete(requestId);
      this.requestHistory.push(request);
      if (this.requestHistory.length > 100) this.requestHistory.shift();

      this.metrics.successfulRequests++;

      // Log success
      this.log(`[Gateway] ✓ ${method} ${path} → ${route.service} (${latency}ms)`);

      // Return successful response
      return {
        success: true,
        data: data as T, // In real app, this would be service response
        latency,
        timestamp: new Date(),
        traceId,
      };

    } catch (error) {
      this.metrics.failedRequests++;
      const latency = Date.now() - startTime;

      this.log(`[Gateway] ✗ ${method} ${path} - ${error}`);

      // Publish error event
      await eventBus.publish(
        TOPICS.SYSTEM_ERROR,
        { type: 'request_failed', error: String(error), path, method },
        'Gateway'
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        latency,
        timestamp: new Date(),
        traceId,
      };
    }
  }

  /**
   * Find matching route
   */
  private findRoute(method: string, path: string): RouteConfig | null {
    // Simple matching (in production would use path-to-regexp)
    for (const route of this.routes) {
      const pathMatch = this.matchPath(route.path, path);
      const methodMatch = route.method.includes(method.toUpperCase());
      
      if (pathMatch && methodMatch) {
        return route;
      }
    }
    return null;
  }

  /**
   * Simple path matching
   */
  private matchPath(routePath: string, requestPath: string): boolean {
    const routeParts = routePath.split('/').filter(Boolean);
    const requestParts = requestPath.split('/').filter(Boolean);

    if (routeParts.length !== requestParts.length) return false;

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) continue; // Param placeholder
      if (routeParts[i] !== requestParts[i]) return false;
    }

    return true;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(userId: string, limit: number): boolean {
    const key = `${userId}`;
    const now = new Date();
    const entry = this.rateLimitMap.get(key);

    if (!entry || entry.resetAt < now) {
      // Create new entry
      this.rateLimitMap.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + 60000), // 1 minute
      });
      return true;
    }

    if (entry.count >= limit) {
      this.log(`[Gateway] ⚠️  Rate limit exceeded for ${userId}`);
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Start distributed trace
   */
  private startTrace(traceId: string, requestId: string, method: string, path: string): DistributedTrace {
    const trace: DistributedTrace = {
      traceId,
      spans: [],
      totalDuration: 0,
      status: 'success',
      timestamp: new Date(),
    };

    this.traces.set(traceId, trace);
    return trace;
  }

  /**
   * Add span to trace
   */
  private addSpan(trace: DistributedTrace, config: {
    service: string;
    operation: string;
    parentId?: string;
  }): TraceSpan {
    const span: TraceSpan = {
      id: this.generateSpanId(),
      parentId: config.parentId,
      service: config.service,
      operation: config.operation,
      startTime: new Date(),
      duration: 0,
      status: 'success',
    };

    trace.spans.push(span);
    return span;
  }

  /**
   * Complete span
   */
  private completeSpan(span: TraceSpan, status: 'success' | 'error'): void {
    span.duration = Date.now() - span.startTime.getTime();
    span.status = status;
  }

  /**
   * Complete trace
   */
  private completeTrace(trace: DistributedTrace): void {
    trace.totalDuration = trace.spans.reduce((sum, span) => sum + span.duration, 0);
    trace.status = trace.spans.every(s => s.status === 'success') ? 'success' : 'error';
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): DistributedTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all recent traces
   */
  getRecentTraces(limit: number = 20): DistributedTrace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get service health
   */
  getServiceHealth(serviceName?: string): ServiceHealth | ServiceHealth[] {
    if (serviceName) {
      return this.serviceRegistry.get(serviceName)!;
    }
    return Array.from(this.serviceRegistry.values());
  }

  /**
   * Get gateway metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeRequests: this.activeRequests.size,
      rateLimitedRequests: 0, // Would track separately in production
    };
  }

  /**
   * Get service latency from registry
   */
  private getServiceLatency(service: string): number {
    const health = this.serviceRegistry.get(service);
    return health?.latency || 50;
  }

  /**
   * Update average latency
   */
  private updateAvgLatency(): void {
    if (this.latencies.length === 0) return;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.metrics.avgLatency = Math.round(sum / this.latencies.length);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.metrics.requestsPerSecond = this.requestsInLastSecond;
      this.requestsInLastSecond = 0;

      // Randomly update service health (simulate real monitoring)
      for (const [name, health] of this.serviceRegistry.entries()) {
        if (Math.random() < 0.1) { // 10% chance to update
          health.latency = Math.round(health.latency + (Math.random() - 0.5) * 10);
          health.errorRate = Math.max(0, health.errorRate + (Math.random() - 0.5) * 0.1);
          health.lastCheck = new Date();
        }
      }
    }, 1000);
  }

  /**
   * Simulate network latency
   */
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate span ID
   */
  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  /**
   * Structured logging
   */
  private log(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`%c${message}`, 'color: #3b82f6; font-weight: bold;');
    }
  }
}

// Singleton instance
export const apiGateway = new APIGateway();

// Export convenience functions
export async function get<T>(path: string, userId?: string): Promise<GatewayResponse<T>> {
  return apiGateway.route<T>('GET', path, undefined, userId);
}

export async function post<T>(path: string, data: any, userId?: string): Promise<GatewayResponse<T>> {
  return apiGateway.route<T>('POST', path, data, userId);
}

export async function put<T>(path: string, data: any, userId?: string): Promise<GatewayResponse<T>> {
  return apiGateway.route<T>('PUT', path, data, userId);
}

export async function del<T>(path: string, userId?: string): Promise<GatewayResponse<T>> {
  return apiGateway.route<T>('DELETE', path, undefined, userId);
}