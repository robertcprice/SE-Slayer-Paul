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
  WebSocketMessage 
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

      // Get current positions
      const positions = await storage.getPositionsByAsset(asset.id);
      const openPositions = positions.filter(p => p.isOpen);

      // Get AI decision
      const aiDecision = await analyzeMarketWithOpenAI(summary, asset.symbol, openPositions, asset.id);
      console.log(`AI decision for ${asset.symbol}:`, aiDecision);

      // Execute trade based on AI decision
      let trade: Trade | undefined;
      if (aiDecision.recommendation !== "HOLD" && aiDecision.position_sizing > 0) {
        trade = await this.executeTrade(asset, aiDecision, historicalData[historicalData.length - 1]);
      } else {
        // Log the HOLD decision
        trade = await storage.createTrade({
          assetId: asset.id,
          action: "HOLD",
          quantity: "0",
          price: historicalData[historicalData.length - 1].close.toString(),
          positionSizing: aiDecision.position_sizing.toString(),
          stopLoss: aiDecision.stop_loss?.toString(),
          takeProfit: aiDecision.take_profit?.toString(),
          aiReasoning: aiDecision.reasoning,
          aiDecision: aiDecision,
          executionResult: { status: "HOLD", message: "No trade executed" },
          pnl: "0",
        });
      }

      // Calculate current stats
      const stats = await storage.calculateStats(asset.id);

      // Check if we need to generate a reflection
      let reflection: { reflection: string; improvements: string } | undefined;
      const lastReflectionCount = this.lastReflectionTrades.get(asset.id) || 0;
      const currentTradeCount = stats.totalTrades;
      
      if (currentTradeCount >= lastReflectionCount + 10 && currentTradeCount > 0) {
        const recentTrades = await storage.getTradesByAsset(asset.id, 10);
        reflection = await generateReflection(asset.symbol, recentTrades, stats);
        
        await storage.createReflection({
          assetId: asset.id,
          reflection: reflection.reflection,
          improvements: reflection.improvements,
          summary: { stats, recentTrades: recentTrades.length },
        });
        
        this.lastReflectionTrades.set(asset.id, currentTradeCount);
      }

      return {
        success: true,
        trade,
        aiDecision,
        stats,
        reflection,
      };

    } catch (error) {
      console.error(`Trading cycle error for ${asset.symbol}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async executeTrade(asset: TradingAsset, aiDecision: any, latestData: any): Promise<Trade> {
    // Get real current price from Alpaca
    let currentPrice = latestData.close;
    try {
      const realPrice = await alpacaClient.getLatestPrice(asset.symbol);
      if (realPrice) {
        currentPrice = realPrice;
      }
    } catch (error) {
      console.error(`Failed to get latest price for ${asset.symbol}, using historical:`, error);
    }

    // Get account equity from Alpaca
    let accountEquity = 10000; // Default fallback
    try {
      const account = await alpacaClient.getAccount();
      accountEquity = parseFloat(account.equity);
    } catch (error) {
      console.error('Failed to get account equity:', error);
    }

    const positionValue = accountEquity * (aiDecision.position_sizing / 100);
    const quantity = positionValue / currentPrice;

    // Execute real trade through Alpaca
    let executionResult: any = {
      status: "FAILED",
      executedQuantity: 0,
      executedPrice: currentPrice,
      timestamp: new Date().toISOString(),
    };

    try {
      let order;
      if (aiDecision.recommendation === "BUY") {
        order = await alpacaClient.placeBuyOrder(asset.symbol, quantity.toFixed(8));
      } else if (aiDecision.recommendation === "SELL") {
        order = await alpacaClient.placeSellOrder(asset.symbol, quantity.toFixed(8));
      }

      if (order) {
        executionResult = {
          status: order.status || "SUBMITTED",
          executedQuantity: parseFloat(order.filled_qty || "0"),
          executedPrice: parseFloat(order.filled_avg_price || currentPrice.toString()),
          timestamp: new Date().toISOString(),
          orderId: order.id,
        };
      }
    } catch (error) {
      console.error(`Failed to execute ${aiDecision.recommendation} order for ${asset.symbol}:`, error);
      // Continue with simulated trade for logging purposes
    }

    // Calculate P&L based on execution
    const realPnl = executionResult.status === "FILLED" ? 
      (executionResult.executedPrice - currentPrice) * executionResult.executedQuantity : 0;

    // Create trade record
    const trade = await storage.createTrade({
      assetId: asset.id,
      action: aiDecision.recommendation,
      quantity: quantity.toFixed(8),
      price: currentPrice.toFixed(2),
      positionSizing: aiDecision.position_sizing.toString(),
      stopLoss: aiDecision.stop_loss?.toString(),
      takeProfit: aiDecision.take_profit?.toString(),
      aiReasoning: aiDecision.reasoning,
      aiDecision: aiDecision,
      executionResult: executionResult,
      pnl: realPnl.toFixed(2),
    });

    // Update or create position
    const existingPositions = await storage.getPositionsByAsset(asset.id);
    const openPosition = existingPositions.find(p => p.isOpen);

    if (openPosition) {
      // Update existing position
      await storage.updatePosition(openPosition.id, {
        quantity: (parseFloat(openPosition.quantity || "0") + quantity).toString(),
        unrealizedPnl: realPnl.toString(),
      });
    } else {
      // Create new position
      await storage.createPosition({
        assetId: asset.id,
        symbol: asset.symbol,
        side: aiDecision.recommendation === "BUY" ? "long" : "short",
        quantity: quantity.toString(),
        avgEntryPrice: currentPrice.toString(),
        unrealizedPnl: "0",
        isOpen: true,
      });
    }

    return trade;
  }

  async getDashboardData(assetSymbol: string): Promise<{
    stats: DashboardStats;
    chart: ChartData;
    positions: Position[];
    feed: TradeFeed[];
    reflection?: { reflection: string; improvements: string };
  }> {
    const asset = await storage.getTradingAssetBySymbol(assetSymbol);
    if (!asset) {
      throw new Error(`Asset ${assetSymbol} not found`);
    }

    // Get stats from database
    const stats = await storage.calculateStats(asset.id);

    // Get real market data from Alpaca
    let chart: ChartData = { dates: [], close: [], volume: [] };
    try {
      const alpacaData = await alpacaClient.getMarketData(assetSymbol, '1Min', 50);
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

    // Get real positions from Alpaca
    let positions: Position[] = [];
    try {
      const alpacaPositions = await alpacaClient.getPositions();
      const assetPositions = alpacaPositions.filter(p => p.symbol === assetSymbol.replace('/', ''));
      
      if (assetPositions.length > 0) {
        positions = assetPositions.map(pos => ({
          id: `alpaca-${pos.symbol}`,
          openedAt: new Date(),
          assetId: asset.id,
          symbol: assetSymbol,
          side: pos.side,
          quantity: pos.qty,
          avgEntryPrice: (parseFloat(pos.cost_basis) / parseFloat(pos.qty)).toString(),
          unrealizedPnl: pos.unrealized_pl,
          isOpen: true,
          closedAt: null,
        }));
      } else {
        // Fallback to stored positions
        positions = await storage.getPositionsByAsset(asset.id);
      }
    } catch (error) {
      console.error(`Failed to get real positions for ${assetSymbol}:`, error);
      // Fallback to stored positions
      positions = await storage.getPositionsByAsset(asset.id);
    }

    // Get recent trades for feed
    const recentTrades = await storage.getTradesByAsset(asset.id, 10);
    const feed: TradeFeed[] = recentTrades.map(trade => ({
      timestamp: trade.timestamp?.toISOString() || '',
      action: trade.action || '',
      quantity: trade.quantity || '0',
      price: trade.price || '0',
      aiReasoning: trade.aiReasoning || '',
      pnl: parseFloat(trade.pnl || "0"),
    }));

    // Get latest reflection
    const latestReflection = await storage.getLatestReflection(asset.id);
    const reflection = latestReflection ? {
      reflection: latestReflection.reflection || '',
      improvements: latestReflection.improvements || '',
    } : undefined;

    return { stats, chart, positions, feed, reflection };
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
}
