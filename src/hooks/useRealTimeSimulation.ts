'use client';

import { useEffect, useRef } from 'react';
import { Transaction, Anomaly } from '@/types/services';
import { eventBus, TOPICS } from '@/lib/eventBus';
import { dataGenerator } from '@/lib/dataGenerator';
import { transactionProcessor, enqueueTransaction } from '@/services/transactions/processor';
import { mlService } from '@/services/ml/forecaster';

/**
 * Real-time simulation hook - makes demo feel alive
 * Generates streaming transactions, processes them, detects anomalies
 */
export function useRealTimeSimulation() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const anomalyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start streaming transactions every 8-15 seconds
    const startTransactionStream = () => {
      intervalRef.current = setInterval(() => {
        const accounts = transactionProcessor.getAllAccounts();
        if (accounts.length === 0) return;

        // Pick random account
        const account = accounts[Math.floor(Math.random() * accounts.length)];
        
        // Generate new transaction
        const transaction = dataGenerator.generateStreamingTransaction(account.id);
        
        // Add to processing queue
        enqueueTransaction(transaction);

        // Publish event
        eventBus.publish(
          TOPICS.TRANSACTION_NEW,
          { transaction, source: 'real-time-stream' },
          'RealTimeSimulator'
        );

        console.log(`%c[RealTime] 💸 New transaction: ${transaction.merchant} $${transaction.amount}`, 'color: #22d3ee; font-weight: bold;');
      }, Math.random() * 7000 + 8000); // 8-15 seconds
    };

    // Generate anomalies every 30-60 seconds
    const startAnomalyStream = () => {
      anomalyIntervalRef.current = setInterval(async () => {
        const accounts = transactionProcessor.getAllAccounts();
        if (accounts.length === 0) return;

        // 30% chance to generate anomaly
        if (Math.random() < 0.3) {
          const account = accounts[0];
          const anomalyTypes = ['duplicate', 'suspicious_amount', 'unusual_timing', 'frequency'] as const;
          const type = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];

          const transaction = dataGenerator.generateAnomalousTransaction(account.id, type);
          const anomaly = dataGenerator.generateAnomaly(transaction);

          // Publish anomaly event
          await eventBus.publish(
            TOPICS.ANOMALY_DETECTED,
            { anomaly },
            'RealTimeSimulator'
          );

          console.log(`%c[RealTime] 🚨 Anomaly detected: ${type}`, 'color: #ef4444; font-weight: bold;');
        }
      }, Math.random() * 30000 + 30000); // 30-60 seconds
    };

    // Start streams
    startTransactionStream();
    startAnomalyStream();

    // Cleanup
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (anomalyIntervalRef.current) clearInterval(anomalyIntervalRef.current);
    };
  }, []);

  return null;
}