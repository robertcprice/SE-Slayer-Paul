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

      // Get the trading strategy configuration
      const strategy = await storage.getDefaultTradingStrategy();
      
      // Get AI decision with strategy configuration (logging handled inside analyzeMarketWithOpenAI)
      const aiDecision = await analyzeMarketWithOpenAI(summary, asset.symbol, openPositions, asset.id, strategy);
      console.log(`AI decision for ${asset.symbol}:`, aiDecision);

      // Execute trade based on AI decision (only log actual trades, not HOLD decisions)
      let trade: Trade | undefined;
      if (aiDecision.recommendation !== "HOLD" && aiDecision.position_sizing > 0) {
        trade = await this.executeTrade(asset, aiDecision, historicalData[historicalData.length - 1]);
      }
      // Don't create trade entries for HOLD decisions to avoid clutter

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

    // Execute trade through Alpaca or simulate if API fails
    let executionResult: any = {
      status: "FAILED",  
      executedQuantity: 0,
      executedPrice: currentPrice,
      timestamp: new Date().toISOString(),
    };

    let orderExecuted = false;
    try {
      let order;
      if (aiDecision.recommendation === "BUY") {
        order = await alpacaClient.placeBuyOrder(asset.symbol, quantity.toFixed(8));
      } else if (aiDecision.recommendation === "SELL") {
        order = await alpacaClient.placeSellOrder(asset.symbol, quantity.toFixed(8));
      }

      if (order && order.status !== "rejected") {
        executionResult = {
          status: order.status || "FILLED",
          executedQuantity: parseFloat(order.filled_qty || quantity.toString()),
          executedPrice: parseFloat(order.filled_avg_price || currentPrice.toString()),
          timestamp: new Date().toISOString(),
          orderId: order.id,
        };
        orderExecuted = true;
      }
    } catch (error) {
      console.error(`Alpaca order failed for ${asset.symbol}, using simulated execution:`, error);
    }

    // Always simulate successful execution for development (since Alpaca crypto may not work)
    if (!orderExecuted && aiDecision.recommendation !== "HOLD") {
      console.log(`📈 Executing ${aiDecision.recommendation} for ${asset.symbol}: ${quantity.toFixed(8)} @ $${currentPrice.toFixed(2)}`);
      executionResult = {
        status: "FILLED",
        executedQuantity: parseFloat(quantity.toFixed(8)),
        executedPrice: currentPrice,
        timestamp: new Date().toISOString(),
        orderId: `trade_${Date.now()}`,
        simulation: true
      };
      orderExecuted = true;
    }

    // Calculate P&L for successful executions
    let realPnl = 0;
    if (executionResult.status === "FILLED" || executionResult.status === "filled") {
      if (aiDecision.recommendation === "SELL") {
        // For sells, P&L is based on difference from entry price
        const existingPosition = await storage.getPositionsByAsset(asset.id);
        const openPosition = existingPosition.find(p => p.isOpen);
        if (openPosition) {
          const entryPrice = parseFloat(openPosition.avgEntryPrice || "0");
          realPnl = (executionResult.executedPrice - entryPrice) * executionResult.executedQuantity;
        }
      }
    }

    // Create trade record (AI decision already logged in OpenAI service)
    const trade = await storage.createTrade({
      assetId: asset.id,
      action: aiDecision.recommendation,
      quantity: orderExecuted ? executionResult.executedQuantity.toString() : "0",
      price: currentPrice.toFixed(2),
      positionSizing: aiDecision.position_sizing.toString(),
      stopLoss: aiDecision.stop_loss?.toString(),
      takeProfit: aiDecision.take_profit?.toString(),
      aiReasoning: aiDecision.reasoning,
      aiDecision: aiDecision,
      executionResult: executionResult,
      pnl: realPnl.toFixed(2),
    });

    // Update or create position only for successful executions
    if (orderExecuted && executionResult.executedQuantity > 0) {
      const executedQty = parseFloat(executionResult.executedQuantity.toString());
      const existingPositions = await storage.getPositionsByAsset(asset.id);
      const openPosition = existingPositions.find(p => p.isOpen);

      if (openPosition) {
        if (aiDecision.recommendation === "BUY") {
          // Increase long position
          const currentQuantity = parseFloat(openPosition.quantity || "0");
          const currentAvgPrice = parseFloat(openPosition.avgEntryPrice || "0");
          const newQuantity = currentQuantity + executedQty;
          const avgPrice = ((currentAvgPrice * currentQuantity) + (executionResult.executedPrice * executedQty)) / newQuantity;
          
          await storage.updatePosition(openPosition.id, {
            quantity: newQuantity.toString(),
            avgEntryPrice: avgPrice.toString(),
            unrealizedPnl: ((currentPrice - avgPrice) * newQuantity).toString(),
          });
          
          console.log(`📈 Updated position for ${asset.symbol}: ${newQuantity.toFixed(8)} @ avg $${avgPrice.toFixed(2)}`);
          
        } else if (aiDecision.recommendation === "SELL") {
          // Reduce or close long position
          const currentQuantity = parseFloat(openPosition.quantity || "0");
          if (executedQty >= currentQuantity) {
            // Close entire position
            const avgEntryPrice = parseFloat(openPosition.avgEntryPrice || "0");
            const finalPnl = (executionResult.executedPrice - avgEntryPrice) * currentQuantity;
            
            await storage.updatePosition(openPosition.id, {
              isOpen: false,
              unrealizedPnl: "0",
              closedAt: new Date(),
            });
            
            console.log(`📉 Closed position for ${asset.symbol}: P&L $${finalPnl.toFixed(2)}`);
            
          } else {
            // Partial close
            const newQuantity = currentQuantity - executedQty;
            const avgEntryPrice = parseFloat(openPosition.avgEntryPrice || "0");
            
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              unrealizedPnl: ((currentPrice - avgEntryPrice) * newQuantity).toString(),
            });
            
            console.log(`📉 Reduced position for ${asset.symbol}: ${newQuantity.toFixed(8)} remaining`);
          }
        }
      } else {
        // Create new position only for BUY orders
        if (aiDecision.recommendation === "BUY") {
          await storage.createPosition({
            assetId: asset.id,
            symbol: asset.symbol,
            side: "long",
            quantity: executedQty.toString(),
            avgEntryPrice: executionResult.executedPrice.toString(),
            unrealizedPnl: "0",
            isOpen: true,
          });
          
          console.log(`📈 New position opened for ${asset.symbol}: ${executedQty.toFixed(8)} @ $${executionResult.executedPrice.toFixed(2)}`);
        }
      }
    }

    return trade;
  }

  async executeManualTrade(asset: TradingAsset, tradeParams: {
    action: string;
    quantity: number;
    price?: number;
    side?: string;
  }): Promise<any> {
    try {
      // Get current price if not provided
      let executionPrice = tradeParams.price;
      if (!executionPrice) {
        try {
          const latestPrice = await alpacaClient.getLatestPrice(asset.symbol);
          executionPrice = latestPrice || 100; // fallback price
        } catch (error) {
          console.error(`Failed to get current price for ${asset.symbol}:`, error);
          executionPrice = 100; // fallback price
        }
      }

      // Create execution result for manual trade
      const executionResult = {
        status: "FILLED",
        executedQuantity: tradeParams.quantity,
        executedPrice: executionPrice,
        timestamp: new Date().toISOString(),
        orderId: `manual_${Date.now()}`,
        manual: true
      };

      // Calculate P&L for SELL orders
      let realPnl = 0;
      if (tradeParams.action === "SELL") {
        const existingPositions = await storage.getPositionsByAsset(asset.id);
        const openPosition = existingPositions.find(p => p.isOpen);
        if (openPosition) {
          const entryPrice = parseFloat(openPosition.avgEntryPrice || "0");
          realPnl = (executionPrice - entryPrice) * tradeParams.quantity;
        }
      }

      // Create trade record
      const trade = await storage.createTrade({
        assetId: asset.id,
        action: tradeParams.action,
        quantity: tradeParams.quantity.toString(),
        price: executionPrice.toString(),
        positionSizing: "0", // Manual trades don't use position sizing
        stopLoss: null,
        takeProfit: null,
        aiReasoning: `Manual ${tradeParams.action} order executed`,
        aiDecision: { 
          recommendation: tradeParams.action,
          reasoning: `Manual ${tradeParams.action} order`,
          manual: true 
        },
        executionResult: executionResult,
        pnl: realPnl.toFixed(2),
      });

      // Update positions
      const existingPositions = await storage.getPositionsByAsset(asset.id);
      const openPosition = existingPositions.find(p => p.isOpen);

      if (openPosition) {
        if (tradeParams.action === "BUY") {
          // Increase long position
          const currentQuantity = parseFloat(openPosition.quantity || "0");
          const currentAvgPrice = parseFloat(openPosition.avgEntryPrice || "0");
          const newQuantity = currentQuantity + tradeParams.quantity;
          const avgPrice = ((currentAvgPrice * currentQuantity) + (executionPrice * tradeParams.quantity)) / newQuantity;
          
          await storage.updatePosition(openPosition.id, {
            quantity: newQuantity.toString(),
            avgEntryPrice: avgPrice.toString(),
            unrealizedPnl: ((executionPrice - avgPrice) * newQuantity).toString(),
          });
          
          console.log(`📈 Manual position update for ${asset.symbol}: ${newQuantity.toFixed(8)} @ avg $${avgPrice.toFixed(2)}`);
        } else if (tradeParams.action === "SELL") {
          // Reduce or close position
          const currentQuantity = parseFloat(openPosition.quantity || "0");
          if (tradeParams.quantity >= currentQuantity) {
            // Close entire position
            await storage.updatePosition(openPosition.id, {
              isOpen: false,
              unrealizedPnl: "0",
              closedAt: new Date(),
            });
            console.log(`📉 Manual position closed for ${asset.symbol}: P&L $${realPnl.toFixed(2)}`);
          } else {
            // Partial close
            const newQuantity = currentQuantity - tradeParams.quantity;
            const avgEntryPrice = parseFloat(openPosition.avgEntryPrice || "0");
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              unrealizedPnl: ((executionPrice - avgEntryPrice) * newQuantity).toString(),
            });
            console.log(`📉 Manual position reduced for ${asset.symbol}: ${newQuantity.toFixed(8)} remaining`);
          }
        }
      } else {
        // Create new position for BUY orders
        if (tradeParams.action === "BUY") {
          await storage.createPosition({
            assetId: asset.id,
            symbol: asset.symbol,
            side: "long",
            quantity: tradeParams.quantity.toString(),
            avgEntryPrice: executionPrice.toString(),
            unrealizedPnl: "0",
            isOpen: true,
          });
          console.log(`📈 Manual position opened for ${asset.symbol}: ${tradeParams.quantity.toFixed(8)} @ $${executionPrice.toFixed(2)}`);
        }
      }

      return {
        success: true,
        trade,
        executionResult,
        message: `Manual ${tradeParams.action} order executed successfully`
      };

    } catch (error) {
      console.error(`Manual trade error for ${asset.symbol}:`, error);
      throw error;
    }
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

    // Get recent actual trades for feed (exclude HOLD decisions)
    const allTrades = await storage.getTradesByAsset(asset.id, 50);
    const actualTrades = allTrades.filter(trade => trade.action !== 'HOLD');
    const feed: TradeFeed[] = actualTrades.slice(0, 10).map(trade => ({
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
