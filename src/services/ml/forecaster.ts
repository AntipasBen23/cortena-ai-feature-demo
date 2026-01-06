import { Forecast, Anomaly, Transaction, ForecastAutopsy, ConfidenceScore, MLModel } from '@/types/services';
import { eventBus, TOPICS } from '@/lib/eventBus';
import { dataGenerator } from '@/lib/dataGenerator';

/**
 * MLService - Forecasting and anomaly detection
 * Simulates Prophet + anomaly detection models
 */

class MLService {
  private model: MLModel = {
    name: 'Prophet',
    version: '1.2.0',
    type: 'forecasting',
    accuracy: 94.3,
    lastTrained: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    status: 'active',
    metrics: {
      rmse: 2340.5,
      mae: 1890.2,
      r2: 0.943,
    },
  };

  private anomalyModel: MLModel = {
    name: 'Isolation Forest',
    version: '2.1.0',
    type: 'anomaly_detection',
    accuracy: 91.7,
    lastTrained: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    status: 'active',
    metrics: {
      precision: 0.89,
      recall: 0.94,
      f1Score: 0.915,
    },
  };

  /**
   * Generate forecast
   */
  async generateForecast(days: number = 30): Promise<Forecast[]> {
    this.log(`[ML Service] 🔮 Generating ${days}-day forecast...`);

    // Simulate model inference latency
    await this.simulateLatency(120, 180);

    const forecast = dataGenerator.generateForecast(new Date(), days);

    await eventBus.publish(
      TOPICS.FORECAST_UPDATED,
      { forecast, days },
      'MLService'
    );

    this.log(`[ML Service] ✓ Forecast generated (${days} days)`);

    return forecast;
  }

  /**
   * Detect anomalies in transactions
   */
  async detectAnomalies(transactions: Transaction[]): Promise<Anomaly[]> {
    this.log(`[ML Service] 🔍 Scanning ${transactions.length} transactions for anomalies...`);

    await this.simulateLatency(80, 150);

    const anomalies: Anomaly[] = [];

    for (const transaction of transactions) {
      // Simple rule-based detection (simulates ML model)
      const anomalyScore = this.calculateAnomalyScore(transaction);

      if (anomalyScore > 0.7) {
        transaction.isAnomaly = true;
        transaction.anomalyScore = anomalyScore;
        
        const anomaly = dataGenerator.generateAnomaly(transaction);
        anomalies.push(anomaly);

        await eventBus.publish(
          TOPICS.ANOMALY_DETECTED,
          { anomaly },
          'MLService'
        );
      }
    }

    this.log(`[ML Service] ✓ Found ${anomalies.length} anomalies`);

    return anomalies;
  }

  /**
   * Calculate anomaly score
   */
  private calculateAnomalyScore(transaction: Transaction): number {
    let score = 0;

    // Large amounts are suspicious
    if (transaction.amount > 10000) score += 0.3;
    if (transaction.amount > 20000) score += 0.3;

    // Unusual timing
    const hour = transaction.timestamp.getHours();
    if (hour < 6 || hour > 20) score += 0.2;

    // Weekend transactions
    const day = transaction.timestamp.getDay();
    if (day === 0 || day === 6) score += 0.15;

    // Unknown merchants
    if (transaction.merchant.includes('Unknown')) score += 0.25;

    return Math.min(score, 1);
  }

  /**
   * Generate forecast autopsy (AI explanation)
   */
  async generateAutopsy(
    actualVariance: number,
    forecastData: Forecast[]
  ): Promise<ForecastAutopsy> {
    this.log(`[ML Service] 🔬 Analyzing forecast variance: $${actualVariance.toLocaleString()}...`);

    // Simulate GPT/Claude API call
    await this.simulateLatency(200, 400);

    const variance = dataGenerator.generateForecastVariance(actualVariance);

    const autopsy: ForecastAutopsy = {
      period: {
        start: forecastData[0].date,
        end: forecastData[forecastData.length - 1].date,
      },
      variance: actualVariance,
      variancePercentage: (actualVariance / 250000) * 100,
      reasons: variance.reasons,
      learnings: variance.learnings,
      adjustments: variance.adjustments,
      generatedAt: new Date(),
    };

    await eventBus.publish(
      TOPICS.FORECAST_VARIANCE,
      { autopsy },
      'MLService'
    );

    this.log(`[ML Service] ✓ Autopsy complete - ${variance.reasons.length} root causes identified`);

    return autopsy;
  }

  /**
   * Calculate cash confidence score
   */
  calculateConfidenceScore(forecast: Forecast[]): ConfidenceScore {
    // Calculate based on forecast accuracy
    const forecastAccuracy = this.model.accuracy;
    
    // Data quality (how recent is our data)
    const dataAge = Date.now() - this.model.lastTrained.getTime();
    const dataQuality = Math.max(70, 100 - (dataAge / (24 * 60 * 60 * 1000)) * 2);

    // Transaction volume (more data = better predictions)
    const transactionVolume = 88; // Mock value

    // Anomaly rate (lower = better)
    const anomalyRate = 98; // Mock value (high = low anomalies)

    const score = Math.round(
      forecastAccuracy * 0.4 +
      dataQuality * 0.3 +
      transactionVolume * 0.2 +
      anomalyRate * 0.1
    );

    let trend: 'improving' | 'stable' | 'declining';
    if (score > 90) trend = 'improving';
    else if (score > 75) trend = 'stable';
    else trend = 'declining';

    return {
      score,
      trend,
      factors: {
        forecastAccuracy,
        dataQuality: Math.round(dataQuality),
        transactionVolume,
        anomalyRate,
      },
      lastCalculated: new Date(),
    };
  }

  /**
   * Get model info
   */
  getModelInfo(type: 'forecasting' | 'anomaly_detection'): MLModel {
    return type === 'forecasting' ? this.model : this.anomalyModel;
  }

  /**
   * Simulate model latency
   */
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Structured logging
   */
  private log(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`%c${message}`, 'color: #8b5cf6; font-weight: bold;');
    }
  }
}

// Singleton instance
export const mlService = new MLService();

// Export convenience functions
export async function generateForecast(days: number = 30): Promise<Forecast[]> {
  return mlService.generateForecast(days);
}

export async function detectAnomalies(transactions: Transaction[]): Promise<Anomaly[]> {
  return mlService.detectAnomalies(transactions);
}

export async function generateForecastAutopsy(
  variance: number,
  forecast: Forecast[]
): Promise<ForecastAutopsy> {
  return mlService.generateAutopsy(variance, forecast);
}

export function calculateConfidenceScore(forecast: Forecast[]): ConfidenceScore {
  return mlService.calculateConfidenceScore(forecast);
}