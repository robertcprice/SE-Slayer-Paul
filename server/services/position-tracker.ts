import { storage } from '../storage';
import { alpacaClient } from './alpaca';

interface TrackedPosition {
  symbol: string;
  assetId: string;
  quantity: string;
  avgEntryPrice: number;
  lastPnL: number;
  lastUpdated: Date;
}

export class PositionTracker {
  private lastKnownPositions: Map<string, TrackedPosition> = new Map();

  // Check for position changes and capture realized P&L when positions are closed
  async checkForPositionChanges(): Promise<void> {
    try {
      // Get all trading assets
      const assets = await storage.getAllTradingAssets();
      
      for (const asset of assets) {
        await this.checkAssetPositions(asset.id, asset.symbol);
      }
    } catch (error) {
      console.error('Error in position tracker:', error);
    }
  }

  private async checkAssetPositions(assetId: string, symbol: string): Promise<void> {
    try {
      // Get current Alpaca positions for this asset
      const currentPositions = await alpacaClient.getPositions(symbol);
      const currentPosition = currentPositions.length > 0 ? currentPositions[0] : null;
      
      const positionKey = `${symbol}`;
      const lastKnownPosition = this.lastKnownPositions.get(positionKey);
      
      if (lastKnownPosition && !currentPosition) {
        // Position was closed! Capture the realized P&L
        const realizedPnL = lastKnownPosition.lastPnL;
        
        console.log(`🔄 Position closed for ${symbol}: Capturing realized P&L of $${realizedPnL.toFixed(2)}`);
        
        // Add this to persistent realized P&L
        await storage.addRealizedPnl(assetId, realizedPnL);
        
        // Remove from tracking
        this.lastKnownPositions.delete(positionKey);
        
      } else if (currentPosition) {
        // Position exists, update our tracking
        const currentPnL = parseFloat(currentPosition.unrealized_pl || "0");
        const avgEntryPrice = parseFloat(currentPosition.avg_entry_price || "0");
        
        this.lastKnownPositions.set(positionKey, {
          symbol,
          assetId,
          quantity: currentPosition.qty,
          avgEntryPrice,
          lastPnL: currentPnL,
          lastUpdated: new Date()
        });
      }
      
    } catch (error) {
      console.error(`Error checking positions for ${symbol}:`, error);
    }
  }

  // Initialize tracking with current positions
  async initializeTracking(): Promise<void> {
    console.log('🎯 Initializing position tracking...');
    await this.checkForPositionChanges();
    console.log('✅ Position tracking initialized');
  }

  // Start periodic monitoring
  startMonitoring(intervalSeconds: number = 30): void {
    console.log(`📊 Starting position monitoring every ${intervalSeconds} seconds`);
    
    // Check immediately
    this.checkForPositionChanges();
    
    // Then check periodically
    setInterval(() => {
      this.checkForPositionChanges();
    }, intervalSeconds * 1000);
  }
}

export const positionTracker = new PositionTracker();