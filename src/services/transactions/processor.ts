import { Transaction, Account, CashPosition, ServiceHealth } from '@/types/services';
import { eventBus, TOPICS } from '@/lib/eventBus';
import { dataGenerator } from '@/lib/dataGenerator';

/**
 * TransactionProcessor - High-performance transaction processing engine
 * Simulates Go concurrent processing with goroutines
 */

interface ProcessingBatch {
  id: string;
  transactions: Transaction[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  processedCount: number;
  totalCount: number;
}

interface ReconciliationResult {
  matched: number;
  unmatched: number;
  mismatches: Array<{
    transactionId: string;
    expected: number;
    actual: number;
    difference: number;
  }>;
  timestamp: Date;
}

class TransactionProcessor {
  private accounts: Map<string, Account> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private processingQueue: Transaction[] = [];
  private activeBatches: Map<string, ProcessingBatch> = new Map();
  private reconciliationHistory: ReconciliationResult[] = [];
  
  // Performance metrics
  private metrics = {
    totalProcessed: 0,
    transactionsPerSecond: 0,
    avgProcessingTime: 0,
    batchCount: 0,
    errorCount: 0,
  };

  private processingTimes: number[] = [];
  private transactionsInLastSecond = 0;
  private metricsInterval: NodeJS.Timeout | null = null;
  private processingInterval: NodeJS.Timeout | null = null;

  // Service health
  private health: ServiceHealth = {
    name: 'Transaction Service',
    status: 'healthy',
    uptime: '99.95%',
    latency: 45,
    lastCheck: new Date(),
    errorRate: 0.15,
  };

  constructor() {
    this.initializeAccounts();
    this.startMetricsCollection();
    this.startBackgroundProcessing();
  }

  /**
   * Initialize accounts with mock data
   */
  private initializeAccounts(): void {
    const mockAccounts = dataGenerator.generateAccounts();
    mockAccounts.forEach(account => {
      this.accounts.set(account.id, account);
    });

    this.log('[TransactionEngine] 🏦 Initialized ' + mockAccounts.length + ' accounts');
  }

  /**
   * Process a single transaction
   */
  async processTransaction(transaction: Transaction): Promise<Transaction> {
    const startTime = Date.now();

    this.log(`[TransactionEngine] 🔄 Processing transaction ${transaction.id}`);

    try {
      // Simulate validation
      await this.validateTransaction(transaction);

      // Simulate processing latency (like database write, external API calls)
      await this.simulateLatency(15, 50);

      // Update account balance
      await this.updateAccountBalance(transaction);

      // Mark as completed
      transaction.status = 'completed';
      this.transactions.set(transaction.id, transaction);

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 100) this.processingTimes.shift();
      this.updateAvgProcessingTime();

      this.metrics.totalProcessed++;
      this.transactionsInLastSecond++;

      // Publish event
      await eventBus.publish(
        TOPICS.TRANSACTION_PROCESSED,
        { transaction, processingTime },
        'TransactionEngine'
      );

      this.log(`[TransactionEngine] ✓ Processed ${transaction.id} (${processingTime}ms)`);

      return transaction;

    } catch (error) {
      this.metrics.errorCount++;
      transaction.status = 'failed';
      
      this.log(`[TransactionEngine] ✗ Failed to process ${transaction.id}: ${error}`);

      await eventBus.publish(
        TOPICS.TRANSACTION_FAILED,
        { transaction, error: String(error) },
        'TransactionEngine'
      );

      throw error;
    }
  }

  /**
   * Process batch of transactions (simulates Go goroutines)
   */
  async processBatch(transactions: Transaction[]): Promise<ProcessingBatch> {
    const batchId = this.generateBatchId();
    const batch: ProcessingBatch = {
      id: batchId,
      transactions,
      status: 'processing',
      startTime: new Date(),
      processedCount: 0,
      totalCount: transactions.length,
    };

    this.activeBatches.set(batchId, batch);
    this.metrics.batchCount++;

    this.log(`[TransactionEngine] 📦 Processing batch ${batchId} (${transactions.length} transactions)`);

    // Publish batch start event
    await eventBus.publish(
      TOPICS.TRANSACTION_NEW,
      { batchId, count: transactions.length },
      'TransactionEngine'
    );

    try {
      // Simulate concurrent processing (like Go goroutines)
      // In real Go: for _, txn := range transactions { go processTransaction(txn) }
      const promises = transactions.map(async (txn, index) => {
        // Stagger start times to simulate concurrent goroutines
        await this.simulateLatency(index * 2, index * 2 + 5);
        
        try {
          await this.processTransaction(txn);
          batch.processedCount++;
        } catch (error) {
          // Continue processing other transactions even if one fails
          this.log(`[TransactionEngine] ⚠️  Transaction ${txn.id} failed in batch`);
        }
      });

      // Wait for all to complete (like sync.WaitGroup in Go)
      await Promise.all(promises);

      batch.status = 'completed';
      batch.endTime = new Date();

      this.log(`[TransactionEngine] ✓ Batch ${batchId} completed (${batch.processedCount}/${batch.totalCount})`);

      return batch;

    } catch (error) {
      batch.status = 'failed';
      batch.endTime = new Date();
      
      this.log(`[TransactionEngine] ✗ Batch ${batchId} failed: ${error}`);
      throw error;
    }
  }

  /**
   * Add transaction to processing queue
   */
  enqueueTransaction(transaction: Transaction): void {
    this.processingQueue.push(transaction);
    
    this.log(`[TransactionEngine] ➕ Queued transaction ${transaction.id} (Queue depth: ${this.processingQueue.length})`);

    // Publish to message queue
    eventBus.publish(
      TOPICS.TRANSACTION_NEW,
      { transactionId: transaction.id, queueDepth: this.processingQueue.length },
      'TransactionEngine'
    );
  }

  /**
   * Background processing worker (simulates Go worker pool)
   */
  private startBackgroundProcessing(): void {
    this.processingInterval = setInterval(async () => {
      if (this.processingQueue.length === 0) return;

      // Process in batches of 10 (like Go worker pool with 10 goroutines)
      const batchSize = Math.min(10, this.processingQueue.length);
      const batch = this.processingQueue.splice(0, batchSize);

      await this.processBatch(batch);
    }, 2000); // Process every 2 seconds
  }

  /**
   * Validate transaction
   */
  private async validateTransaction(transaction: Transaction): Promise<void> {
    // Check account exists
    const account = this.accounts.get(transaction.accountId);
    if (!account) {
      throw new Error(`Account ${transaction.accountId} not found`);
    }

    // Check sufficient balance for debits
    if (transaction.type === 'debit' && account.availableBalance < transaction.amount) {
      throw new Error('Insufficient balance');
    }

    // Simulate validation latency
    await this.simulateLatency(5, 15);
  }

  /**
   * Update account balance
   */
  private async updateAccountBalance(transaction: Transaction): Promise<void> {
    const account = this.accounts.get(transaction.accountId);
    if (!account) throw new Error('Account not found');

    const balanceChange = transaction.type === 'credit' 
      ? transaction.amount 
      : -transaction.amount;

    account.balance += balanceChange;
    
    // If completed, update available balance too
    if (transaction.status === 'completed') {
      account.availableBalance += balanceChange;
    }

    account.lastSync = new Date();

    // Publish balance update event
    await eventBus.publish(
      TOPICS.BALANCE_UPDATED,
      { 
        accountId: account.id, 
        balance: account.balance,
        availableBalance: account.availableBalance,
        change: balanceChange 
      },
      'TransactionEngine'
    );

    // Check for low balance
    if (account.availableBalance < 50000 && account.type === 'checking') {
      await eventBus.publish(
        TOPICS.BALANCE_LOW,
        { accountId: account.id, balance: account.availableBalance },
        'TransactionEngine'
      );
    }
  }

  /**
   * Reconcile transactions against bank statements
   */
  async reconcile(accountId: string, bankTransactions: Transaction[]): Promise<ReconciliationResult> {
    this.log(`[TransactionEngine] 🔍 Starting reconciliation for account ${accountId}`);

    await eventBus.publish(
      TOPICS.RECONCILIATION_START,
      { accountId, transactionCount: bankTransactions.length },
      'TransactionEngine',
      'ReconciliationService'
    );

    // Simulate reconciliation processing
    await this.simulateLatency(100, 300);

    const result: ReconciliationResult = {
      matched: 0,
      unmatched: 0,
      mismatches: [],
      timestamp: new Date(),
    };

    // Get our internal transactions for this account
    const internalTransactions = Array.from(this.transactions.values())
      .filter(t => t.accountId === accountId);

    // Simple matching by amount and merchant
    for (const bankTxn of bankTransactions) {
      const match = internalTransactions.find(
        t => Math.abs(t.amount - bankTxn.amount) < 0.01 && t.merchant === bankTxn.merchant
      );

      if (match) {
        result.matched++;
      } else {
        result.unmatched++;
      }
    }

    // Check for mismatches (transactions that exist but amounts differ)
    for (const internalTxn of internalTransactions) {
      const bankTxn = bankTransactions.find(t => t.merchant === internalTxn.merchant);
      if (bankTxn && Math.abs(bankTxn.amount - internalTxn.amount) > 0.01) {
        result.mismatches.push({
          transactionId: internalTxn.id,
          expected: internalTxn.amount,
          actual: bankTxn.amount,
          difference: bankTxn.amount - internalTxn.amount,
        });
      }
    }

    this.reconciliationHistory.push(result);
    if (this.reconciliationHistory.length > 50) this.reconciliationHistory.shift();

    // Publish reconciliation complete
    await eventBus.publish(
      TOPICS.RECONCILIATION_COMPLETE,
      { accountId, result },
      'TransactionEngine'
    );

    if (result.mismatches.length > 0) {
      await eventBus.publish(
        TOPICS.RECONCILIATION_MISMATCH,
        { accountId, mismatches: result.mismatches },
        'TransactionEngine'
      );
    }

    this.log(`[TransactionEngine] ✓ Reconciliation complete: ${result.matched} matched, ${result.unmatched} unmatched, ${result.mismatches.length} mismatches`);

    return result;
  }

  /**
   * Get current cash position across all accounts
   */
  getCashPosition(): CashPosition {
    const accounts = Array.from(this.accounts.values());
    return dataGenerator.generateCashPosition(accounts);
  }

  /**
   * Get account by ID
   */
  getAccount(accountId: string): Account | undefined {
    return this.accounts.get(accountId);
  }

  /**
   * Get all accounts
   */
  getAllAccounts(): Account[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId: string): Transaction | undefined {
    return this.transactions.get(transactionId);
  }

  /**
   * Get recent transactions
   */
  getRecentTransactions(accountId?: string, limit: number = 50): Transaction[] {
    let txns = Array.from(this.transactions.values());
    
    if (accountId) {
      txns = txns.filter(t => t.accountId === accountId);
    }

    return txns
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active batches
   */
  getActiveBatches(): ProcessingBatch[] {
    return Array.from(this.activeBatches.values())
      .filter(b => b.status === 'processing');
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      queueDepth: this.processingQueue.length,
      activeBatches: this.getActiveBatches().length,
    };
  }

  /**
   * Get service health
   */
  getHealth(): ServiceHealth {
    // Update health based on metrics
    this.health.lastCheck = new Date();
    this.health.latency = this.metrics.avgProcessingTime;
    this.health.errorRate = this.metrics.totalProcessed > 0 
      ? (this.metrics.errorCount / this.metrics.totalProcessed) * 100 
      : 0;

    // Set status based on error rate
    if (this.health.errorRate > 5) {
      this.health.status = 'degraded';
    } else if (this.health.errorRate > 10) {
      this.health.status = 'down';
    } else {
      this.health.status = 'healthy';
    }

    return this.health;
  }

  /**
   * Update average processing time
   */
  private updateAvgProcessingTime(): void {
    if (this.processingTimes.length === 0) return;
    const sum = this.processingTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgProcessingTime = Math.round(sum / this.processingTimes.length);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.metrics.transactionsPerSecond = this.transactionsInLastSecond;
      this.transactionsInLastSecond = 0;
    }, 1000);
  }

  /**
   * Simulate processing latency
   */
  private async simulateLatency(min: number, max: number): Promise<void> {
    const delay = Math.random() * (max - min) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.metricsInterval) clearInterval(this.metricsInterval);
    if (this.processingInterval) clearInterval(this.processingInterval);
  }

  /**
   * Structured logging
   */
  private log(message: string): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`%c${message}`, 'color: #f59e0b; font-weight: bold;');
    }
  }
}

// Singleton instance
export const transactionProcessor = new TransactionProcessor();

// Export convenience functions
export async function processTransaction(transaction: Transaction): Promise<Transaction> {
  return transactionProcessor.processTransaction(transaction);
}

export async function processBatch(transactions: Transaction[]): Promise<ProcessingBatch> {
  return transactionProcessor.processBatch(transactions);
}

export function enqueueTransaction(transaction: Transaction): void {
  transactionProcessor.enqueueTransaction(transaction);
}

export async function reconcileAccount(accountId: string, bankTransactions: Transaction[]): Promise<ReconciliationResult> {
  return transactionProcessor.reconcile(accountId, bankTransactions);
}

export function getCashPosition(): CashPosition {
  return transactionProcessor.getCashPosition();
}