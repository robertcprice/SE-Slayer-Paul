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
  
  // Dashboard Stats
  calculateStats(assetId: string): Promise<DashboardStats>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private tradingAssets: Map<string, TradingAsset>;
  private trades: Map<string, Trade>;
  private positions: Map<string, Position>;
  private marketData: Map<string, MarketData>;
  private aiReflections: Map<string, AiReflection>;
  private aiDecisionLogs: Map<string, AiDecisionLog>;

  constructor() {
    this.users = new Map();
    this.tradingAssets = new Map();
    this.trades = new Map();
    this.positions = new Map();
    this.marketData = new Map();
    this.aiReflections = new Map();
    this.aiDecisionLogs = new Map();
    
    // Initialize with default trading assets
    this.initializeDefaultAssets();
  }

  private initializeDefaultAssets() {
    const defaultAssets = [
      { symbol: "BTC/USD", isActive: true, interval: 300, isPaused: false },
      { symbol: "SOL/USD", isActive: true, interval: 300, isPaused: false },
    ];

    defaultAssets.forEach(asset => {
      const id = randomUUID();
      this.tradingAssets.set(id, {
        id,
        ...asset,
        createdAt: new Date(),
      });
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getTradingAssets(): Promise<TradingAsset[]> {
    return Array.from(this.tradingAssets.values());
  }

  async getTradingAsset(id: string): Promise<TradingAsset | undefined> {
    return this.tradingAssets.get(id);
  }

  async getTradingAssetBySymbol(symbol: string): Promise<TradingAsset | undefined> {
    return Array.from(this.tradingAssets.values()).find(asset => asset.symbol === symbol);
  }

  async createTradingAsset(asset: InsertTradingAsset): Promise<TradingAsset> {
    const id = randomUUID();
    const newAsset: TradingAsset = {
      id,
      symbol: asset.symbol,
      isActive: asset.isActive ?? true,
      interval: asset.interval ?? 300,
      isPaused: asset.isPaused ?? false,
      createdAt: new Date(),
    };
    this.tradingAssets.set(id, newAsset);
    return newAsset;
  }

  async updateTradingAsset(id: string, updates: Partial<TradingAsset>): Promise<TradingAsset | undefined> {
    const asset = this.tradingAssets.get(id);
    if (!asset) return undefined;
    
    const updatedAsset = { ...asset, ...updates };
    this.tradingAssets.set(id, updatedAsset);
    return updatedAsset;
  }

  async getTradesByAsset(assetId: string, limit = 50): Promise<Trade[]> {
    return Array.from(this.trades.values())
      .filter(trade => trade.assetId === assetId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = randomUUID();
    const newTrade: Trade = {
      id,
      timestamp: new Date(),
      assetId: trade.assetId || null,
      action: trade.action,
      quantity: trade.quantity || null,
      price: trade.price || null,
      positionSizing: trade.positionSizing || null,
      stopLoss: trade.stopLoss || null,
      takeProfit: trade.takeProfit || null,
      aiReasoning: trade.aiReasoning || null,
      aiDecision: trade.aiDecision || null,
      executionResult: trade.executionResult || null,
      pnl: trade.pnl || null,
    };
    this.trades.set(id, newTrade);
    return newTrade;
  }

  async getOpenPositions(): Promise<Position[]> {
    return Array.from(this.positions.values()).filter(pos => pos.isOpen);
  }

  async getPositionsByAsset(assetId: string): Promise<Position[]> {
    return Array.from(this.positions.values()).filter(pos => pos.assetId === assetId);
  }

  async createPosition(position: InsertPosition): Promise<Position> {
    const id = randomUUID();
    const newPosition: Position = {
      id,
      openedAt: new Date(),
      assetId: position.assetId || null,
      symbol: position.symbol,
      side: position.side,
      quantity: position.quantity || null,
      avgEntryPrice: position.avgEntryPrice || null,
      unrealizedPnl: position.unrealizedPnl || null,
      isOpen: position.isOpen ?? true,
      closedAt: position.closedAt || null,
    };
    this.positions.set(id, newPosition);
    return newPosition;
  }

  async updatePosition(id: string, updates: Partial<Position>): Promise<Position | undefined> {
    const position = this.positions.get(id);
    if (!position) return undefined;
    
    const updatedPosition = { ...position, ...updates };
    if (updates.isOpen === false && !updatedPosition.closedAt) {
      updatedPosition.closedAt = new Date();
    }
    this.positions.set(id, updatedPosition);
    return updatedPosition;
  }

  async getLatestMarketData(assetId: string, limit = 100): Promise<MarketData[]> {
    return Array.from(this.marketData.values())
      .filter(data => data.assetId === assetId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
      .slice(0, limit);
  }

  async createMarketData(data: InsertMarketData): Promise<MarketData> {
    const id = randomUUID();
    const newData: MarketData = {
      id,
      timestamp: new Date(),
      assetId: data.assetId || null,
      open: data.open || null,
      high: data.high || null,
      low: data.low || null,
      close: data.close || null,
      volume: data.volume || null,
      indicators: data.indicators || null,
    };
    this.marketData.set(id, newData);
    return newData;
  }

  async getLatestReflection(assetId: string): Promise<AiReflection | undefined> {
    return Array.from(this.aiReflections.values())
      .filter(reflection => reflection.assetId === assetId)
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))[0];
  }

  async createReflection(reflection: InsertAiReflection): Promise<AiReflection> {
    const id = randomUUID();
    const newReflection: AiReflection = {
      id,
      timestamp: new Date(),
      assetId: reflection.assetId || null,
      reflection: reflection.reflection || null,
      improvements: reflection.improvements || null,
      summary: reflection.summary || null,
    };
    this.aiReflections.set(id, newReflection);
    return newReflection;
  }

  async calculateStats(assetId: string): Promise<DashboardStats> {
    const trades = await this.getTradesByAsset(assetId);
    
    if (trades.length === 0) {
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

    const totalPnl = trades.reduce((sum, trade) => sum + (parseFloat(trade.pnl || "0")), 0);
    const winningTrades = trades.filter(trade => parseFloat(trade.pnl || "0") > 0);
    const losingTrades = trades.filter(trade => parseFloat(trade.pnl || "0") < 0);
    
    const winRate = winningTrades.length / trades.length;
    const averageWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, trade) => sum + parseFloat(trade.pnl || "0"), 0) / winningTrades.length 
      : 0;
    const averageLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, trade) => sum + parseFloat(trade.pnl || "0"), 0) / losingTrades.length
      : 0;

    // Simple Sharpe ratio calculation (would need risk-free rate in real implementation)
    const returns = trades.map(trade => parseFloat(trade.pnl || "0"));
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;

    // Simple drawdown calculation
    let runningPnl = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    for (const trade of trades.reverse()) {
      runningPnl += parseFloat(trade.pnl || "0");
      if (runningPnl > peak) {
        peak = runningPnl;
      }
      const drawdown = (peak - runningPnl) / Math.max(peak, 1);
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalPnl,
      winRate,
      sharpeRatio,
      totalTrades: trades.length,
      drawdown: maxDrawdown,
      averageWin,
      averageLoss,
    };
  }

  // AI Decision Logs
  async getAiDecisionLogs(assetId?: string, limit?: number): Promise<AiDecisionLog[]> {
    let logs = Array.from(this.aiDecisionLogs.values());
    
    if (assetId) {
      logs = logs.filter(log => log.assetId === assetId);
    }
    
    // Sort by timestamp (newest first)
    logs.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
    
    if (limit) {
      logs = logs.slice(0, limit);
    }
    
    return logs;
  }

  async createAiDecisionLog(log: InsertAiDecisionLog): Promise<AiDecisionLog> {
    const newLog: AiDecisionLog = {
      id: randomUUID(),
      timestamp: new Date(),
      assetId: log.assetId || null,
      symbol: log.symbol,
      recommendation: log.recommendation,
      reasoning: log.reasoning,
      positionSizing: log.positionSizing || null,
      stopLoss: log.stopLoss || null,
      takeProfit: log.takeProfit || null,
      nextCycleSeconds: log.nextCycleSeconds || null,
      marketData: log.marketData || null,
      rawResponse: log.rawResponse || null,
      responseTimeMs: log.responseTimeMs || null,
      modelUsed: log.modelUsed || "gpt-4o",
      promptTokens: log.promptTokens || null,
      completionTokens: log.completionTokens || null,
      totalTokens: log.totalTokens || null,
    };
    
    this.aiDecisionLogs.set(newLog.id, newLog);
    return newLog;
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
}

export const storage = new MemStorage();
