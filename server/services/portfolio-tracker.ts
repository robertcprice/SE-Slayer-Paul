import fs from 'fs';
import path from 'path';
import { alpacaClient } from './alpaca';

export class PortfolioTracker {
  private csvPath = path.join(process.cwd(), 'logs', 'portfolio_pnl.csv');
  private trackingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Ensure logs directory exists
    if (!fs.existsSync(path.dirname(this.csvPath))) {
      fs.mkdirSync(path.dirname(this.csvPath), { recursive: true });
    }

    // Initialize CSV file if it doesn't exist
    if (!fs.existsSync(this.csvPath)) {
      const header = 'timestamp,total_pnl,total_equity,buying_power\n';
      fs.writeFileSync(this.csvPath, header);
    }
  }

  startTracking() {
    if (this.trackingInterval) {
      return; // Already tracking
    }

    // Log immediately
    this.logPortfolioValue();

    // Then log every 5 minutes (300000 ms)
    this.trackingInterval = setInterval(() => {
      this.logPortfolioValue();
    }, 5 * 60 * 1000);

    console.log('📊 Portfolio tracking started - logging every 5 minutes');
  }

  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      console.log('📊 Portfolio tracking stopped');
    }
  }

  private async logPortfolioValue() {
    try {
      const account = await alpacaClient.getAccount();
      const positions = await alpacaClient.getPositions();
      
      // Calculate total unrealized P&L from positions
      let totalUnrealizedPnl = 0;
      for (const pos of positions) {
        totalUnrealizedPnl += parseFloat(pos.unrealized_pl || '0');
      }

      const timestamp = new Date().toISOString();
      const totalEquity = parseFloat(account.equity || '0');
      const buyingPower = parseFloat(account.buying_power || '0');

      const csvLine = `${timestamp},${totalUnrealizedPnl.toFixed(2)},${totalEquity.toFixed(2)},${buyingPower.toFixed(2)}\n`;
      
      fs.appendFileSync(this.csvPath, csvLine);
      console.log(`📊 Portfolio logged: P&L $${totalUnrealizedPnl.toFixed(2)}, Equity $${totalEquity.toFixed(2)}`);
      
    } catch (error) {
      console.error('Failed to log portfolio value:', error);
    }
  }

  async getPortfolioHistory(): Promise<Array<{timestamp: string, pnl: number, equity: number}>> {
    try {
      if (!fs.existsSync(this.csvPath)) {
        return [];
      }

      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n').slice(1); // Skip header
      
      return lines.map(line => {
        const [timestamp, pnl, equity] = line.split(',');
        return {
          timestamp,
          pnl: parseFloat(pnl),
          equity: parseFloat(equity)
        };
      }).slice(-100); // Return last 100 entries
      
    } catch (error) {
      console.error('Failed to read portfolio history:', error);
      return [];
    }
  }
}

export const portfolioTracker = new PortfolioTracker();