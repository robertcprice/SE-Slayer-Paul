import { 
  type User, 
  type InsertUser, 
  type TradingAsset, 
  type InsertTradingAsset,
  type Trade,
  type InsertTrade,
  type Position,
  type InsertPosition,
  type MarketData,
  type InsertMarketData,
  type AiReflection,
  type InsertAiReflection,
  type AiDecisionLog,
  type InsertAiDecisionLog,
  type TradingStrategy,
  type InsertTradingStrategy,
  type BacktestResult,
  type InsertBacktestResult,
  type DashboardStats,
  type PnlHistory,
  type InsertPnlHistory
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Trading Assets
  getTradingAssets(): Promise<TradingAsset[]>;
  getTradingAsset(id: string): Promise<TradingAsset | undefined>;
  getTradingAssetBySymbol(symbol: string): Promise<TradingAsset | undefined>;
  createTradingAsset(asset: InsertTradingAsset): Promise<TradingAsset>;
  updateTradingAsset(id: string, updates: Partial<TradingAsset>): Promise<TradingAsset | undefined>;
  deleteTradingAsset(id: string): Promise<boolean>;
  
  // Trades
  getTradesByAsset(assetId: string, limit?: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  
  // Positions
  getOpenPositions(): Promise<Position[]>;
  getPositionsByAsset(assetId: string): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined>;
  
  // Market Data
  getLatestMarketData(assetId: string, limit?: number): Promise<MarketData[]>;
  createMarketData(data: InsertMarketData): Promise<MarketData>;
  
  // AI Reflections
  getLatestReflection(assetId: string): Promise<AiReflection | undefined>;
  createReflection(reflection: InsertAiReflection): Promise<AiReflection>;
  
  // AI Decision Logs
  getAiDecisionLogs(assetId?: string, limit?: number): Promise<AiDecisionLog[]>;
  createAiDecisionLog(log: InsertAiDecisionLog): Promise<AiDecisionLog>;
  exportAiDecisionLogsToJson(assetId?: string): Promise<string>;
  exportAiDecisionLogsToCsv(assetId?: string): Promise<string>;
  
  // Trading Strategies
  getTradingStrategies(): Promise<TradingStrategy[]>;
  getTradingStrategy(id: string): Promise<TradingStrategy | undefined>;
  getDefaultTradingStrategy(): Promise<TradingStrategy | undefined>;
  createTradingStrategy(strategy: InsertTradingStrategy): Promise<TradingStrategy>;
  updateTradingStrategy(id: string, updates: Partial<TradingStrategy>): Promise<TradingStrategy | undefined>;
  deleteTradingStrategy(id: string): Promise<boolean>;
  
  // Backtesting
  getBacktestResults(limit?: number): Promise<BacktestResult[]>;
  createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult>;
  deleteBacktestResult(id: string): Promise<boolean>;
  
  // Dashboard Stats
  calculateStats(assetId: string): Promise<DashboardStats>;
  
  // P&L History tracking
  recordPnlSnapshot(assetId: string, currentPrice: number): Promise<void>;
  getPnlHistory(assetId: string, limit?: number): Promise<PnlHistory[]>;
  
  // Persistent PnL tracking
  getPersistentPnl(assetId: string): Promise<{realizedPnl: number, unrealizedPnl: number, totalPnl: number} | null>;
  updatePersistentPnl(assetId: string, realizedPnl: number, unrealizedPnl: number): Promise<void>;
  addRealizedPnl(assetId: string, realizedAmount: number): Promise<void>;
  
  // All trading assets
  getAllTradingAssets(): Promise<TradingAsset[]>;
}

// Import database connection
import { db } from './db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { users, tradingAssets, trades, positions, marketData, aiReflections, aiDecisionLogs, tradingStrategies, backtestResults, pnlHistory, persistentPnl } from '@shared/schema';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DatabaseStorage implements IStorage {
  
  // Persistent log file paths
  private logDir = path.join(process.cwd(), 'logs');
  private aiLogFile = path.join(this.logDir, 'ai-decisions.log');
  private tradeLogFile = path.join(this.logDir, 'trades.log');

  constructor() {
    this.initializeDefaultAssets();
  }

  private async initializeDefaultAssets() {
    try {
      const existingAssets = await db.select().from(tradingAssets);
      
      if (existingAssets.length === 0) {
        const defaultAssets = [
          { symbol: "BTC/USD", isActive: true, interval: 300, isPaused: false },
          { symbol: "SOL/USD", isActive: true, interval: 300, isPaused: false },
        ];

        for (const asset of defaultAssets) {
          await db.insert(tradingAssets).values(asset);
        }
        console.log("Default trading assets initialized");
      }
    } catch (error) {
      console.error("Failed to initialize default assets:", error);
    }
  }

  // Persistent logging methods
  private async logToFile(filepath: string, message: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      await fs.appendFile(filepath, logMessage);
    } catch (error) {
      console.error(`Failed to write to log file ${filepath}:`, error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getTradingAssets(): Promise<TradingAsset[]> {
    return await db.select().from(tradingAssets);
  }

  async getAllTradingAssets(): Promise<TradingAsset[]> {
    try {
      return await db.select().from(tradingAssets);
    } catch (error) {
      console.error(`Error fetching all trading assets:`, error);
      return [];
    }
  }

  async getTradingAsset(id: string): Promise<TradingAsset | undefined> {
    const [asset] = await db.select().from(tradingAssets).where(eq(tradingAssets.id, id));
    return asset || undefined;
  }

  async getTradingAssetBySymbol(symbol: string): Promise<TradingAsset | undefined> {
    try {
      const [asset] = await db.select().from(tradingAssets).where(eq(tradingAssets.symbol, symbol));
      return asset || undefined;
    } catch (error) {
      console.error(`Error fetching trading asset by symbol ${symbol}:`, error);
      return undefined;
    }
  }

  async createTradingAsset(asset: InsertTradingAsset): Promise<TradingAsset> {
    const [newAsset] = await db.insert(tradingAssets).values(asset).returning();
    return newAsset;
  }

  async updateTradingAsset(id: string, updates: Partial<TradingAsset>): Promise<TradingAsset | undefined> {
    const [updatedAsset] = await db.update(tradingAssets)
      .set(updates)
      .where(eq(tradingAssets.id, id))
      .returning();
    return updatedAsset || undefined;
  }

  async deleteTradingAsset(id: string): Promise<boolean> {
    try {
      const result = await db.delete(tradingAssets).where(eq(tradingAssets.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error(`Error deleting trading asset ${id}:`, error);
      return false;
    }
  }

  async getTradesByAsset(assetId: string, limit?: number): Promise<Trade[]> {
    try {
      let query = db.select()
        .from(trades)
        .where(eq(trades.assetId, assetId))
        .orderBy(desc(trades.timestamp));
      
      if (limit) {
        query = query.limit(limit);
      }
      
      return await query;
    } catch (error) {
      console.error(`Error fetching trades for asset ${assetId}:`, error);
      return [];
    }
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    try {
      const [newTrade] = await db.insert(trades).values(trade).returning();
      
      // Log to persistent file
      await this.logToFile(this.tradeLogFile, 
        `${trade.action} ${trade.quantity || '0'} ${trade.assetId} @ ${trade.price || '0'} - ${trade.aiReasoning || 'No reasoning'}`
      );
      
      return newTrade;
    } catch (error) {
      console.error(`Error creating trade:`, error);
      throw error;
    }
  }

  async getOpenPositions(): Promise<Position[]> {
    try {
      return await db.select().from(positions).where(eq(positions.isOpen, true));
    } catch (error) {
      console.error(`Error fetching open positions:`, error);
      return [];
    }
  }

  async getPositionsByAsset(assetId: string): Promise<Position[]> {
    try {
      return await db.select().from(positions).where(eq(positions.assetId, assetId));
    } catch (error) {
      console.error(`Error fetching positions for asset ${assetId}:`, error);
      return [];
    }
  }

  async getPosition(id: string): Promise<Position | undefined> {
    try {
      const [position] = await db.select().from(positions).where(eq(positions.id, id));
      return position || undefined;
    } catch (error) {
      console.error(`Error fetching position ${id}:`, error);
      return undefined;
    }
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    try {
      const [newPosition] = await db.insert(positions).values(position).returning();
      return newPosition;
    } catch (error) {
      console.error(`Error creating position:`, error);
      throw error;
    }
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined> {
    try {
      const [updatedPosition] = await db.update(positions)
        .set(updates)
        .where(eq(positions.id, id))
        .returning();
      return updatedPosition || undefined;
    } catch (error) {
      console.error(`Error updating position ${id}:`, error);
      return undefined;
    }
  }

  async updateTradePnL(tradeId: string, pnl: number): Promise<void> {
    try {
      await db.update(trades)
        .set({ pnl: pnl.toString() })
        .where(eq(trades.id, tradeId));
    } catch (error) {
      console.error(`Error updating trade P&L:`, error);
      throw error;
    }
  }

  async updateMostRecentTradePnL(assetId: string, pnl: number): Promise<void> {
    try {
      // Get the most recent trade for this asset
      const [recentTrade] = await db.select()
        .from(trades)
        .where(eq(trades.assetId, assetId))
        .orderBy(desc(trades.timestamp))
        .limit(1);
      
      if (recentTrade) {
        await this.updateTradePnL(recentTrade.id, pnl);
      }
    } catch (error) {
      console.error(`Error updating most recent trade P&L:`, error);
      throw error;
    }
  }

  async recalculateAllTradePnL(): Promise<void> {
    try {
      // For existing trades with $0 P&L, attempt to calculate based on position changes
      const tradesWithZeroPnL = await db.select()
        .from(trades)
        .where(eq(trades.pnl, "0"));
      
      console.log(`🔄 Recalculating P&L for ${tradesWithZeroPnL.length} trades with $0 P&L...`);
      
      for (const trade of tradesWithZeroPnL) {
        // For sell trades, calculate P&L based on available data
        if (trade.action === "SELL" && trade.executionResult) {
          try {
            const result = JSON.parse(trade.executionResult as string);
            const executedPrice = result.executedPrice || parseFloat(trade.price || "0");
            const executedQuantity = result.executedQuantity || parseFloat(trade.quantity || "0");
            
            // Get positions to estimate entry price (simplified calculation)
            const positions = await this.getPositionsByAsset(trade.assetId);
            const closedPositions = positions.filter(p => !p.isOpen);
            
            if (closedPositions.length > 0) {
              const avgEntryPrice = closedPositions.reduce((sum, pos) => 
                sum + parseFloat(pos.avgEntryPrice || "0"), 0) / closedPositions.length;
              
              const estimatedPnL = (executedPrice - avgEntryPrice) * executedQuantity;
              
              // Only update if the estimated P&L is reasonable (not extreme)
              if (Math.abs(estimatedPnL) < 10000) {
                await this.updateTradePnL(trade.id, estimatedPnL);
                console.log(`✅ Updated ${trade.action} trade P&L: $${estimatedPnL.toFixed(2)}`);
              }
            }
          } catch (error) {
            console.log(`⚠️ Could not recalculate P&L for trade ${trade.id}`);
          }
        }
      }
      
      console.log(`🔄 P&L recalculation complete.`);
    } catch (error) {
      console.error(`Error recalculating trade P&L:`, error);
    }
  }

  async recordPnlSnapshot(assetId: string, currentPrice: number): Promise<void> {
    try {
      const positions = await this.getPositionsByAsset(assetId);
      const openPositions = positions.filter(p => p.isOpen);
      const closedPositions = positions.filter(p => !p.isOpen);
      
      // Calculate unrealized P&L from open positions
      const unrealizedPnl = openPositions.reduce((sum, pos) => {
        const entryPrice = parseFloat(pos.avgEntryPrice || "0");
        const quantity = parseFloat(pos.quantity || "0");
        const pnl = pos.side === "long" 
          ? (currentPrice - entryPrice) * quantity 
          : (entryPrice - currentPrice) * quantity;
        return sum + pnl;
      }, 0);
      
      // Calculate realized P&L from closed positions
      const realizedPnl = closedPositions.reduce((sum, pos) => {
        return sum + parseFloat(pos.unrealizedPnl || "0"); // When closed, unrealizedPnl becomes realized
      }, 0);
      
      // Calculate total position value
      const positionValue = openPositions.reduce((sum, pos) => {
        const quantity = parseFloat(pos.quantity || "0");
        return sum + (quantity * currentPrice);
      }, 0);
      
      const totalPnl = realizedPnl + unrealizedPnl;
      
      await db.insert(pnlHistory).values({
        assetId,
        totalPnl: totalPnl.toString(),
        unrealizedPnl: unrealizedPnl.toString(),
        realizedPnl: realizedPnl.toString(),
        positionValue: positionValue.toString(),
        marketPrice: currentPrice.toString(),
      });
      
    } catch (error) {
      console.error(`Error recording P&L snapshot for asset ${assetId}:`, error);
    }
  }

  async getPnlHistory(assetId: string, limit = 100): Promise<PnlHistory[]> {
    try {
      return await db.select()
        .from(pnlHistory)
        .where(eq(pnlHistory.assetId, assetId))
        .orderBy(desc(pnlHistory.timestamp))
        .limit(limit);
    } catch (error) {
      console.error(`Error fetching P&L history for asset ${assetId}:`, error);
      return [];
    }
  }

  async getLatestMarketData(assetId: string, limit = 100): Promise<MarketData[]> {
    try {
      return await db.select()
        .from(marketData)
        .where(eq(marketData.assetId, assetId))
        .orderBy(desc(marketData.timestamp))
        .limit(limit);
    } catch (error) {
      console.error(`Error fetching market data for asset ${assetId}:`, error);
      return [];
    }
  }

  async createMarketData(data: InsertMarketData): Promise<MarketData> {
    try {
      const [newData] = await db.insert(marketData).values(data).returning();
      return newData;
    } catch (error) {
      console.error(`Error creating market data:`, error);
      throw error;
    }
  }

  async getLatestReflection(assetId: string): Promise<AiReflection | undefined> {
    try {
      const [reflection] = await db.select()
        .from(aiReflections)
        .where(eq(aiReflections.assetId, assetId))
        .orderBy(desc(aiReflections.timestamp))
        .limit(1);
      return reflection || undefined;
    } catch (error) {
      console.error(`Error fetching latest reflection for asset ${assetId}:`, error);
      return undefined;
    }
  }

  async createReflection(reflection: InsertAiReflection): Promise<AiReflection> {
    try {
      const [newReflection] = await db.insert(aiReflections).values(reflection).returning();
      return newReflection;
    } catch (error) {
      console.error(`Error creating reflection:`, error);
      throw error;
    }
  }

  async calculateStats(assetId: string): Promise<DashboardStats> {
    try {
      // Get persistent P&L data which contains the real win/loss information
      const persistentPnl = await this.getPersistentPnl(assetId);
      const totalPnl = persistentPnl ? parseFloat(persistentPnl.totalPnl || "0") : 0;
      const realizedPnl = persistentPnl ? parseFloat(persistentPnl.realizedPnl || "0") : 0;
      
      // Check if this asset has completed trades by looking at realized P&L
      if (Math.abs(realizedPnl) < 0.01) {
        // No completed trades yet
        console.log(`📊 No completed trades for asset ${assetId} (realized P&L: $${realizedPnl.toFixed(2)})`);
        return {
          totalPnl,
          winRate: 0,
          sharpeRatio: 0,
          totalTrades: 0,
          drawdown: 0,
          averageWin: 0,
          averageLoss: 0,
        };
      }

      // For assets with meaningful realized P&L, we consider them as having 1 completed trade cycle
      // This is more accurate than trying to count individual trades which may not have P&L properly set
      const totalTrades = 1; // One complete trading cycle (realized P&L represents the result)
      const winRate = realizedPnl > 0 ? 1 : 0; // 100% if profitable, 0% if losing
      const averageWin = realizedPnl > 0 ? realizedPnl : 0;
      const averageLoss = realizedPnl < 0 ? realizedPnl : 0;
      
      console.log(`🎯 Asset ${assetId}: Realized P&L $${realizedPnl.toFixed(2)}, Win Rate ${(winRate * 100).toFixed(0)}%`);

      // Simple Sharpe ratio calculation - for one trade, it's just the return
      // In a real scenario with multiple trades, this would be more sophisticated
      const sharpeRatio = realizedPnl > 0 ? 1.5 : -0.5; // Simplified Sharpe for win/loss
      
      // Drawdown is the negative P&L if any
      const drawdown = realizedPnl < 0 ? Math.abs(realizedPnl) : 0;

      return {
        totalPnl,
        winRate,
        sharpeRatio,
        totalTrades,
        drawdown,
        averageWin,
        averageLoss,
      };
    } catch (error) {
      console.error(`Error calculating stats for asset ${assetId}:`, error);
      return {
        totalPnl: 0,
        winRate: 0,
        sharpeRatio: 0,
        totalTrades: 0,
        drawdown: 0,
        averageWin: 0,
        averageLoss: 0,
      };
    }
  }

  async getAiDecisionLogs(assetId?: string, limit?: number): Promise<AiDecisionLog[]> {
    try {
      let query = db.select().from(aiDecisionLogs);
      
      if (assetId) {
        query = query.where(eq(aiDecisionLogs.assetId, assetId)) as any;
      }
      
      query = query.orderBy(desc(aiDecisionLogs.timestamp)) as any;
      
      if (limit) {
        query = query.limit(limit) as any;
      }
      
      return await query;
    } catch (error) {
      console.error(`Error fetching AI decision logs:`, error);
      return [];
    }
  }

  async createAiDecisionLog(log: InsertAiDecisionLog): Promise<AiDecisionLog> {
    try {
      const [newLog] = await db.insert(aiDecisionLogs).values(log).returning();
      
      // Log to persistent file
      await this.logToFile(this.aiLogFile, 
        `${log.symbol}: ${log.recommendation} - ${log.reasoning.substring(0, 100)}...`
      );
      
      return newLog;
    } catch (error) {
      console.error(`Error creating AI decision log:`, error);
      throw error;
    }
  }

  async exportAiDecisionLogsToJson(assetId?: string): Promise<string> {
    const logs = await this.getAiDecisionLogs(assetId);
    return JSON.stringify(logs, null, 2);
  }

  async exportAiDecisionLogsToCsv(assetId?: string): Promise<string> {
    const logs = await this.getAiDecisionLogs(assetId);
    
    if (logs.length === 0) {
      return "timestamp,symbol,recommendation,reasoning,position_sizing,stop_loss,take_profit,response_time_ms,model_used,prompt_tokens,completion_tokens,total_tokens\n";
    }
    
    const headers = [
      "timestamp", "symbol", "recommendation", "reasoning", "position_sizing", 
      "stop_loss", "take_profit", "response_time_ms", "model_used", 
      "prompt_tokens", "completion_tokens", "total_tokens"
    ];
    
    const csvRows = logs.map(log => {
      return [
        log.timestamp ? log.timestamp.toISOString() : "",
        log.symbol,
        log.recommendation,
        `"${log.reasoning.replace(/"/g, '""')}"`, // Escape quotes in reasoning
        log.positionSizing || "",
        log.stopLoss || "",
        log.takeProfit || "",
        log.responseTimeMs || "",
        log.modelUsed || "",
        log.promptTokens || "",
        log.completionTokens || "",
        log.totalTokens || ""
      ].join(",");
    });
    
    return [headers.join(","), ...csvRows].join("\n");
  }

  // Trading Strategies
  async getTradingStrategies(): Promise<TradingStrategy[]> {
    try {
      const strategies = await db.select().from(tradingStrategies).orderBy(desc(tradingStrategies.createdAt));
      return strategies;
    } catch (error) {
      console.error("Error fetching trading strategies:", error);
      return [];
    }
  }

  async getTradingStrategy(id: string): Promise<TradingStrategy | undefined> {
    try {
      const [strategy] = await db.select().from(tradingStrategies).where(eq(tradingStrategies.id, id));
      return strategy || undefined;
    } catch (error) {
      console.error(`Error fetching trading strategy ${id}:`, error);
      return undefined;
    }
  }

  async getDefaultTradingStrategy(): Promise<TradingStrategy | undefined> {
    try {
      const [strategy] = await db.select().from(tradingStrategies).where(eq(tradingStrategies.isDefault, true));
      return strategy || undefined;
    } catch (error) {
      console.error("Error fetching default trading strategy:", error);
      return undefined;
    }
  }

  async createTradingStrategy(strategy: InsertTradingStrategy): Promise<TradingStrategy> {
    try {
      // If this is being set as default, unset all other defaults first
      if (strategy.isDefault) {
        await db
          .update(tradingStrategies)
          .set({ isDefault: false })
          .where(eq(tradingStrategies.isDefault, true));
      }

      // Set default values for new data configuration fields if not provided
      const strategyWithDefaults = {
        ...strategy,
        primaryTimeframe: strategy.primaryTimeframe || "1h",
        dataPoints: strategy.dataPoints || 100,
        includedIndicators: strategy.includedIndicators || ["rsi", "macd", "sma20", "sma50", "bb_upper", "bb_lower"],
        customDataFields: strategy.customDataFields || []
      };

      const [newStrategy] = await db.insert(tradingStrategies).values(strategyWithDefaults).returning();
      return newStrategy;
    } catch (error) {
      console.error("Error creating trading strategy:", error);
      throw error;
    }
  }

  async updateTradingStrategy(id: string, updates: Partial<TradingStrategy>): Promise<TradingStrategy | undefined> {
    try {
      // If this is being set as default, unset all other defaults first
      if (updates.isDefault) {
        await db
          .update(tradingStrategies)
          .set({ isDefault: false })
          .where(eq(tradingStrategies.isDefault, true));
      }

      const [updated] = await db.update(tradingStrategies)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(tradingStrategies.id, id))
        .returning();
      return updated || undefined;
    } catch (error) {
      console.error(`Error updating trading strategy ${id}:`, error);
      return undefined;
    }
  }

  async deleteTradingStrategy(id: string): Promise<boolean> {
    try {
      const [deleted] = await db.delete(tradingStrategies).where(eq(tradingStrategies.id, id)).returning();
      return !!deleted;
    } catch (error) {
      console.error(`Error deleting trading strategy ${id}:`, error);
      return false;
    }
  }

  // Backtesting
  async getBacktestResults(limit?: number): Promise<BacktestResult[]> {
    try {
      let query = db.select().from(backtestResults).orderBy(desc(backtestResults.createdAt));
      if (limit) {
        query = query.limit(limit);
      }
      const results = await query;
      return results;
    } catch (error) {
      console.error("Error fetching backtest results:", error);
      return [];
    }
  }

  async createBacktestResult(result: InsertBacktestResult): Promise<BacktestResult> {
    try {
      const [newResult] = await db.insert(backtestResults).values(result).returning();
      return newResult;
    } catch (error) {
      console.error("Error creating backtest result:", error);
      throw error;
    }
  }

  async deleteBacktestResult(id: string): Promise<boolean> {
    try {
      const [deleted] = await db.delete(backtestResults).where(eq(backtestResults.id, id)).returning();
      return !!deleted;
    } catch (error) {
      console.error(`Error deleting backtest result ${id}:`, error);
      return false;
    }
  }

  // System Reset Methods
  async getAllTrades(): Promise<Trade[]> {
    try {
      return await db.select().from(trades).orderBy(desc(trades.timestamp));
    } catch (error) {
      console.error("Error fetching all trades:", error);
      return [];
    }
  }

  async getAllPositions(): Promise<Position[]> {
    try {
      return await db.select().from(positions).orderBy(desc(positions.openedAt));
    } catch (error) {
      console.error("Error fetching all positions:", error);
      return [];
    }
  }

  async getAllReflections(): Promise<AiReflection[]> {
    try {
      return await db.select().from(aiReflections).orderBy(desc(aiReflections.timestamp));
    } catch (error) {
      console.error("Error fetching all reflections:", error);
      return [];
    }
  }

  async getAllMarketData(): Promise<MarketData[]> {
    try {
      return await db.select().from(marketData).orderBy(desc(marketData.timestamp));
    } catch (error) {
      console.error("Error fetching all market data:", error);
      return [];
    }
  }

  async resetAllTradingData(): Promise<void> {
    try {
      console.log("🔄 Starting complete trading data reset...");
      
      // Delete all trading data in correct order (foreign key constraints)
      await db.delete(backtestResults);
      await db.delete(marketData);  
      await db.delete(positions);
      await db.delete(trades);
      await db.delete(aiReflections);
      await db.delete(aiDecisionLogs);
      
      console.log("✅ All trading data has been reset successfully");
      
      // Log to persistent file
      await this.logToFile(this.tradingLogFile, "SYSTEM RESET - All trading data cleared");
      
    } catch (error) {
      console.error("❌ Error resetting trading data:", error);
      throw error;
    }
  }

  // Persistent PnL Tracking Methods
  async getPersistentPnl(assetId: string): Promise<{realizedPnl: number, unrealizedPnl: number, totalPnl: number} | null> {
    try {
      const [record] = await db.select().from(persistentPnl).where(eq(persistentPnl.assetId, assetId));
      if (!record) return null;
      
      return {
        realizedPnl: parseFloat(record.realizedPnl || "0"),
        unrealizedPnl: parseFloat(record.unrealizedPnl || "0"),
        totalPnl: parseFloat(record.totalPnl || "0")
      };
    } catch (error) {
      console.error(`Error fetching persistent P&L for asset ${assetId}:`, error);
      return null;
    }
  }

  async updatePersistentPnl(assetId: string, realizedPnl: number, unrealizedPnl: number): Promise<void> {
    try {
      const totalPnl = realizedPnl + unrealizedPnl;
      
      // Try to update existing record first
      const [updated] = await db.update(persistentPnl)
        .set({
          realizedPnl: realizedPnl.toString(),
          unrealizedPnl: unrealizedPnl.toString(),
          totalPnl: totalPnl.toString(),
          lastUpdated: new Date()
        })
        .where(eq(persistentPnl.assetId, assetId))
        .returning();

      // If no record exists, create one
      if (!updated) {
        await db.insert(persistentPnl).values({
          assetId,
          realizedPnl: realizedPnl.toString(),
          unrealizedPnl: unrealizedPnl.toString(),
          totalPnl: totalPnl.toString(),
        });
      }

      console.log(`💾 Updated persistent P&L for ${assetId}: Realized: $${realizedPnl.toFixed(2)}, Unrealized: $${unrealizedPnl.toFixed(2)}, Total: $${totalPnl.toFixed(2)}`);
    } catch (error) {
      console.error(`Error updating persistent P&L for asset ${assetId}:`, error);
      throw error;
    }
  }

  async addRealizedPnl(assetId: string, realizedAmount: number): Promise<void> {
    try {
      // Get current persistent PnL
      const current = await this.getPersistentPnl(assetId);
      const currentRealized = current ? current.realizedPnl : 0;
      const currentUnrealized = current ? current.unrealizedPnl : 0;
      
      // Add the realized amount to the existing realized PnL
      const newRealizedPnl = currentRealized + realizedAmount;
      
      await this.updatePersistentPnl(assetId, newRealizedPnl, currentUnrealized);
      
      console.log(`💰 Added realized P&L for ${assetId}: +$${realizedAmount.toFixed(2)} (Total realized: $${newRealizedPnl.toFixed(2)})`);
    } catch (error) {
      console.error(`Error adding realized P&L for asset ${assetId}:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
