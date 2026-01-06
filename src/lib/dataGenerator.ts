import { Transaction, Account, Forecast, Anomaly, CashPosition } from '@/types/services';

/**
 * DataGenerator - Creates realistic financial data for demo
 * Simulates real-world patterns: business hours, seasonality, anomalies
 */

class DataGenerator {
  private transactionIdCounter = 1000;
  private accountIdCounter = 1;
  private anomalyIdCounter = 1;

  // Merchant pools for realistic transactions
  private merchants = {
    saas: ['AWS', 'Google Cloud', 'Stripe', 'GitHub', 'Vercel', 'Netlify', 'MongoDB Atlas', 'DataDog'],
    payroll: ['ADP Payroll', 'Gusto', 'Rippling', 'Paychex'],
    office: ['WeWork', 'Regus', 'Office Depot', 'Staples', 'Amazon Business'],
    marketing: ['Google Ads', 'Facebook Ads', 'LinkedIn Ads', 'HubSpot', 'Mailchimp'],
    services: ['Upwork', 'Fiverr', 'Toptal', 'Freelancer.com'],
    utilities: ['Electric Company', 'Internet Provider', 'Phone Provider', 'Water Utility'],
    revenue: ['Stripe Revenue', 'PayPal Revenue', 'Bank Transfer', 'Client Payment', 'Invoice Payment'],
  };

  private categories = [
    'Software & SaaS',
    'Payroll',
    'Office & Equipment',
    'Marketing',
    'Professional Services',
    'Utilities',
    'Revenue',
    'Taxes',
    'Insurance',
    'Travel',
  ];

  /**
   * Generate initial accounts
   */
  generateAccounts(): Account[] {
    return [
      {
        id: `acc_${this.accountIdCounter++}`,
        name: 'Business Checking',
        type: 'checking',
        balance: 248750.45,
        availableBalance: 243250.45, // Some pending
        currency: 'USD',
        lastSync: new Date(),
        institution: 'Silicon Valley Bank',
      },
      {
        id: `acc_${this.accountIdCounter++}`,
        name: 'Savings Account',
        type: 'savings',
        balance: 500000.0,
        availableBalance: 500000.0,
        currency: 'USD',
        lastSync: new Date(),
        institution: 'Silicon Valley Bank',
      },
      {
        id: `acc_${this.accountIdCounter++}`,
        name: 'Stripe Balance',
        type: 'payment_processor',
        balance: 87234.12,
        availableBalance: 82134.12,
        currency: 'USD',
        lastSync: new Date(),
        institution: 'Stripe',
      },
      {
        id: `acc_${this.accountIdCounter++}`,
        name: 'Business Credit Card',
        type: 'credit',
        balance: -12450.78, // Negative = owed
        availableBalance: -12450.78,
        currency: 'USD',
        lastSync: new Date(),
        institution: 'American Express',
      },
    ];
  }

  /**
   * Generate cash position summary
   */
  generateCashPosition(accounts: Account[]): CashPosition {
    const totalCash = accounts
      .filter((a) => a.type !== 'credit')
      .reduce((sum, a) => sum + a.balance, 0);

    const availableCash = accounts
      .filter((a) => a.type !== 'credit')
      .reduce((sum, a) => sum + a.availableBalance, 0);

    const pendingInflows = accounts
      .filter((a) => a.type !== 'credit')
      .reduce((sum, a) => sum + (a.balance - a.availableBalance), 0);

    return {
      totalCash,
      availableCash,
      pendingInflows,
      pendingOutflows: 15230.5, // Mock pending outflows
      projectedCash: totalCash + 45000 - 38000, // 7-day projection
      lastUpdated: new Date(),
      accounts,
    };
  }

  /**
   * Generate a single transaction
   */
  generateTransaction(accountId: string, overrides?: Partial<Transaction>): Transaction {
    const isRevenue = Math.random() < 0.3; // 30% are revenue
    const type = isRevenue ? 'credit' : 'debit';

    let merchant: string;
    let category: string;
    let amount: number;

    if (isRevenue) {
      merchant = this.randomFromArray(this.merchants.revenue);
      category = 'Revenue';
      amount = this.randomAmount(500, 15000);
    } else {
      // Pick random expense category
      const categoryKey = this.randomFromArray(Object.keys(this.merchants));
      merchant = this.randomFromArray(this.merchants[categoryKey as keyof typeof this.merchants]);
      category = this.mapCategoryToLabel(categoryKey);
      amount = this.randomAmount(50, 5000);
    }

    // Realistic timing - business hours weighted
    const timestamp = this.generateBusinessHoursTimestamp();

    return {
      id: `txn_${this.transactionIdCounter++}`,
      accountId,
      amount,
      currency: 'USD',
      type,
      category,
      merchant,
      description: `${type === 'credit' ? 'Payment from' : 'Payment to'} ${merchant}`,
      status: Math.random() < 0.85 ? 'completed' : 'pending',
      timestamp,
      ...overrides,
    };
  }

  /**
   * Generate batch of transactions
   */
  generateTransactions(count: number, accountId: string): Transaction[] {
    const transactions: Transaction[] = [];
    for (let i = 0; i < count; i++) {
      transactions.push(this.generateTransaction(accountId));
    }
    return transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate transaction with specific anomaly
   */
  generateAnomalousTransaction(
    accountId: string,
    anomalyType: 'duplicate' | 'suspicious_amount' | 'unusual_timing' | 'frequency'
  ): Transaction {
    let overrides: Partial<Transaction> = {};

    switch (anomalyType) {
      case 'duplicate':
        // Same amount, merchant, close timing
        overrides = {
          amount: 1499.99,
          merchant: 'AWS',
          category: 'Software & SaaS',
          type: 'debit',
        };
        break;

      case 'suspicious_amount':
        // Unusually large amount
        overrides = {
          amount: 47890.5,
          merchant: 'Unknown Vendor',
          category: 'Professional Services',
          type: 'debit',
        };
        break;

      case 'unusual_timing':
        // Weekend or 3 AM transaction
        overrides = {
          timestamp: new Date(Date.now() - Math.random() * 2 * 24 * 60 * 60 * 1000), // Random in last 2 days
          amount: 2340.0,
          merchant: 'Office Supplies Inc',
        };
        overrides.timestamp!.setHours(3); // 3 AM
        break;

      case 'frequency':
        // Same merchant, multiple times
        overrides = {
          merchant: 'Subscription Service XYZ',
          amount: 29.99,
          category: 'Software & SaaS',
          type: 'debit',
        };
        break;
    }

    const transaction = this.generateTransaction(accountId, overrides);
    transaction.isAnomaly = true;
    transaction.anomalyScore = Math.random() * 0.3 + 0.7; // 0.7 - 1.0

    return transaction;
  }

  /**
   * Generate anomaly record
   */
  generateAnomaly(transaction: Transaction): Anomaly {
    const anomalyTypes = [
      {
        type: 'duplicate' as const,
        severity: 'high' as const,
        description: `Potential duplicate payment to ${transaction.merchant}. Similar transaction detected 2 hours ago.`,
      },
      {
        type: 'suspicious_amount' as const,
        severity: 'critical' as const,
        description: `Unusually large payment of $${transaction.amount.toLocaleString()} to ${
          transaction.merchant
        }. 450% above average.`,
      },
      {
        type: 'unusual_timing' as const,
        severity: 'medium' as const,
        description: `Transaction at unusual time (${transaction.timestamp.toLocaleTimeString()}). Outside normal business hours.`,
      },
      {
        type: 'frequency' as const,
        severity: 'low' as const,
        description: `Multiple charges from ${transaction.merchant} this week. Possible subscription stacking.`,
      },
    ];

    const anomalyData = this.randomFromArray(anomalyTypes);

    return {
      id: `anomaly_${this.anomalyIdCounter++}`,
      transaction,
      type: anomalyData.type,
      severity: anomalyData.severity,
      description: anomalyData.description,
      detectedAt: new Date(),
      resolved: false,
    };
  }

  /**
   * Generate forecast data (30 days)
   */
  generateForecast(startDate: Date = new Date(), days: number = 30): Forecast[] {
    const forecasts: Forecast[] = [];
    const baseAmount = 250000; // Base cash level

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Add realistic patterns
      const trend = i * 200; // Slight upward trend
      const weekly = Math.sin((i * 2 * Math.PI) / 7) * 15000; // Weekly cycle
      const noise = (Math.random() - 0.5) * 8000; // Random noise

      const predicted = baseAmount + trend + weekly + noise;
      const confidence = 90 - Math.abs(weekly) / 200; // Lower confidence during volatile periods

      // Past data has actuals
      const isPast = date < new Date();
      const actual = isPast ? predicted + (Math.random() - 0.5) * 5000 : undefined;

      forecasts.push({
        date,
        predicted: Math.round(predicted),
        actual: actual ? Math.round(actual) : undefined,
        confidence: Math.round(confidence),
        lower_bound: Math.round(predicted * 0.92),
        upper_bound: Math.round(predicted * 1.08),
      });
    }

    return forecasts;
  }

  /**
   * Generate realistic timestamp during business hours
   */
  private generateBusinessHoursTimestamp(): Date {
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 30); // Last 30 days
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Weight toward business hours (9 AM - 5 PM)
    const rand = Math.random();
    let hour: number;

    if (rand < 0.7) {
      // 70% during business hours
      hour = 9 + Math.floor(Math.random() * 8); // 9 AM - 5 PM
    } else if (rand < 0.9) {
      // 20% early morning/evening
      hour = Math.random() < 0.5 ? 7 + Math.floor(Math.random() * 2) : 17 + Math.floor(Math.random() * 3);
    } else {
      // 10% late night
      hour = Math.floor(Math.random() * 24);
    }

    date.setHours(hour, Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));

    return date;
  }

  /**
   * Generate random amount in range
   */
  private randomAmount(min: number, max: number): number {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  }

  /**
   * Pick random item from array
   */
  private randomFromArray<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Map category key to display label
   */
  private mapCategoryToLabel(key: string): string {
    const mapping: Record<string, string> = {
      saas: 'Software & SaaS',
      payroll: 'Payroll',
      office: 'Office & Equipment',
      marketing: 'Marketing',
      services: 'Professional Services',
      utilities: 'Utilities',
      revenue: 'Revenue',
    };
    return mapping[key] || 'Other';
  }

  /**
   * Generate streaming transaction (for real-time demo)
   */
  generateStreamingTransaction(accountId: string): Transaction {
    return this.generateTransaction(accountId, {
      timestamp: new Date(),
      status: Math.random() < 0.7 ? 'pending' : 'completed',
    });
  }

  /**
   * Generate forecast variance explanation (for Autopsy)
   */
  generateForecastVariance(actualVariance: number) {
    const reasons = [
      {
        category: 'Payment Timing',
        impact: Math.round(actualVariance * 0.35),
        description: 'Client payments delayed by 2-3 days (3x this month)',
        frequency: 3,
      },
      {
        category: 'Unexpected Expenses',
        impact: Math.round(actualVariance * 0.25),
        description: 'Emergency server costs not in budget (AWS spike)',
        frequency: 1,
      },
      {
        category: 'Subscription Creep',
        impact: Math.round(actualVariance * 0.20),
        description: 'New tool subscriptions activated mid-month',
        frequency: 4,
      },
      {
        category: 'Seasonal Pattern',
        impact: Math.round(actualVariance * 0.15),
        description: 'Month-end invoice clustering not accounted for',
        frequency: 1,
      },
      {
        category: 'Data Quality',
        impact: Math.round(actualVariance * 0.05),
        description: 'Bank sync delays caused stale forecast inputs',
        frequency: 2,
      },
    ];

    const learnings = [
      'Payment timing variance increased 40% vs. last quarter',
      'Consider adding buffer for cloud infrastructure spikes',
      'Track subscription additions more proactively',
      'Month-end clustering is consistent - adjust model',
    ];

    const adjustments = [
      'Updated payment delay coefficient from 2 days → 3 days',
      'Added 15% buffer for variable cloud costs',
      'Implemented subscription tracking automation',
      'Applied seasonal adjustment for month-end patterns',
    ];

    return {
      reasons,
      learnings,
      adjustments,
    };
  }
}

// Singleton instance
export const dataGenerator = new DataGenerator();

// Helper functions for common operations
export function generateMockDashboardData() {
  const accounts = dataGenerator.generateAccounts();
  const cashPosition = dataGenerator.generateCashPosition(accounts);
  const recentTransactions = dataGenerator.generateTransactions(50, accounts[0].id);
  const forecast = dataGenerator.generateForecast();

  // Generate some anomalies
  const anomalousTransactions = [
    dataGenerator.generateAnomalousTransaction(accounts[0].id, 'duplicate'),
    dataGenerator.generateAnomalousTransaction(accounts[0].id, 'suspicious_amount'),
    dataGenerator.generateAnomalousTransaction(accounts[0].id, 'unusual_timing'),
  ];

  const anomalies = anomalousTransactions.map((txn) => dataGenerator.generateAnomaly(txn));

  return {
    accounts,
    cashPosition,
    transactions: [...anomalousTransactions, ...recentTransactions].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    ),
    forecast,
    anomalies,
  };
}