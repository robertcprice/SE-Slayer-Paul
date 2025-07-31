import { storage } from "../storage";
import { generateReflection } from "./openai";
import type { TradingAsset } from "@shared/schema";

export class AISchedulerService {
  private reflectionIntervals = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🤖 AI Scheduler started - will generate strategy improvements every 2 hours');
    this.scheduleReflections();
  }

  stop() {
    this.isRunning = false;
    this.reflectionIntervals.forEach(interval => clearInterval(interval));
    this.reflectionIntervals.clear();
    console.log('🤖 AI Scheduler stopped');
  }

  private async scheduleReflections() {
    try {
      const assets = await storage.getAllTradingAssets();
      
      for (const asset of assets) {
        if (asset.isActive && !asset.isPaused) {
          this.scheduleAssetReflection(asset);
        }
      }
      
      // Check for new assets every 10 minutes
      setTimeout(() => {
        if (this.isRunning) {
          this.scheduleReflections();
        }
      }, 10 * 60 * 1000);
      
    } catch (error) {
      console.error('Error scheduling AI reflections:', error);
    }
  }

  private scheduleAssetReflection(asset: TradingAsset) {
    // Clear existing interval if any
    const existingInterval = this.reflectionIntervals.get(asset.id);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Schedule reflection every 2 hours (7200000 ms)
    const interval = setInterval(async () => {
      await this.generateAssetReflection(asset);
    }, 2 * 60 * 60 * 1000);

    this.reflectionIntervals.set(asset.id, interval);
    
    // Run initial reflection after 30 seconds
    setTimeout(() => {
      this.generateAssetReflection(asset);
    }, 30 * 1000);

    console.log(`📊 AI reflection scheduled for ${asset.symbol} every 2 hours`);
  }

  private async generateAssetReflection(asset: TradingAsset) {
    try {
      console.log(`🔍 Generating AI strategy analysis for ${asset.symbol}...`);
      
      // Get recent trades for analysis
      const recentTrades = await storage.getTradesByAsset(asset.id, 50);
      const actualTrades = recentTrades.filter(t => t.action === "BUY" || t.action === "SELL");
      
      if (actualTrades.length < 3) {
        console.log(`⏳ Not enough trading data for ${asset.symbol} reflection (${actualTrades.length} trades)`);
        return;
      }

      // Calculate performance metrics
      let totalPnl = 0;
      let wins = 0;
      let losses = 0;
      
      for (const trade of actualTrades) {
        const pnl = parseFloat(trade.pnl || "0");
        totalPnl += pnl;
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
      }

      const winRate = wins / actualTrades.length;
      const avgWin = wins > 0 ? actualTrades.filter(t => parseFloat(t.pnl || "0") > 0)
        .reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / wins : 0;
      const avgLoss = losses > 0 ? actualTrades.filter(t => parseFloat(t.pnl || "0") < 0)
        .reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / losses : 0;

      // Generate AI reflection
      const reflection = await generateReflection({
        symbol: asset.symbol,
        timeframe: "2h",
        totalTrades: actualTrades.length,
        winRate,
        totalPnl,
        avgWin,
        avgLoss,
        recentTrades: actualTrades.slice(0, 10).map(t => ({
          action: t.action,
          price: parseFloat(t.price || "0"),
          quantity: parseFloat(t.quantity || "0"),
          pnl: parseFloat(t.pnl || "0"),
          timestamp: t.timestamp || new Date().toISOString(),
          reasoning: t.aiReasoning || ""
        }))
      });

      // Store reflection in database
      await storage.createReflection({
        assetId: asset.id,
        reflection: reflection.reflection,
        improvements: reflection.improvements,
        performanceMetrics: {
          totalTrades: actualTrades.length,
          winRate,
          totalPnl,
          avgWin,
          avgLoss
        },
        timestamp: new Date().toISOString()
      });

      console.log(`✅ AI strategy analysis completed for ${asset.symbol}`);
      console.log(`📈 Performance: ${actualTrades.length} trades, ${(winRate * 100).toFixed(1)}% win rate, $${totalPnl.toFixed(2)} P&L`);
      
    } catch (error) {
      console.error(`❌ Error generating reflection for ${asset.symbol}:`, error);
    }
  }

  // Public method to trigger manual reflection
  async triggerReflection(assetId: string) {
    try {
      const asset = await storage.getTradingAsset(assetId);
      if (asset) {
        await this.generateAssetReflection(asset);
      }
    } catch (error) {
      console.error('Error triggering manual reflection:', error);
    }
  }

  // Update asset reflection schedule when asset settings change
  async updateAssetSchedule(asset: TradingAsset) {
    if (asset.isActive && !asset.isPaused) {
      this.scheduleAssetReflection(asset);
    } else {
      // Remove reflection for inactive/paused assets
      const existingInterval = this.reflectionIntervals.get(asset.id);
      if (existingInterval) {
        clearInterval(existingInterval);
        this.reflectionIntervals.delete(asset.id);
        console.log(`🚫 AI reflection disabled for ${asset.symbol} (inactive/paused)`);
      }
    }
  }
}

// Singleton instance
export const aiScheduler = new AISchedulerService();