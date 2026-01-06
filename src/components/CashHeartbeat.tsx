'use client';

import { useEffect, useState } from 'react';
import { 
  CashPosition, 
  Anomaly, 
  Forecast, 
  ConfidenceScore,
  ServiceHealth,
  QueueMetrics 
} from '@/types/services';
import { eventBus, TOPICS } from '@/lib/eventBus';
import { transactionProcessor } from '@/services/transactions/processor';
import { mlService, generateForecast, calculateConfidenceScore } from '@/services/ml/forecaster';
import { apiGateway } from '@/services/gateway/router';
import { generateMockDashboardData } from '@/lib/dataGenerator';

export default function CashHeartbeat() {
  // State
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<ConfidenceScore | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [forecast, setForecast] = useState<Forecast[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);

  // Initialize dashboard
  useEffect(() => {
    loadDashboardData();
    startRealTimeUpdates();

    // Subscribe to events
    const subscriptions = [
      eventBus.subscribe(TOPICS.BALANCE_UPDATED, handleBalanceUpdate, 'Dashboard'),
      eventBus.subscribe(TOPICS.ANOMALY_DETECTED, handleAnomalyDetected, 'Dashboard'),
      eventBus.subscribe(TOPICS.FORECAST_UPDATED, handleForecastUpdate, 'Dashboard'),
    ];

    return () => {
      subscriptions.forEach(id => eventBus.unsubscribe(id));
    };
  }, []);

  // Load initial data
  const loadDashboardData = async () => {
    setIsLoading(true);

    try {
      // Generate mock data
      const data = generateMockDashboardData();

      // Set initial state
      setCashPosition(data.cashPosition);
      setAnomalies(data.anomalies.slice(0, 5));
      setForecast(data.forecast);

      // Generate forecast and confidence score
      const forecastData = await generateForecast(30);
      const confidence = calculateConfidenceScore(forecastData);
      setConfidenceScore(confidence);

      // Get service health
      const healthData = apiGateway.getServiceHealth() as ServiceHealth[];
      setServices(healthData);

      // Get queue metrics
      const queue = eventBus.getMetrics();
      setQueueMetrics(queue);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setIsLoading(false);
    }
  };

  // Start real-time updates (every 5 seconds)
  const startRealTimeUpdates = () => {
    const interval = setInterval(() => {
      // Update cash position
      const position = transactionProcessor.getCashPosition();
      setCashPosition(position);

      // Update service health
      const healthData = apiGateway.getServiceHealth() as ServiceHealth[];
      setServices(healthData);

      // Update queue metrics
      const queue = eventBus.getMetrics();
      setQueueMetrics(queue);

      setLastUpdate(new Date());
    }, 5000);

    return () => clearInterval(interval);
  };

  // Event handlers
  const handleBalanceUpdate = (data: any) => {
    console.log('Balance updated:', data);
    const position = transactionProcessor.getCashPosition();
    setCashPosition(position);
  };

  const handleAnomalyDetected = (data: any) => {
    console.log('Anomaly detected:', data);
    setAnomalies(prev => [data.anomaly, ...prev].slice(0, 5));
  };

  const handleForecastUpdate = (data: any) => {
    console.log('Forecast updated:', data);
    setForecast(data.forecast);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
          <p className="mt-4 text-slate-400">Initializing Cash Heartbeat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Cash Heartbeat</h1>
            <p className="text-slate-400">Real-time cash reconciliation & intelligence</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span>Live • Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Cash Position Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">Total Cash</p>
          <p className="text-3xl font-bold text-white">
            ${cashPosition?.totalCash.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">Available Now</p>
          <p className="text-3xl font-bold text-emerald-500">
            ${cashPosition?.availableCash.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">Pending In/Out</p>
          <p className="text-xl font-bold text-white">
            +${cashPosition?.pendingInflows.toLocaleString() || '0'} / 
            -${cashPosition?.pendingOutflows.toLocaleString() || '0'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <p className="text-slate-400 text-sm mb-2">7-Day Projection</p>
          <p className="text-3xl font-bold text-blue-400">
            ${cashPosition?.projectedCash.toLocaleString() || '0'}
          </p>
        </div>
      </div>

      {/* Cash Confidence Score */}
      {confidenceScore && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Cash Confidence Score</h2>
              <p className="text-slate-400 text-sm">How accurate is your forecast right now?</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-emerald-500">{confidenceScore.score}</div>
              <div className="text-slate-400 text-sm capitalize">{confidenceScore.trend}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-slate-500 text-xs mb-1">Forecast Accuracy</p>
              <p className="text-white font-semibold">{confidenceScore.factors.forecastAccuracy}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Data Quality</p>
              <p className="text-white font-semibold">{confidenceScore.factors.dataQuality}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Transaction Volume</p>
              <p className="text-white font-semibold">{confidenceScore.factors.transactionVolume}%</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Anomaly Rate</p>
              <p className="text-white font-semibold">{confidenceScore.factors.anomalyRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Recent Anomalies */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Anomalies</h2>
          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <p className="text-slate-500 text-sm">No anomalies detected</p>
            ) : (
              anomalies.map((anomaly) => (
                <div 
                  key={anomaly.id}
                  className="border border-slate-700 rounded-lg p-4 bg-slate-800/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        anomaly.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        anomaly.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                        anomaly.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {anomaly.severity}
                      </span>
                      <span className="text-slate-400 text-xs">{anomaly.type}</span>
                    </div>
                    <span className="text-slate-500 text-xs">
                      {anomaly.detectedAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mb-2">{anomaly.description}</p>
                  <div className="text-xs text-slate-500">
                    {anomaly.transaction.merchant} • ${anomaly.transaction.amount.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Service Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Microservices Health</h2>
          <div className="space-y-3">
            {services.map((service) => (
              <div 
                key={service.name}
                className="border border-slate-700 rounded-lg p-4 bg-slate-800/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      service.status === 'healthy' ? 'bg-emerald-500' :
                      service.status === 'degraded' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}></div>
                    <span className="text-white font-semibold">{service.name}</span>
                  </div>
                  <span className="text-slate-400 text-sm capitalize">{service.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-slate-500 mb-1">Latency</p>
                    <p className="text-white font-semibold">{service.latency}ms</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Uptime</p>
                    <p className="text-white font-semibold">{service.uptime}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Error Rate</p>
                    <p className="text-white font-semibold">{service.errorRate.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Message Queue Stats */}
      {queueMetrics && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Message Queue Status</h2>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <p className="text-slate-500 text-xs mb-1">Total Published</p>
              <p className="text-2xl font-bold text-white">{queueMetrics.totalPublished}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Total Consumed</p>
              <p className="text-2xl font-bold text-white">{queueMetrics.totalConsumed}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Queue Depth</p>
              <p className="text-2xl font-bold text-emerald-500">{queueMetrics.currentDepth}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Avg Latency</p>
              <p className="text-2xl font-bold text-white">{queueMetrics.avgLatency}ms</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Throughput</p>
              <p className="text-2xl font-bold text-white">{queueMetrics.throughput}/s</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}