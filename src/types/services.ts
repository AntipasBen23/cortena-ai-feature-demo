// Service Health Status
export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'starting';

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  uptime: string;
  latency: number; // milliseconds
  lastCheck: Date;
  errorRate: number; // percentage
}

// Transaction Types
export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  type: 'debit' | 'credit';
  category: string;
  merchant: string;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  timestamp: Date;
  isAnomaly?: boolean;
  anomalyScore?: number;
  anomalyReason?: string;
}

// Account & Balance
export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'payment_processor';
  balance: number;
  availableBalance: number; // excludes pending
  currency: string;
  lastSync: Date;
  institution: string;
}

// Cash Position
export interface CashPosition {
  totalCash: number;
  availableCash: number;
  pendingInflows: number;
  pendingOutflows: number;
  projectedCash: number; // 7 days out
  lastUpdated: Date;
  accounts: Account[];
}

// Forecast Data
export interface Forecast {
  date: Date;
  predicted: number;
  actual?: number;
  confidence: number; // 0-100
  lower_bound: number;
  upper_bound: number;
}

// Cash Confidence Score
export interface ConfidenceScore {
  score: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  factors: {
    forecastAccuracy: number;
    dataQuality: number;
    transactionVolume: number;
    anomalyRate: number;
  };
  lastCalculated: Date;
}

// Anomaly Detection
export interface Anomaly {
  id: string;
  transaction: Transaction;
  type: 'duplicate' | 'suspicious_amount' | 'unusual_timing' | 'geographic' | 'frequency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: Date;
  resolved: boolean;
}

// Forecast Autopsy (AI Explanation)
export interface ForecastAutopsy {
  period: {
    start: Date;
    end: Date;
  };
  variance: number; // difference between forecast and actual
  variancePercentage: number;
  reasons: {
    category: string;
    impact: number;
    description: string;
    frequency: number;
  }[];
  learnings: string[];
  adjustments: string[];
  generatedAt: Date;
}

// Message Queue Event
export interface QueueEvent {
  id: string;
  topic: string;
  payload: any;
  timestamp: Date;
  processed: boolean;
  serviceSource: string;
  serviceTarget?: string;
}

// Distributed Trace
export interface TraceSpan {
  id: string;
  parentId?: string;
  service: string;
  operation: string;
  startTime: Date;
  duration: number; // milliseconds
  status: 'success' | 'error';
  tags?: Record<string, any>;
}

export interface DistributedTrace {
  traceId: string;
  spans: TraceSpan[];
  totalDuration: number;
  status: 'success' | 'error';
  timestamp: Date;
}

// API Gateway Types
export interface GatewayRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  service: string;
  timestamp: Date;
  userId?: string;
}

export interface GatewayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  latency: number;
  timestamp: Date;
  traceId?: string;
}

// ML Model Metadata
export interface MLModel {
  name: string;
  version: string;
  type: 'forecasting' | 'anomaly_detection' | 'pattern_recognition';
  accuracy: number;
  lastTrained: Date;
  status: 'active' | 'training' | 'deprecated';
  metrics: {
    rmse?: number;
    mae?: number;
    r2?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
  };
}

// Real-time Stream
export interface StreamMessage {
  type: 'transaction' | 'balance_update' | 'anomaly' | 'forecast_update' | 'alert';
  data: any;
  timestamp: Date;
  source: string;
}

// Performance Metrics
export interface PerformanceMetrics {
  service: string;
  requestsPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  timestamp: Date;
}