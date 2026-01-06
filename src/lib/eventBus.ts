import { QueueEvent, StreamMessage } from '@/types/services';

/**
 * EventBus - Simulates a message queue (RabbitMQ/Kafka)
 * Enables pub/sub pattern and async communication between "microservices"
 */

type EventCallback = (data: any) => void;
type EventTopic = string;

interface Subscription {
  id: string;
  topic: EventTopic;
  callback: EventCallback;
  serviceSource?: string;
}

interface QueueMetrics {
  totalPublished: number;
  totalConsumed: number;
  currentDepth: number;
  avgLatency: number;
  throughput: number; // messages per second
}

class EventBus {
  private subscribers: Map<EventTopic, Subscription[]> = new Map();
  private messageQueue: QueueEvent[] = [];
  private metrics: QueueMetrics = {
    totalPublished: 0,
    totalConsumed: 0,
    currentDepth: 0,
    avgLatency: 0,
    throughput: 0,
  };
  private latencies: number[] = [];
  private throughputInterval: NodeJS.Timeout | null = null;
  private messagesInLastSecond: number = 0;

  constructor() {
    // Start throughput calculation
    this.startThroughputCalculation();
  }

  /**
   * Subscribe to a topic (like Kafka consumer)
   */
  subscribe(topic: EventTopic, callback: EventCallback, serviceSource?: string): string {
    const subscriptionId = this.generateId();
    const subscription: Subscription = {
      id: subscriptionId,
      topic,
      callback,
      serviceSource,
    };

    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, []);
    }

    this.subscribers.get(topic)!.push(subscription);

    // Log subscription (like Kafka consumer group joining)
    this.log(`[MessageQueue] Subscriber ${serviceSource || 'unknown'} joined topic: ${topic}`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(subscriptionId: string): void {
    for (const [topic, subs] of this.subscribers.entries()) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        this.log(`[MessageQueue] Subscription ${subscriptionId} removed from topic: ${topic}`);
        if (subs.length === 0) {
          this.subscribers.delete(topic);
        }
        break;
      }
    }
  }

  /**
   * Publish message to a topic (like Kafka producer)
   */
  async publish(
    topic: EventTopic,
    payload: any,
    serviceSource: string = 'unknown',
    serviceTarget?: string
  ): Promise<void> {
    const startTime = Date.now();

    const event: QueueEvent = {
      id: this.generateId(),
      topic,
      payload,
      timestamp: new Date(),
      processed: false,
      serviceSource,
      serviceTarget,
    };

    // Add to queue
    this.messageQueue.push(event);
    this.metrics.totalPublished++;
    this.metrics.currentDepth = this.messageQueue.length;
    this.messagesInLastSecond++;

    // Log publish
    this.log(
      `[MessageQueue] Published to ${topic} from ${serviceSource}${
        serviceTarget ? ` → ${serviceTarget}` : ''
      }`
    );

    // Simulate network latency (1-15ms for message queue)
    await this.simulateLatency(1, 15);

    // Process message (deliver to subscribers)
    await this.processMessage(event);

    // Calculate latency
    const latency = Date.now() - startTime;
    this.latencies.push(latency);
    if (this.latencies.length > 100) {
      this.latencies.shift(); // Keep last 100 latencies
    }
    this.updateAvgLatency();
  }

  /**
   * Process message and deliver to subscribers
   */
  private async processMessage(event: QueueEvent): Promise<void> {
    const subscribers = this.subscribers.get(event.topic) || [];

    if (subscribers.length === 0) {
      this.log(`[MessageQueue] ⚠️  No subscribers for topic: ${event.topic}`);
      return;
    }

    // Deliver to all subscribers (pub/sub pattern)
    for (const subscriber of subscribers) {
      try {
        // Simulate async delivery
        await this.simulateLatency(0, 5);
        subscriber.callback(event.payload);
        this.metrics.totalConsumed++;
      } catch (error) {
        this.log(`[MessageQueue] ❌ Error delivering to subscriber: ${error}`);
      }
    }

    // Mark as processed
    event.processed = true;
    this.messageQueue = this.messageQueue.filter((e) => e.id !== event.id);
    this.metrics.currentDepth = this.messageQueue.length;
  }

  /**
   * Get queue metrics (for monitoring dashboard)
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current queue depth by topic
   */
  getQueueDepthByTopic(): Record<string, number> {
    const depthMap: Record<string, number> = {};
    for (const event of this.messageQueue) {
      depthMap[event.topic] = (depthMap[event.topic] || 0) + 1;
    }
    return depthMap;
  }

  /**
   * Get subscriber count by topic
   */
  getSubscriberCount(): Record<string, number> {
    const countMap: Record<string, number> = {};
    for (const [topic, subs] of this.subscribers.entries()) {
      countMap[topic] = subs.length;
    }
    return countMap;
  }

  /**
   * Clear all events (for demo reset)
   */
  clear(): void {
    this.messageQueue = [];
    this.metrics.currentDepth = 0;
    this.log('[MessageQueue] Queue cleared');
  }

  /**
   * Simulate network latency
   */
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
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
   * Calculate throughput (messages per second)
   */
  private startThroughputCalculation(): void {
    this.throughputInterval = setInterval(() => {
      this.metrics.throughput = this.messagesInLastSecond;
      this.messagesInLastSecond = 0;
    }, 1000);
  }

  /**
   * Stop throughput calculation (cleanup)
   */
  destroy(): void {
    if (this.throughputInterval) {
      clearInterval(this.throughputInterval);
      this.throughputInterval = null;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log to console (structured logging)
   */
  private log(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`%c${message}`, 'color: #10b981; font-weight: bold;');
    }
  }
}

// Singleton instance (like a real message queue)
export const eventBus = new EventBus();

// Topic constants (like Kafka topics)
export const TOPICS = {
  // Transaction topics
  TRANSACTION_NEW: 'transactions.new',
  TRANSACTION_PROCESSED: 'transactions.processed',
  TRANSACTION_FAILED: 'transactions.failed',

  // Reconciliation topics
  RECONCILIATION_START: 'reconciliation.start',
  RECONCILIATION_COMPLETE: 'reconciliation.complete',
  RECONCILIATION_MISMATCH: 'reconciliation.mismatch',

  // Anomaly topics
  ANOMALY_DETECTED: 'alerts.anomaly',
  ANOMALY_RESOLVED: 'alerts.resolved',
  ANOMALY_HIGH_PRIORITY: 'alerts.high',

  // Forecast topics
  FORECAST_UPDATED: 'forecast.updated',
  FORECAST_VARIANCE: 'forecast.variance',

  // Balance topics
  BALANCE_UPDATED: 'balance.updated',
  BALANCE_LOW: 'balance.low',

  // System topics
  SYSTEM_HEALTH: 'system.health',
  SYSTEM_ERROR: 'system.error',

  // ML topics
  ML_PREDICTION: 'ml.prediction',
  ML_TRAINING_COMPLETE: 'ml.training.complete',
} as const;

// Helper function to create typed publishers
export function createPublisher<T>(topic: string, serviceSource: string) {
  return async (payload: T, serviceTarget?: string) => {
    await eventBus.publish(topic, payload, serviceSource, serviceTarget);
  };
}

// Helper function to create typed subscribers
export function createSubscriber<T>(
  topic: string,
  callback: (data: T) => void,
  serviceSource?: string
): string {
  return eventBus.subscribe(topic, callback, serviceSource);
}

// Export types
export type { EventCallback, EventTopic, Subscription, QueueMetrics };