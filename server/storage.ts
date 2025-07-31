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
  type DashboardStats
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
  
  // All trading assets
  getAllTradingAssets(): Promise<TradingAsset[]>;
}

// Import database connection
import { db } from './db';
import { eq, desc, sql, and } from 'drizzle-orm';
import { users, tradingAssets, trades, positions, marketData, aiReflections, aiDecisionLogs, tradingStrategies, backtestResults } from '@shared/schema';
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
      const trades = await this.getTradesByAsset(assetId);
      
      // Count only actual trading actions (BUY/SELL), not HOLD decisions
      const actualTrades = trades.filter(trade => trade.action !== 'HOLD');
      
      if (actualTrades.length === 0) {
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

      const totalPnl = actualTrades.reduce((sum, trade) => sum + (parseFloat(trade.pnl || "0")), 0);
      const winningTrades = actualTrades.filter(trade => parseFloat(trade.pnl || "0") > 0);
      const losingTrades = actualTrades.filter(trade => parseFloat(trade.pnl || "0") < 0);
      
      const winRate = winningTrades.length / actualTrades.length;
      const averageWin = winningTrades.length > 0 
        ? winningTrades.reduce((sum, trade) => sum + parseFloat(trade.pnl || "0"), 0) / winningTrades.length 
        : 0;
      const averageLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, trade) => sum + parseFloat(trade.pnl || "0"), 0) / losingTrades.length
        : 0;

      // Simple Sharpe ratio calculation
      const returns = actualTrades.map(trade => parseFloat(trade.pnl || "0"));
      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

      return {
        totalPnl,
        winRate,
        sharpeRatio,
        totalTrades: actualTrades.length, // Only count actual trades
        drawdown: Math.min(...returns.map((_, i) => 
          returns.slice(0, i + 1).reduce((sum, ret) => sum + ret, 0)
        )),
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
        query = query.where(eq(aiDecisionLogs.assetId, assetId));
      }
      
      query = query.orderBy(desc(aiDecisionLogs.timestamp));
      
      if (limit) {
        query = query.limit(limit);
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
}

export const storage = new DatabaseStorage();
