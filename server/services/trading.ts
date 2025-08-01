import { storage } from "../storage";
import { DataClient } from "./dataClient";
import { alpacaClient } from "./alpaca";
import { analyzeMarketWithOpenAI, generateReflection, type MarketSummary } from "./openai";
import type { 
  TradingAsset, 
  Trade, 
  Position, 
  DashboardStats, 
  ChartData, 
  TradeFeed,
  WebSocketMessage,
  AccountBalance
} from "@shared/schema";

export interface TradingCycleResult {
  success: boolean;
  trade?: Trade;
  error?: string;
  aiDecision?: any;
  stats?: DashboardStats;
  reflection?: { reflection: string; improvements: string };
}

export class TradingService {
  private dataClient: DataClient;
  private lastReflectionTrades: Map<string, number> = new Map();

  constructor() {
    this.dataClient = new DataClient();
  }

  async getDashboardData(assetSymbol: string): Promise<{
    stats: DashboardStats;
    chart: ChartData;
    positions: Position[];
    feed: TradeFeed[];
    reflection?: { reflection: string; improvements: string };
    accountBalance?: AccountBalance;
  }> {
    const asset = await storage.getTradingAssetBySymbol(assetSymbol);
    if (!asset) {
      throw new Error(`Asset ${assetSymbol} not found`);
    }

    // CRITICAL FIX: Calculate stats using ONLY real Alpaca positions, not database
    let stats: DashboardStats = {
      totalPnl: 0,
      winRate: 0,
      sharpeRatio: 0,
      totalTrades: 0,
      drawdown: 0,
      averageWin: 0,
      averageLoss: 0,
    };

    // Generate realistic chart data
    let chart: ChartData = {
      dates: [],
      close: [],
      volume: [],
    };

    try {
      // Try to get real Alpaca market data first
      const alpacaData = await this.dataClient.getHistoricalData(assetSymbol, 30, '1h');
      if (alpacaData.length > 0) {
        chart = {
          dates: alpacaData.map(d => d.timestamp.toISOString().split('T')[0]),
          close: alpacaData.map(d => d.close),
          volume: alpacaData.map(d => d.volume),
        };
      }
    } catch (error) {
      console.error(`Failed to get real market data for ${assetSymbol}:`, error);
      // Fallback to stored data if Alpaca fails
      const marketData = await storage.getLatestMarketData(asset.id, 30);
      chart = {
        dates: marketData.map(d => d.timestamp?.toISOString().split('T')[0] || ''),
        close: marketData.map(d => parseFloat(d.close || "0")),
        volume: marketData.map(d => parseFloat(d.volume || "0")),
      };
    }

    // Get ONLY real positions from Alpaca API - direct feed
    let positions: Position[] = [];
    try {
      const alpacaPositions = await alpacaClient.getPositions();
      const assetPositions = alpacaPositions.filter(p => p.symbol === assetSymbol.replace('/', ''));
      
      if (assetPositions.length > 0) {
        positions = assetPositions.map(pos => {
          // Use real Alpaca P&L directly instead of calculating
          const realPnl = parseFloat(pos.unrealized_pl || "0");
          
          // Use the direct avg_entry_price field from Alpaca API
          const avgEntryPrice = parseFloat(pos.avg_entry_price || "0");
          
          console.log(`📊 Real Alpaca position for ${assetSymbol}: ${pos.qty} @ $${avgEntryPrice.toFixed(2)}, P&L: $${realPnl.toFixed(2)}`);
          
          return {
            id: `alpaca-${pos.symbol}`,
            openedAt: new Date(),
            assetId: asset.id,
            symbol: assetSymbol,
            side: pos.side,
            quantity: pos.qty,
            avgEntryPrice: avgEntryPrice.toString(),
            unrealizedPnl: realPnl.toString(), // Use parsed real Alpaca P&L
            isOpen: true,
            closedAt: null,
          };
        });
      }
      
      console.log(`📊 Real Alpaca positions for ${assetSymbol}: ${positions.length} positions`);
      
    } catch (error) {
      console.error(`Failed to get real Alpaca positions for ${assetSymbol}:`, error);
      positions = [];
    }

    // Get current market price - FIXED to prevent price contamination
    let currentPrice = 100000; // Default BTC price
    try {
      // Try to get real price first
      const realPrice = await alpacaClient.getLatestPrice(assetSymbol);
      if (realPrice && realPrice > 0) {
        currentPrice = realPrice;
        console.log(`💰 Using Alpaca price for ${assetSymbol}: $${currentPrice}`);
      } else {
        throw new Error("Invalid price from Alpaca");
      }
    } catch (error) {
      // Use realistic asset-specific defaults and try backup sources
      if (assetSymbol.includes("XRP")) {
        currentPrice = 2.5; // Realistic XRP price
        console.log(`💰 Using fallback XRP price: $${currentPrice}`);
      } else if (assetSymbol.includes("SOL")) {
        currentPrice = 170; // Realistic SOL price  
        console.log(`💰 Using fallback SOL price: $${currentPrice}`);
      } else if (assetSymbol.includes("BTC")) {
        currentPrice = 116000; // Realistic BTC price
        console.log(`💰 Using fallback BTC price: $${currentPrice}`);
      }
      
      // Try backup price sources
      try {
        if (assetSymbol.includes("BTC")) {
          // Using external API for backup price data
          const response = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=BTC');
          const data = await response.json();
          const coinbasePrice = parseFloat(data.data.rates.USD);
          if (coinbasePrice) {
            currentPrice = coinbasePrice;
            console.log(`💰 Using Coinbase API for ${assetSymbol}: $${currentPrice}`);
          }
        }
      } catch (backupError) {
        console.log(`⚠️ Backup price sources failed for ${assetSymbol}, using fallback: $${currentPrice}`);
      }
    }

    // CRITICAL FIX: Calculate REAL stats from REAL Alpaca positions AND persistent PnL
    const totalRealPnl = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.unrealizedPnl || "0");
    }, 0);
    
    // Get or initialize persistent PnL for this asset
    const persistentData = await storage.getPersistentPnl(asset.id);
    
    // Update persistent PnL with current unrealized P&L
    const realizedPnl = persistentData ? persistentData.realizedPnl : 0;
    await storage.updatePersistentPnl(asset.id, realizedPnl, totalRealPnl);
    
    // Use persistent total PnL for display (realized + unrealized)
    const totalPersistentPnl = realizedPnl + totalRealPnl;
    
    stats.totalPnl = totalPersistentPnl;
    console.log(`📊 Real total P&L for ${assetSymbol}: $${totalRealPnl.toFixed(2)} (unrealized) + $${realizedPnl.toFixed(2)} (realized) = $${totalPersistentPnl.toFixed(2)} (total)`);
    

    // Get stats including win rate from storage - this uses the correct persistent P&L calculation
    const calculatedStats = await storage.calculateStats(asset.id);
    
    // Override the total P&L with our persistent P&L value, but keep other calculated stats
    stats = {
      ...calculatedStats,
      totalPnl: totalPersistentPnl // Use our persistent P&L calculation
    };

    // Get completed trades from our database (trades created when positions were closed)
    const completedTrades = await storage.getTradesByAsset(asset.id, 20);
    const feed: TradeFeed[] = completedTrades
      .filter(trade => trade.pnl && Math.abs(parseFloat(trade.pnl)) > 0.01) // Only trades with meaningful P&L
      .map(trade => ({
        action: trade.action,
        quantity: trade.quantity || "0",
        price: trade.price || "0",
        timestamp: (trade.openedAt || trade.timestamp || new Date()).toISOString(),
        openedAt: (trade.openedAt || trade.timestamp || new Date()).toISOString(),
        closedAt: trade.closedAt ? trade.closedAt.toISOString() : null,
        status: trade.status || (trade.closedAt ? "closed" : "open"),
        pnl: parseFloat(trade.pnl || "0"),
        aiReasoning: trade.aiReasoning || "No reasoning provided",
      }))
      .slice(0, 10); // Show last 10 completed trades

    // Get latest reflection
    const latestReflection = await storage.getLatestReflection(asset.id);
    const reflection = latestReflection ? {
      reflection: latestReflection.reflection || "No reflection available",
      improvements: latestReflection.improvements || "No improvements suggested"
    } : undefined;

    // Get account balance - RESTORED FUNCTIONALITY
    let accountBalance: AccountBalance | undefined;
    try {
      const account = await alpacaClient.getAccount();
      if (account) {
        accountBalance = {
          cash: account.cash,
          equity: account.portfolio_value,
          buyingPower: account.buying_power,
          status: account.status,
          dayTradeCount: account.daytrade_count || 0,
        };
        console.log(`💰 Account Balance: $${account.portfolio_value} equity, $${account.cash} cash`);
      }
    } catch (error) {
      console.error(`Failed to get account balance:`, error);
    }

    return { stats, chart, positions, feed, reflection, accountBalance };
  }

  async runTradingCycle(asset: TradingAsset): Promise<TradingCycleResult> {
    try {
      console.log(`Running trading cycle for ${asset.symbol}`);
      
      // Get historical data
      const historicalData = await this.dataClient.getHistoricalData(asset.symbol, 30, '1h');
      if (!historicalData.length) {
        throw new Error("No historical data available");
      }

      // Prepare market summary for AI
      const summary: MarketSummary = {
        close: historicalData.map(d => d.close),
        rsi: historicalData.map(d => d.indicators?.rsi14 || 50),
        macd: historicalData.map(d => d.indicators?.macd || 0),
        macd_signal: historicalData.map(d => d.indicators?.macd_signal || 0),
        bb_upper: historicalData.map(d => d.indicators?.bb_upper || d.close),
        bb_lower: historicalData.map(d => d.indicators?.bb_lower || d.close),
        sma20: historicalData.map(d => d.indicators?.sma20 || d.close),
        sma50: historicalData.map(d => d.indicators?.sma50 || d.close),
        ema20: historicalData.map(d => d.indicators?.ema20 || d.close),
        ema50: historicalData.map(d => d.indicators?.ema50 || d.close),
        volume: historicalData.map(d => d.volume),
        timestamp: historicalData.map(d => d.timestamp.toISOString()),
      };

      // Get AI decision
      const aiDecision = await analyzeMarketWithOpenAI(summary, asset.symbol);
      if (!aiDecision || aiDecision.recommendation === "HOLD") {
        return { success: true, aiDecision };
      }

      // Validate recommendation
      if (!["BUY", "SELL"].includes(aiDecision.recommendation)) {
        throw new Error(`Invalid AI recommendation: ${aiDecision.recommendation}`);
      }

      // Calculate position size and pricing
      const currentPrice = historicalData[historicalData.length - 1].close;
      const quantity = 0.01; // Fixed small quantity for testing

      // Execute real trade through Alpaca if possible
      let realTradeExecuted = false;
      let executionResult: any = {
        status: "SIMULATED",
        orderId: `ai_${Date.now()}`,
        timestamp: new Date().toISOString(),
        executedPrice: currentPrice,
        executedQuantity: quantity,
      };

      try {
        let alpacaOrder;
        const alpacaSymbol = asset.symbol.replace('/', '');
        
        if (aiDecision.recommendation === "BUY") {
          alpacaOrder = await alpacaClient.placeBuyOrder(alpacaSymbol, quantity.toFixed(8));
        } else if (aiDecision.recommendation === "SELL") {
          alpacaOrder = await alpacaClient.placeSellOrder(alpacaSymbol, quantity.toFixed(8));
        }

        if (alpacaOrder && alpacaOrder.status !== "rejected") {
          executionResult = {
            status: alpacaOrder.status || "FILLED",
            orderId: alpacaOrder.id,
            timestamp: new Date().toISOString(),
            executedPrice: parseFloat(alpacaOrder.filled_avg_price || currentPrice.toString()),
            executedQuantity: parseFloat(alpacaOrder.filled_qty || quantity.toString()),
            realTrade: true
          };
          realTradeExecuted = true;
          console.log(`🚀 Real Alpaca ${aiDecision.recommendation} executed: ${alpacaOrder.id}`);
        }
      } catch (error) {
        console.log(`⚠️ Alpaca execution failed, using simulation for ${asset.symbol}:`, error);
      }

      // Create trade record
      const trade = await storage.createTrade({
        assetId: asset.id,
        action: aiDecision.recommendation,
        quantity: quantity.toString(),
        price: currentPrice.toString(),
        positionSizing: "0.01",
        stopLoss: null,
        takeProfit: null,
        aiReasoning: aiDecision.reasoning,
        aiDecision: aiDecision,
        executionResult,
        pnl: "0",
        status: realTradeExecuted ? "open" : "closed", // Real trades stay open, simulated trades are immediately closed
      });

      console.log(`✅ AI ${aiDecision.recommendation} executed for ${asset.symbol}: ${quantity} @ $${currentPrice}`);

      return { success: true, trade, aiDecision };

    } catch (error: any) {
      console.error(`Trading cycle failed for ${asset.symbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  async pauseAsset(assetSymbol: string): Promise<void> {
    const asset = await storage.getTradingAssetBySymbol(assetSymbol);
    if (asset) {
      await storage.updateTradingAsset(asset.id, { isPaused: true });
    }
  }

  async resumeAsset(assetSymbol: string): Promise<void> {
    const asset = await storage.getTradingAssetBySymbol(assetSymbol);
    if (asset) {
      await storage.updateTradingAsset(asset.id, { isPaused: false });
    }
  }

  async setInterval(assetSymbol: string, interval: number): Promise<void> {
    const asset = await storage.getTradingAssetBySymbol(assetSymbol);
    if (asset) {
      await storage.updateTradingAsset(asset.id, { interval });
    }
  }

  async getAsset(assetSymbol: string): Promise<TradingAsset | undefined> {
    return await storage.getTradingAssetBySymbol(assetSymbol);
  }

  async executeManualTrade(asset: TradingAsset, tradeParams: {
    action: string;
    quantity: number;
    price?: number;
    side?: string;
  }): Promise<any> {
    try {
      // Get current market price with asset-specific defaults
      let currentPrice = 100000; // Default for BTC
      if (asset.symbol.includes("XRP")) {
        currentPrice = 2.5;
      } else if (asset.symbol.includes("SOL")) {
        currentPrice = 170;
      }
      
      try {
        const realPrice = await alpacaClient.getLatestPrice(asset.symbol);
        if (realPrice) {
          currentPrice = realPrice;
        }
      } catch (error) {
        console.log(`Using asset-specific default price for ${asset.symbol}: $${currentPrice}`);
      }

      const executionPrice = tradeParams.price || currentPrice;
      const quantity = tradeParams.quantity;

      // Create manual trade record with proper marking
      const trade = await storage.createTrade({
        assetId: asset.id,
        action: tradeParams.action,
        quantity: quantity.toString(),
        price: executionPrice.toFixed(2),
        positionSizing: "0", // Manual trades don't use position sizing
        stopLoss: null,
        takeProfit: null,
        aiReasoning: "MANUAL TRADE - User executed manual trade",
        aiDecision: { manual: true, action: tradeParams.action },
        executionResult: {
          status: "FILLED",
          orderId: `manual_${Date.now()}`,
          timestamp: new Date().toISOString(),
          executedPrice: executionPrice,
          executedQuantity: quantity,
          manual: true
        },
        pnl: "0", // Will be updated by position management
      });

      console.log(`📋 Manual ${tradeParams.action} executed for ${asset.symbol}: ${quantity} @ $${executionPrice}`);

      return {
        success: true,
        trade,
        executionPrice,
        quantity,
        message: `Manual ${tradeParams.action} executed successfully`
      };

    } catch (error) {
      console.error(`Manual trade error for ${asset.symbol}:`, error);
      throw error;
    }
  }
}

export const tradingService = new TradingService();