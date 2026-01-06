'use client';

import { useEffect, useState } from 'react';
import { 
  CashPosition, 
  Anomaly, 
  Forecast, 
  ConfidenceScore,
  ServiceHealth,
  Transaction
} from '@/types/services';
import { eventBus, TOPICS, QueueMetrics } from '@/lib/eventBus';
import { transactionProcessor } from '@/services/transactions/processor';
import { generateForecast, calculateConfidenceScore } from '@/services/ml/forecaster';
import { apiGateway } from '@/services/gateway/router';
import { generateMockDashboardData } from '@/lib/dataGenerator';
import { useRealTimeSimulation } from '@/hooks/useRealTimeSimulation';

export default function CashHeartbeat() {
  // State
  const [cashPosition, setCashPosition] = useState<CashPosition | null>(null);
  const [confidenceScore, setConfidenceScore] = useState<ConfidenceScore | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [forecast, setForecast] = useState<Forecast[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [newTransactionAlert, setNewTransactionAlert] = useState(false);
  const [newAnomalyAlert, setNewAnomalyAlert] = useState(false);

  // Enable real-time simulation
  useRealTimeSimulation();

  // Initialize dashboard
  useEffect(() => {
    loadDashboardData();
    const cleanup = startRealTimeUpdates();

    // Subscribe to events
    const subscriptions = [
      eventBus.subscribe(TOPICS.BALANCE_UPDATED, handleBalanceUpdate, 'Dashboard'),
      eventBus.subscribe(TOPICS.ANOMALY_DETECTED, handleAnomalyDetected, 'Dashboard'),
      eventBus.subscribe(TOPICS.FORECAST_UPDATED, handleForecastUpdate, 'Dashboard'),
      eventBus.subscribe(TOPICS.TRANSACTION_NEW, handleNewTransaction, 'Dashboard'),
      eventBus.subscribe(TOPICS.TRANSACTION_PROCESSED, handleTransactionProcessed, 'Dashboard'),
    ];

    return () => {
      subscriptions.forEach(id => eventBus.unsubscribe(id));
      cleanup();
    };
  }, []);

  // Load initial data
  const loadDashboardData = async () => {
    setIsLoading(true);

    try {
      const data = generateMockDashboardData();

      setCashPosition(data.cashPosition);
      setAnomalies(data.anomalies.slice(0, 5));
      setRecentTransactions(data.transactions.slice(0, 10));
      setForecast(data.forecast);

      const forecastData = await generateForecast(30);
      const confidence = calculateConfidenceScore(forecastData);
      setConfidenceScore(confidence);

      const healthData = apiGateway.getServiceHealth() as ServiceHealth[];
      setServices(healthData);

      const queue = eventBus.getMetrics();
      setQueueMetrics(queue);

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setIsLoading(false);
    }
  };

  // Start real-time updates
  const startRealTimeUpdates = () => {
    const interval = setInterval(() => {
      const position = transactionProcessor.getCashPosition();
      setCashPosition(position);

      const healthData = apiGateway.getServiceHealth() as ServiceHealth[];
      setServices(healthData);

      const queue = eventBus.getMetrics();
      setQueueMetrics(queue);

      setLastUpdate(new Date());
    }, 3000); // Every 3 seconds

    return () => clearInterval(interval);
  };

  // Event handlers
  const handleBalanceUpdate = (data: any) => {
    const position = transactionProcessor.getCashPosition();
    setCashPosition(position);
  };

  const handleAnomalyDetected = (data: any) => {
    setAnomalies(prev => [data.anomaly, ...prev].slice(0, 5));
    
    // Flash alert
    setNewAnomalyAlert(true);
    setTimeout(() => setNewAnomalyAlert(false), 3000);
  };

  const handleForecastUpdate = (data: any) => {
    setForecast(data.forecast);
  };

  const handleNewTransaction = (data: any) => {
    // Flash alert
    setNewTransactionAlert(true);
    setTimeout(() => setNewTransactionAlert(false), 2000);
  };

  const handleTransactionProcessed = (data: any) => {
    // Update recent transactions
    const recent = transactionProcessor.getRecentTransactions(undefined, 10);
    setRecentTransactions(recent);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F3EE]">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-black border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Initializing Cash Heartbeat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE] text-black p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-black mb-2">Cash Heartbeat</h1>
            <p className="text-gray-600">Real-time cash reconciliation & intelligence</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse"></div>
                <span>Live</span>
              </div>
              
              {/* Transaction alert */}
              {newTransactionAlert && (
                <div className="flex items-center gap-2 text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full animate-pulse">
                  <span>💸 New transaction</span>
                </div>
              )}
              
              {/* Anomaly alert */}
              {newAnomalyAlert && (
                <div className="flex items-center gap-2 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full animate-pulse">
                  <span>🚨 Anomaly detected</span>
                </div>
              )}
              
              <span className="text-sm text-gray-500">Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Cash Position Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-600 text-sm mb-2">Total Cash</p>
          <p className="text-3xl font-bold text-black">
            ${cashPosition?.totalCash.toLocaleString() || '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Across {cashPosition?.accounts.length || 0} accounts</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-600 text-sm mb-2">Available Now</p>
          <p className="text-3xl font-bold text-green-600">
            ${cashPosition?.availableCash.toLocaleString() || '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Ready to use</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-600 text-sm mb-2">Pending In/Out</p>
          <p className="text-xl font-bold text-black">
            +${cashPosition?.pendingInflows.toLocaleString() || '0'} / 
            -${cashPosition?.pendingOutflows.toLocaleString() || '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Settling soon</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-gray-600 text-sm mb-2">7-Day Projection</p>
          <p className="text-3xl font-bold text-blue-600">
            ${cashPosition?.projectedCash.toLocaleString() || '0'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Forecasted</p>
        </div>
      </div>

      {/* Cash Confidence Score */}
      {confidenceScore && (
        <div className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-lg p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-black mb-1">Cash Confidence Score</h2>
              <p className="text-gray-600 text-sm">How accurate is your forecast right now?</p>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-green-600">{confidenceScore.score}</div>
              <div className="text-gray-600 text-sm capitalize flex items-center gap-1 justify-end">
                {confidenceScore.trend === 'improving' && '📈'}
                {confidenceScore.trend === 'stable' && '➡️'}
                {confidenceScore.trend === 'declining' && '📉'}
                {confidenceScore.trend}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Forecast Accuracy</p>
              <div className="flex items-center gap-2">
                <p className="text-black font-semibold">{confidenceScore.factors.forecastAccuracy}%</p>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: `${confidenceScore.factors.forecastAccuracy}%` }}></div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Data Quality</p>
              <div className="flex items-center gap-2">
                <p className="text-black font-semibold">{confidenceScore.factors.dataQuality}%</p>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600" style={{ width: `${confidenceScore.factors.dataQuality}%` }}></div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Transaction Volume</p>
              <div className="flex items-center gap-2">
                <p className="text-black font-semibold">{confidenceScore.factors.transactionVolume}%</p>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600" style={{ width: `${confidenceScore.factors.transactionVolume}%` }}></div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Anomaly Rate</p>
              <div className="flex items-center gap-2">
                <p className="text-black font-semibold">{confidenceScore.factors.anomalyRate}%</p>
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-600" style={{ width: `${confidenceScore.factors.anomalyRate}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Transactions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black mb-4">Recent Activity</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentTransactions.slice(0, 8).map((txn) => (
              <div 
                key={txn.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100 hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-semibold text-black">{txn.merchant}</p>
                  <p className="text-xs text-gray-500">{txn.timestamp.toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${txn.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.type === 'credit' ? '+' : '-'}${txn.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{txn.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Anomalies */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black mb-4">Recent Anomalies</h2>
          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <p className="text-gray-500 text-sm">No anomalies detected</p>
            ) : (
              anomalies.map((anomaly) => (
                <div 
                  key={anomaly.id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        anomaly.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        anomaly.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        anomaly.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {anomaly.severity}
                      </span>
                      <span className="text-gray-600 text-xs">{anomaly.type}</span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {anomaly.detectedAt.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{anomaly.description}</p>
                  <div className="text-xs text-gray-600">
                    {anomaly.transaction.merchant} • ${anomaly.transaction.amount.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Service Health */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black mb-4">Services</h2>
          <div className="space-y-3">
            {services.map((service) => (
              <div 
                key={service.name}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${
                      service.status === 'healthy' ? 'bg-green-600 animate-pulse' :
                      service.status === 'degraded' ? 'bg-yellow-600' :
                      'bg-red-600'
                    }`}></div>
                    <span className="text-black font-semibold text-sm">{service.name}</span>
                  </div>
                  <span className="text-gray-600 text-xs capitalize">{service.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Latency</p>
                    <p className="text-black font-semibold">{service.latency}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Uptime</p>
                    <p className="text-black font-semibold">{service.uptime}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Errors</p>
                    <p className="text-black font-semibold">{service.errorRate.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Message Queue Stats */}
      {queueMetrics && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black mb-4">Message Queue Status</h2>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <p className="text-gray-500 text-xs mb-1">Total Published</p>
              <p className="text-2xl font-bold text-black">{queueMetrics.totalPublished}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Total Consumed</p>
              <p className="text-2xl font-bold text-black">{queueMetrics.totalConsumed}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Queue Depth</p>
              <p className="text-2xl font-bold text-green-600">{queueMetrics.currentDepth}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Avg Latency</p>
              <p className="text-2xl font-bold text-black">{queueMetrics.avgLatency}ms</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Throughput</p>
              <p className="text-2xl font-bold text-black">{queueMetrics.throughput}/s</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}