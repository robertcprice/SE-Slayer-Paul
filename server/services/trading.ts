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

    // DO NOT simulate trades - only use real Alpaca executions
    if (!orderExecuted && aiDecision.recommendation !== "HOLD") {
      console.log(`⚠️ AI recommendation ${aiDecision.recommendation} for ${asset.symbol} not executed - real Alpaca API only`);
      // Do not create fake simulated trades
    }

    // Calculate P&L for successful executions
    let realPnl = 0;
    if (orderExecuted && executionResult.executedQuantity > 0) {
      const existingPositions = await storage.getPositionsByAsset(asset.id);
      const openPosition = existingPositions.find(p => p.isOpen);
      
      if (openPosition && aiDecision.recommendation === "SELL") {
        // Calculate realized P&L for closing trades
        const entryPrice = parseFloat(openPosition.avgEntryPrice || "0");
        const positionSide = openPosition.side;
        
        if (positionSide === "long") {
          realPnl = (executionResult.executedPrice - entryPrice) * Math.min(executionResult.executedQuantity, parseFloat(openPosition.quantity || "0"));
        } else {
          realPnl = (entryPrice - executionResult.executedPrice) * Math.min(executionResult.executedQuantity, parseFloat(openPosition.quantity || "0"));
        }
      } else if (openPosition && aiDecision.recommendation === "BUY" && openPosition.side === "short") {
        // Closing short position with buy
        const entryPrice = parseFloat(openPosition.avgEntryPrice || "0");
        realPnl = (entryPrice - executionResult.executedPrice) * Math.min(executionResult.executedQuantity, parseFloat(openPosition.quantity || "0"));
      }
    }

    // CRITICAL FIX: Ensure asset-specific price is used - prevent price contamination  
    let finalTradePrice = currentPrice;
    if (orderExecuted && executionResult.executedPrice > 0) {
      // Validate executed price against asset-specific ranges
      const executedPrice = executionResult.executedPrice;
      const assetSymbol = asset.symbol;
      
      if (assetSymbol.includes("XRP") && (executedPrice < 0.5 || executedPrice > 10)) {
        console.log(`🚨 Price contamination detected for XRP: $${executedPrice} - using current price $${currentPrice}`);
        finalTradePrice = currentPrice;
      } else if (assetSymbol.includes("SOL") && (executedPrice < 50 || executedPrice > 300)) {
        console.log(`🚨 Price contamination detected for SOL: $${executedPrice} - using current price $${currentPrice}`);
        finalTradePrice = currentPrice;
      } else if (assetSymbol.includes("BTC") && (executedPrice < 90000 || executedPrice > 130000)) {
        console.log(`🚨 Price contamination detected for BTC: $${executedPrice} - using current price $${currentPrice}`);
        finalTradePrice = currentPrice;
      } else {
        finalTradePrice = executedPrice; // Use valid executed price
      }
    }

    // DO NOT create fake trade records - only log AI decisions
    console.log(`🤖 AI Decision for ${asset.symbol}: ${aiDecision.recommendation} (not executed as fake trade)`);
    
    // Create minimal trade record only for logging AI decisions, not fake executions
    const trade = await storage.createTrade({
      assetId: asset.id,
      action: "HOLD", // Mark as HOLD to avoid showing fake executions
      quantity: "0",
      price: "0",
      positionSizing: aiDecision.position_sizing.toString(),
      stopLoss: aiDecision.stop_loss?.toString(),
      takeProfit: aiDecision.take_profit?.toString(),
      aiReasoning: `AI DECISION: ${aiDecision.recommendation} - ${aiDecision.reasoning}`,
      aiDecision: aiDecision,
      executionResult: null,
      pnl: "0",
    });

    // DO NOT create internal positions - only use real Alpaca positions
    if (false) { // Disabled - no internal position management
      const executedQty = parseFloat(executionResult.executedQuantity.toString());
      const existingPositions = await storage.getPositionsByAsset(asset.id);
      const openPosition = existingPositions.find(p => p.isOpen);

      if (openPosition) {
        const currentQuantity = parseFloat(openPosition.quantity || "0");
        const currentSide = openPosition.side;
        const avgEntryPrice = parseFloat(openPosition.avgEntryPrice || "0");

        if (currentSide === "long") {
          if (aiDecision.recommendation === "BUY") {
            // Increase long position - use validated price
            const newQuantity = currentQuantity + executedQty;
            const newAvgPrice = ((avgEntryPrice * currentQuantity) + (finalTradePrice * executedQty)) / newQuantity;
            
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              avgEntryPrice: newAvgPrice.toString(),
              unrealizedPnl: ((currentPrice - newAvgPrice) * newQuantity).toString(),
            });
            
            console.log(`📈 Increased LONG position for ${asset.symbol}: ${newQuantity.toFixed(8)} @ avg $${newAvgPrice.toFixed(2)}`);
            
          } else if (aiDecision.recommendation === "SELL") {
            if (executedQty >= currentQuantity) {
              // Close long position and potentially open short - use validated price
              const finalPnl = (finalTradePrice - avgEntryPrice) * currentQuantity;
              
              await storage.updatePosition(openPosition.id, {
                isOpen: false,
                unrealizedPnl: finalPnl.toString(), // Store realized P&L when closing
                closedAt: new Date(),
              });
              
              // Update the current trade's P&L to reflect the realized P&L
              await storage.updateTradePnL(trade.id, finalPnl);
              console.log(`📉 Closed LONG position for ${asset.symbol}: P&L $${finalPnl.toFixed(2)}`);
              
              // If sell quantity exceeds long position, open short with remaining
              const remainingQty = executedQty - currentQuantity;
              if (remainingQty > 0) {
                await storage.createPosition({
                  assetId: asset.id,
                  symbol: asset.symbol,
                  side: "short",
                  quantity: remainingQty.toString(),
                  avgEntryPrice: finalTradePrice.toString(), // Use validated price
                  unrealizedPnl: "0",
                  isOpen: true,
                });
                
                console.log(`📉 Opened SHORT position for ${asset.symbol}: ${remainingQty.toFixed(8)} @ $${finalTradePrice.toFixed(2)}`);
              }
            } else {
              // Partial close of long position
              const newQuantity = currentQuantity - executedQty;
              
              await storage.updatePosition(openPosition.id, {
                quantity: newQuantity.toString(),
                unrealizedPnl: ((currentPrice - avgEntryPrice) * newQuantity).toString(),
              });
              
              console.log(`📉 Reduced LONG position for ${asset.symbol}: ${newQuantity.toFixed(8)} remaining`);
            }
          }
        } else if (currentSide === "short") {
          if (aiDecision.recommendation === "SELL") {
            // Increase short position - use validated price
            const newQuantity = currentQuantity + executedQty;
            const newAvgPrice = ((avgEntryPrice * currentQuantity) + (finalTradePrice * executedQty)) / newQuantity;
            
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              avgEntryPrice: newAvgPrice.toString(),
              unrealizedPnl: ((newAvgPrice - currentPrice) * newQuantity).toString(), // Inverted for shorts
            });
            
            console.log(`📉 Increased SHORT position for ${asset.symbol}: ${newQuantity.toFixed(8)} @ avg $${newAvgPrice.toFixed(2)}`);
            
          } else if (aiDecision.recommendation === "BUY") {
            if (executedQty >= currentQuantity) {
              // Close short position and potentially open long - use validated price
              const finalPnl = (avgEntryPrice - finalTradePrice) * currentQuantity; // Inverted for shorts
              
              await storage.updatePosition(openPosition.id, {
                isOpen: false,
                unrealizedPnl: finalPnl.toString(), // Store realized P&L when closing
                closedAt: new Date(),
              });
              
              // Update the current trade's P&L to reflect the realized P&L
              await storage.updateTradePnL(trade.id, finalPnl);
              console.log(`📈 Closed SHORT position for ${asset.symbol}: P&L $${finalPnl.toFixed(2)}`);
              
              // If buy quantity exceeds short position, open long with remaining
              const remainingQty = executedQty - currentQuantity;
              if (remainingQty > 0) {
                await storage.createPosition({
                  assetId: asset.id,
                  symbol: asset.symbol,
                  side: "long",
                  quantity: remainingQty.toString(),
                  avgEntryPrice: finalTradePrice.toString(), // Use validated price
                  unrealizedPnl: "0",
                  isOpen: true,
                });
                
                console.log(`📈 Opened LONG position for ${asset.symbol}: ${remainingQty.toFixed(8)} @ $${finalTradePrice.toFixed(2)}`);
              }
            } else {
              // Partial close of short position
              const newQuantity = currentQuantity - executedQty;
              
              await storage.updatePosition(openPosition.id, {
                quantity: newQuantity.toString(),
                unrealizedPnl: ((avgEntryPrice - currentPrice) * newQuantity).toString(), // Inverted for shorts
              });
              
              console.log(`📈 Reduced SHORT position for ${asset.symbol}: ${newQuantity.toFixed(8)} remaining`);
            }
          }
        }
      } else {
        // Create new position for both BUY and SELL orders
        const positionSide = aiDecision.recommendation === "BUY" ? "long" : "short";
        const unrealizedPnl = positionSide === "long" 
          ? ((currentPrice - executionResult.executedPrice) * executedQty).toString()
          : ((executionResult.executedPrice - currentPrice) * executedQty).toString();
        
        await storage.createPosition({
          assetId: asset.id,
          symbol: asset.symbol,
          side: positionSide,
          quantity: executedQty.toString(),
          avgEntryPrice: finalTradePrice.toString(), // Use validated price
          unrealizedPnl: "0", // Start at 0, will be updated by periodic calculations
          isOpen: true,
        });
        
        const direction = positionSide === "long" ? "📈 LONG" : "📉 SHORT";
        console.log(`${direction} position opened for ${asset.symbol}: ${executedQty.toFixed(8)} @ $${finalTradePrice.toFixed(2)}`);
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

      // Calculate P&L for closing trades
      let realPnl = 0;
      const existingPositions = await storage.getPositionsByAsset(asset.id);
      const openPosition = existingPositions.find(p => p.isOpen);
      
      if (openPosition) {
        const entryPrice = parseFloat(openPosition.avgEntryPrice || "0");
        const positionSide = openPosition.side;
        const positionQty = parseFloat(openPosition.quantity || "0");
        const tradeQty = Math.min(tradeParams.quantity, positionQty);
        
        if (tradeParams.action === "SELL" && positionSide === "long") {
          // Closing long position
          realPnl = (executionPrice - entryPrice) * tradeQty;
        } else if (tradeParams.action === "BUY" && positionSide === "short") {
          // Closing short position
          realPnl = (entryPrice - executionPrice) * tradeQty;
        }
      }

      // Create trade record with MANUAL marking
      const trade = await storage.createTrade({
        assetId: asset.id,
        action: tradeParams.action,
        quantity: tradeParams.quantity.toString(),
        price: executionPrice.toString(),
        positionSizing: "0", // Manual trades don't use position sizing
        stopLoss: null,
        takeProfit: null,
        aiReasoning: `MANUAL: ${tradeParams.action} order executed by user`,
        aiDecision: { 
          recommendation: tradeParams.action,
          reasoning: `MANUAL ${tradeParams.action} order`,
          manual: true 
        },
        executionResult: executionResult,
        pnl: realPnl.toString(),
      });

      // Update positions (reuse variables from P&L calculation)
      // existingPositions and openPosition already declared above

      if (openPosition) {
        if (tradeParams.action === "BUY") {
          // Increase long position
          const currentQuantity = parseFloat(openPosition.quantity || "0");
          const currentAvgPrice = parseFloat(openPosition.avgEntryPrice || "0");
          const newQuantity = currentQuantity + tradeParams.quantity;
          const avgPrice = ((currentAvgPrice * currentQuantity) + (executionPrice * tradeParams.quantity)) / newQuantity;
          
          // Calculate unrealized P&L based on current market price vs avg entry price
          const currentMarketPrice = executionPrice; // Use latest execution price as market price
          const unrealizedPnl = (currentMarketPrice - avgPrice) * newQuantity;
          
          await storage.updatePosition(openPosition.id, {
            quantity: newQuantity.toString(),
            avgEntryPrice: avgPrice.toString(),
            unrealizedPnl: unrealizedPnl.toString(),
          });
          
          console.log(`📈 Manual position update for ${asset.symbol}: ${newQuantity.toFixed(8)} @ avg $${avgPrice.toFixed(2)}`);
        } else if (tradeParams.action === "SELL") {
          // Reduce or close position
          const currentQuantity = parseFloat(openPosition.quantity || "0");
          if (tradeParams.quantity >= currentQuantity) {
            // Close entire position - store final P&L in position
            const finalPnl = (executionPrice - parseFloat(openPosition.avgEntryPrice || "0")) * currentQuantity;
            await storage.updatePosition(openPosition.id, {
              isOpen: false,
              unrealizedPnl: finalPnl.toString(), // Store realized P&L when closing
              closedAt: new Date(),
            });
            
            // Update the most recent trade's P&L to reflect the realized P&L
            await storage.updateMostRecentTradePnL(asset.id, finalPnl);
            console.log(`📉 Manual position closed for ${asset.symbol}: P&L $${finalPnl.toFixed(2)}`);
          } else {
            // Partial close
            const newQuantity = currentQuantity - tradeParams.quantity;
            const avgEntryPrice = parseFloat(openPosition.avgEntryPrice || "0");
            const unrealizedPnl = (executionPrice - avgEntryPrice) * newQuantity;
            
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              unrealizedPnl: unrealizedPnl.toString(),
            });
            console.log(`📉 Manual position reduced for ${asset.symbol}: ${newQuantity.toFixed(8)} remaining (P&L: $${unrealizedPnl.toFixed(2)})`);
          }
        }
      } else {
        // Create new position for both BUY and SELL orders
        const positionSide = tradeParams.action === "BUY" ? "long" : "short";
        
        await storage.createPosition({
          assetId: asset.id,
          symbol: asset.symbol,
          side: positionSide,
          quantity: tradeParams.quantity.toString(),
          avgEntryPrice: executionPrice.toString(),
          unrealizedPnl: "0", // New positions start with 0 P&L
          isOpen: true,
        });
        
        const direction = positionSide === "long" ? "📈 LONG" : "📉 SHORT";
        console.log(`Manual ${direction} position opened for ${asset.symbol}: ${tradeParams.quantity.toFixed(8)} @ $${executionPrice.toFixed(2)}`);
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

    // Get ONLY real positions from Alpaca API - direct feed
    let positions: Position[] = [];
    try {
      const alpacaPositions = await alpacaClient.getPositions();
      const assetPositions = alpacaPositions.filter(p => p.symbol === assetSymbol.replace('/', ''));
      
      if (assetPositions.length > 0) {
        positions = assetPositions.map(pos => {
          // Use real Alpaca P&L directly instead of calculating
          const realPnl = parseFloat(pos.unrealized_pl || "0");
          
          console.log(`📊 Real Alpaca position for ${assetSymbol}: ${pos.qty} @ $${pos.avg_entry_price}, P&L: $${realPnl.toFixed(2)}`);
          
          return {
            id: `alpaca-${pos.symbol}`,
            openedAt: new Date(),
            assetId: asset.id,
            symbol: assetSymbol,
            side: pos.side,
            quantity: pos.qty,
            avgEntryPrice: pos.avg_entry_price,
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
          const coinbasePrice = await getCoinbasePrice("bitcoin");
          if (coinbasePrice) {
            currentPrice = coinbasePrice;
            console.log(`💰 Using Coinbase API for ${assetSymbol}: $${currentPrice}`);
          }
        } else if (assetSymbol.includes("SOL")) {
          const cryptoComparePrice = await getCryptoComparePrice("SOL");
          if (cryptoComparePrice) {
            currentPrice = cryptoComparePrice;
            console.log(`💰 Using CryptoCompare API for ${assetSymbol}: $${currentPrice}`);
          }
        }
      } catch (backupError) {
        console.log(`⚠️ Backup price sources failed for ${assetSymbol}, using fallback: $${currentPrice}`);
      }
    }

    // DON'T recalculate P&L - use REAL Alpaca values only!
    // Positions already have the correct unrealized_pl from Alpaca API

    // CRITICAL FIX: Calculate REAL stats from REAL Alpaca positions only
    if (positions.length > 0) {
      // Calculate total P&L from real Alpaca positions
      const totalRealPnl = positions.reduce((sum, pos) => {
        return sum + parseFloat(pos.unrealizedPnl || "0");
      }, 0);
      
      stats.totalPnl = totalRealPnl;
      console.log(`📊 Real total P&L for ${assetSymbol}: $${totalRealPnl.toFixed(2)}`);
    }

    // Get ONLY real trades from Alpaca API - no fake internal trades
    const actualTrades: any[] = []; // Remove fake trades completely
    
    // NO fake trade feed - only show real Alpaca trades
    const feed: TradeFeed[] = [];

    // Get latest reflection
    const latestReflection = await storage.getLatestReflection(asset.id);
    const reflection = latestReflection ? {
      reflection: latestReflection.reflection || '',
      improvements: latestReflection.improvements || '',
    } : undefined;

    // Get account balance from Alpaca
    let accountBalance: AccountBalance | undefined;
    try {
      const account = await alpacaClient.getAccount();
      accountBalance = {
        equity: account.equity || "0",
        cash: account.cash || "0", 
        buyingPower: account.buying_power || "0",
        dayTradeCount: account.day_trade_count || 0,
        status: account.status || "UNKNOWN"
      };
      console.log(`💰 Account Balance: $${accountBalance.equity} equity, $${accountBalance.cash} cash`);
    } catch (error) {
      console.error(`Failed to get account balance:`, error);
      // Provide fallback demo balance when Alpaca is not accessible
      accountBalance = {
        equity: "100000.00",
        cash: "100000.00",
        buyingPower: "400000.00", 
        dayTradeCount: 0,
        status: "DEMO"
      };
    }

    // Record P&L snapshot for historical tracking (if we have current price)
    try {
      if (chart.close && chart.close.length > 0) {
        const currentPrice = chart.close[chart.close.length - 1];
        if (currentPrice && currentPrice > 0) {
          // Record P&L snapshot in background (don't wait for completion)
          storage.recordPnlSnapshot(asset.id, currentPrice).catch(error => 
            console.error(`Failed to record P&L snapshot for ${assetSymbol}:`, error)
          );
        }
      }
    } catch (error) {
      console.error(`Error recording P&L snapshot for ${assetSymbol}:`, error);
    }

    return { stats, chart, positions, feed, reflection, accountBalance };
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

      // Update positions for manual trades
      await this.updatePositionForTrade(asset, tradeParams.action, quantity, executionPrice, currentPrice);

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

  private async updatePositionForTrade(asset: TradingAsset, action: string, quantity: number, executionPrice: number, currentPrice: number): Promise<void> {
    const existingPositions = await storage.getPositionsByAsset(asset.id);
    const openPosition = existingPositions.find(p => p.isOpen);

    if (openPosition) {
      const currentQuantity = parseFloat(openPosition.quantity || "0");
      const currentSide = openPosition.side;
      const avgEntryPrice = parseFloat(openPosition.avgEntryPrice || "0");

      if (currentSide === "long") {
        if (action === "BUY") {
          // Increase long position
          const newQuantity = currentQuantity + quantity;
          const newAvgPrice = ((avgEntryPrice * currentQuantity) + (executionPrice * quantity)) / newQuantity;
          
          await storage.updatePosition(openPosition.id, {
            quantity: newQuantity.toString(),
            avgEntryPrice: newAvgPrice.toString(),
            unrealizedPnl: ((currentPrice - newAvgPrice) * newQuantity).toString(),
          });
          
        } else if (action === "SELL") {
          if (quantity >= currentQuantity) {
            // Close long position and potentially open short
            await storage.updatePosition(openPosition.id, {
              isOpen: false,
              unrealizedPnl: "0",
              closedAt: new Date(),
            });
            
            // If sell quantity exceeds long position, open short with remaining
            const remainingQty = quantity - currentQuantity;
            if (remainingQty > 0) {
              await storage.createPosition({
                assetId: asset.id,
                symbol: asset.symbol,
                side: "short",
                quantity: remainingQty.toString(),
                avgEntryPrice: executionPrice.toString(),
                unrealizedPnl: ((avgEntryPrice - currentPrice) * remainingQty).toString(),
                isOpen: true,
              });
            }
          } else {
            // Partial close of long position
            const newQuantity = currentQuantity - quantity;
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              unrealizedPnl: ((currentPrice - avgEntryPrice) * newQuantity).toString(),
            });
          }
        }
      } else if (currentSide === "short") {
        if (action === "SELL") {
          // Increase short position
          const newQuantity = currentQuantity + quantity;
          const newAvgPrice = ((avgEntryPrice * currentQuantity) + (executionPrice * quantity)) / newQuantity;
          
          await storage.updatePosition(openPosition.id, {
            quantity: newQuantity.toString(),
            avgEntryPrice: newAvgPrice.toString(),
            unrealizedPnl: ((newAvgPrice - currentPrice) * newQuantity).toString(),
          });
          
        } else if (action === "BUY") {
          if (quantity >= currentQuantity) {
            // Close short position and potentially open long
            await storage.updatePosition(openPosition.id, {
              isOpen: false,
              unrealizedPnl: "0",
              closedAt: new Date(),
            });
            
            // If buy quantity exceeds short position, open long with remaining
            const remainingQty = quantity - currentQuantity;
            if (remainingQty > 0) {
              await storage.createPosition({
                assetId: asset.id,
                symbol: asset.symbol,
                side: "long",
                quantity: remainingQty.toString(),
                avgEntryPrice: executionPrice.toString(),
                unrealizedPnl: ((currentPrice - executionPrice) * remainingQty).toString(),
                isOpen: true,
              });
            }
          } else {
            // Partial close of short position
            const newQuantity = currentQuantity - quantity;
            await storage.updatePosition(openPosition.id, {
              quantity: newQuantity.toString(),
              unrealizedPnl: ((avgEntryPrice - currentPrice) * newQuantity).toString(),
            });
          }
        }
      }
    } else {
      // No existing position, create new one
      const side = action === "BUY" ? "long" : "short";
      const unrealizedPnl = side === "long" 
        ? (currentPrice - executionPrice) * quantity
        : (executionPrice - currentPrice) * quantity;

      await storage.createPosition({
        assetId: asset.id,
        symbol: asset.symbol,
        side,
        quantity: quantity.toString(),
        avgEntryPrice: executionPrice.toString(),
        unrealizedPnl: unrealizedPnl.toString(),
        isOpen: true,
      });
    }
  }

  async closePosition(position: Position, asset: TradingAsset): Promise<{ trade: Trade }> {
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

      const positionQuantity = parseFloat(position.quantity || "0");
      const entryPrice = parseFloat(position.avgEntryPrice || "0");
      
      // Calculate P&L
      let realizedPnl = 0;
      if (position.side === "long") {
        realizedPnl = (currentPrice - entryPrice) * positionQuantity;
      } else {
        realizedPnl = (entryPrice - currentPrice) * positionQuantity;
      }

      // Create closing trade
      const closingAction = position.side === "long" ? "SELL" : "BUY";
      const trade = await storage.createTrade({
        assetId: asset.id,
        action: closingAction,
        quantity: positionQuantity.toString(),
        price: currentPrice.toFixed(2),
        positionSizing: "0",
        stopLoss: null,
        takeProfit: null,
        aiReasoning: `MANUAL CLOSE - User closed ${position.side} position`,
        aiDecision: { manual: true, action: closingAction, close: true },
        executionResult: {
          status: "FILLED",
          orderId: `close_${Date.now()}`,
          timestamp: new Date().toISOString(),
          executedPrice: currentPrice,
          executedQuantity: positionQuantity,
          manual: true
        },
        pnl: realizedPnl.toFixed(2),
      });

      // Close the position
      await storage.updatePosition(position.id, {
        isOpen: false,
        unrealizedPnl: realizedPnl.toString(),
        closedAt: new Date(),
      });

      console.log(`🔴 Closed ${position.side} position for ${asset.symbol}: P&L $${realizedPnl.toFixed(2)}`);

      return { trade };
    } catch (error) {
      console.error(`Error closing position:`, error);
      throw error;
    }
  }
}
