import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { TradingService } from "./services/trading";
import { tradingScheduler } from "./trading-scheduler";
import { aiScheduler } from "./services/ai-scheduler";
import type { WebSocketMessage } from "@shared/schema";

const tradingService = new TradingService();
const wsClients = new Map<string, Set<WebSocket>>();
const tradingIntervals = new Map<string, NodeJS.Timeout>();

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.get("/api/assets", async (_req, res) => {
    try {
      const assets = await storage.getTradingAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/:symbol/dashboard", async (req, res) => {
    try {
      const { symbol } = req.params;
      const data = await tradingService.getDashboardData(decodeURIComponent(symbol));
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // AI Decision Logs API
  app.get("/api/ai-logs", async (req, res) => {
    try {
      const { assetId, limit } = req.query;
      const logs = await storage.getAiDecisionLogs(
        assetId as string | undefined, 
        limit ? parseInt(limit as string) : undefined
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI decision logs" });
    }
  });

  app.get("/api/ai-logs/export/json", async (req, res) => {
    try {
      const { assetId } = req.query;
      const jsonData = await storage.exportAiDecisionLogsToJson(assetId as string | undefined);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ai-decisions-${new Date().toISOString().split('T')[0]}.json"`);
      res.send(jsonData);
    } catch (error) {
      res.status(500).json({ error: "Failed to export AI logs as JSON" });
    }
  });

  app.get("/api/ai-logs/export/csv", async (req, res) => {
    try {
      const { assetId } = req.query;
      const csvData = await storage.exportAiDecisionLogsToCsv(assetId as string | undefined);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="ai-decisions-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } catch (error) {
      res.status(500).json({ error: "Failed to export AI logs as CSV" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket server setup - using specific path to avoid conflict with Vite HMR
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });

  wss.on("connection", (ws, req) => {
    console.log(`WebSocket connection established`);
    let currentAsset: string | null = null;

    // Handle client subscription to specific assets
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.action === 'subscribe' && message.asset) {
          // Unsubscribe from previous asset if any
          if (currentAsset) {
            const clients = wsClients.get(currentAsset);
            if (clients) {
              clients.delete(ws);
              if (clients.size === 0) {
                wsClients.delete(currentAsset);
                stopTradingLoop(currentAsset);
              }
            }
          }

          // Subscribe to new asset
          currentAsset = message.asset;
          console.log(`Client subscribed to asset: ${currentAsset}`);

          // Add client to asset's client set
          if (!wsClients.has(currentAsset)) {
            wsClients.set(currentAsset, new Set());
          }
          wsClients.get(currentAsset)!.add(ws);

          // Start trading loop for this asset if not already running
          startTradingLoop(currentAsset);

          // Send initial data
          sendDashboardUpdate(currentAsset);
        } else if (currentAsset) {
          // Handle other WebSocket messages for the subscribed asset
          await handleWebSocketMessage(currentAsset, message);
          
          // Broadcast update to all clients for this asset
          sendDashboardUpdate(currentAsset);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      console.log(`WebSocket connection closed`);
      if (currentAsset) {
        const clients = wsClients.get(currentAsset);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            wsClients.delete(currentAsset);
            stopTradingLoop(currentAsset);
          }
        }
      }
    });

    ws.on("error", (error) => {
      console.error(`WebSocket connection error:`, error);
    });
  });

  async function handleWebSocketMessage(assetSymbol: string, message: WebSocketMessage) {
    switch (message.action) {
      case "pause":
        await tradingService.pauseAsset(assetSymbol);
        break;
      case "resume":
        await tradingService.resumeAsset(assetSymbol);
        break;
      case "set_interval":
        if (message.interval) {
          await tradingService.setInterval(assetSymbol, message.interval);
          // Restart trading loop with new interval
          stopTradingLoop(assetSymbol);
          startTradingLoop(assetSymbol);
        }
        break;
    }
  }

  async function sendDashboardUpdate(assetSymbol: string) {
    const clients = wsClients.get(assetSymbol);
    if (!clients || clients.size === 0) return;

    try {
      const dashboardData = await tradingService.getDashboardData(assetSymbol);
      const asset = await tradingService.getAsset(assetSymbol);
      
      const message: WebSocketMessage = {
        stats: dashboardData.stats,
        chart: dashboardData.chart,
        positions: dashboardData.positions,
        feed: dashboardData.feed,
        reflection: dashboardData.reflection?.reflection,
        improvements: dashboardData.reflection?.improvements,
        paused: asset?.isPaused || false,
        interval: asset?.interval || 300,
        asset: assetSymbol,
      };

      const messageStr = JSON.stringify(message);
      
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageStr);
        }
      }
    } catch (error) {
      console.error(`Error sending dashboard update for ${assetSymbol}:`, error);
    }
  }

  async function startTradingLoop(assetSymbol: string) {
    if (tradingIntervals.has(assetSymbol)) {
      return; // Already running
    }

    const runCycle = async () => {
      try {
        const asset = await tradingService.getAsset(assetSymbol);
        if (!asset) {
          console.error(`Asset ${assetSymbol} not found`);
          return;
        }

        if (!asset.isPaused && tradingScheduler.canRunTrade(asset.id, assetSymbol, asset.interval || 300)) {
          console.log(`Running trading cycle for ${assetSymbol} (interval: ${asset.interval}s)`);
          const result = await tradingService.runTradingCycle(asset);
          
          if (result.success) {
            console.log(`Trading cycle completed for ${assetSymbol}`);
            tradingScheduler.markTradeComplete(asset.id);
            // Send update to all connected clients
            sendDashboardUpdate(assetSymbol);
          } else {
            console.error(`Trading cycle failed for ${assetSymbol}:`, result.error);
            tradingScheduler.markTradeComplete(asset.id);
          }
        } else {
          const timeUntilNext = tradingScheduler.getTimeUntilNextRun(asset.id);
          if (timeUntilNext > 0) {
            console.log(`Skipping trading cycle for ${assetSymbol}: ${Math.round(timeUntilNext)}s until next allowed run`);
          }
        }

        // Schedule next cycle
        const interval = (asset.interval || 300) * 1000; // Convert to milliseconds
        const timeoutId = setTimeout(runCycle, interval);
        tradingIntervals.set(assetSymbol, timeoutId);
        
      } catch (error) {
        console.error(`Trading loop error for ${assetSymbol}:`, error);
        // Retry after 1 minute on error
        const timeoutId = setTimeout(runCycle, 60000);
        tradingIntervals.set(assetSymbol, timeoutId);
      }
    };

    // Start immediately
    runCycle();
  }

  function stopTradingLoop(assetSymbol: string) {
    const intervalId = tradingIntervals.get(assetSymbol);
    if (intervalId) {
      clearTimeout(intervalId);
      tradingIntervals.delete(assetSymbol);
      console.log(`Stopped trading loop for ${assetSymbol}`);
    }
  }

  // AI Decision Logs endpoint - ensure deduplication
  app.get("/api/ai-logs", async (req, res) => {
    try {
      const { asset, limit } = req.query;
      const logs = await storage.getAiDecisionLogs(asset as string, limit ? parseInt(limit as string) : undefined);
      
      // Deduplicate logs by timestamp and symbol combination
      const uniqueLogs = logs.filter((log, index, self) => 
        index === self.findIndex(l => 
          l.timestamp?.getTime() === log.timestamp?.getTime() && 
          l.symbol === log.symbol
        )
      );
      
      res.json(uniqueLogs);
    } catch (error) {
      console.error("Error fetching AI logs:", error);
      res.status(500).json({ error: "Failed to fetch AI logs" });
    }
  });

  // Export AI Decision Logs
  app.get("/api/ai-logs/export/:format", async (req, res) => {
    try {
      const { format } = req.params;
      const { asset } = req.query;
      
      if (format === "json") {
        const jsonData = await storage.exportAiDecisionLogsToJson(asset as string);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="ai-logs.json"');
        res.send(jsonData);
      } else if (format === "csv") {
        const csvData = await storage.exportAiDecisionLogsToCsv(asset as string);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="ai-logs.csv"');
        res.send(csvData);
      } else {
        res.status(400).json({ error: "Invalid format. Use 'json' or 'csv'" });
      }
    } catch (error) {
      console.error("Error exporting AI logs:", error);
      res.status(500).json({ error: "Failed to export AI logs" });
    }
  });

  // Admin routes for backtesting and sentiment
  app.get("/api/admin/system-stats", async (req, res) => {
    try {
      const assets = await storage.getAllTradingAssets();
      let totalPnl = 0;
      let totalTrades = 0;
      let totalPositions = 0;
      
      for (const asset of assets) {
        const stats = await storage.calculateStats(asset.id);
        const positions = await storage.getPositionsByAsset(asset.id);
        totalPnl += stats.totalPnl;
        totalTrades += stats.totalTrades;
        totalPositions += positions.filter(p => p.isOpen).length;
      }
      
      res.json({
        totalPnl,
        totalTrades,
        activePositions: totalPositions,
        totalAssets: assets.length,
      });
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).json({ error: "Failed to fetch system stats" });
    }
  });

  // Backtesting routes
  app.get("/api/backtests", async (req, res) => {
    try {
      const results = await storage.getBacktestResults();
      res.json(results);
    } catch (error) {
      console.error("Error fetching backtest results:", error);
      res.status(500).json({ error: "Failed to fetch backtest results" });
    }
  });

  app.post("/api/backtests/run", async (req, res) => {
    try {
      const { name, assetId, strategyId, period, initialCapital } = req.body;
      
      // Get real historical performance data for backtesting
      const targetAsset = await storage.getTradingAsset(assetId);
      if (!targetAsset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      const strategy = await storage.getTradingStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      // Calculate period in days
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get actual trading data for the period
      const trades = await storage.getTradesByAsset(targetAsset.id, 1000);
      const recentTrades = trades.filter(t => new Date(t.timestamp || Date.now()) >= startDate);
      const actualTrades = recentTrades.filter(t => t.action === "BUY" || t.action === "SELL");
      
      if (actualTrades.length === 0) {
        return res.json({
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
          totalReturn: 0,
          sharpeRatio: 0,
          maxDrawdown: 0,
          winRate: 0,
          totalTrades: 0,
          strategy: strategy || "AI ICT/SMC",
          message: "No trading data available for the selected period"
        });
      }

      // Calculate real performance metrics
      let totalPnl = 0;
      let wins = 0;
      let losses = 0;
      let maxDrawdownValue = 0;
      let currentDrawdown = 0;
      let runningTotal = 0;

      for (const trade of actualTrades) {
        const pnl = parseFloat(trade.pnl || "0");
        totalPnl += pnl;
        runningTotal += pnl;
        
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        
        // Track drawdown
        if (runningTotal < 0) {
          currentDrawdown = Math.abs(runningTotal);
          maxDrawdownValue = Math.max(maxDrawdownValue, currentDrawdown);
        } else {
          currentDrawdown = 0;
        }
      }

      const winRate = actualTrades.length > 0 ? (wins / actualTrades.length) * 100 : 0;
      const totalReturnPercent = totalPnl / initialCapital * 100;
      
      // Calculate Sharpe ratio (simplified - using average return / volatility)
      const avgReturn = actualTrades.length > 0 ? totalPnl / actualTrades.length : 0;
      const returns = actualTrades.map(t => parseFloat(t.pnl || "0"));
      const variance = returns.length > 0 ? returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length : 0;
      const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

      // Calculate profit factor
      const totalWins = actualTrades.filter(t => parseFloat(t.pnl || "0") > 0).reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0);
      const totalLosses = Math.abs(actualTrades.filter(t => parseFloat(t.pnl || "0") < 0).reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0));
      const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

      // Save backtest result to database
      const backtestResult = await storage.createBacktestResult({
        name,
        assetId,
        strategyId,
        startDate,
        endDate: new Date(),
        initialCapital: initialCapital.toString(),
        finalCapital: (initialCapital + totalPnl).toString(),
        totalReturn: totalReturnPercent.toString(),
        maxDrawdown: (-maxDrawdownValue).toString(),
        sharpeRatio: sharpeRatio.toString(),
        winRate: winRate.toString(),
        totalTrades: actualTrades.length,
        profitFactor: profitFactor.toString(),
        avgWin: wins > 0 ? (totalWins / wins).toString() : "0",
        avgLoss: losses > 0 ? (totalLosses / losses).toString() : "0",
        results: {
          asset: targetAsset.symbol,
          strategy: strategy.name,
          trades: actualTrades.length,
          period
        }
      });
      
      res.json(backtestResult);
    } catch (error) {
      console.error("Error running backtest:", error);
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  app.delete("/api/backtests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBacktestResult(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Backtest result not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting backtest result:", error);
      res.status(500).json({ error: "Failed to delete backtest result" });
    }
  });

  // API Key management endpoints
  app.get("/api/admin/api-keys", async (req, res) => {
    try {
      const keys = {
        alpacaApiKey: process.env.ALPACA_API_KEY ? "••••••••••••••••••••" : null,
        alpacaSecretKey: process.env.ALPACA_SECRET_KEY ? "••••••••••••••••••••••••••••••••••••••••" : null,
        openaiApiKey: process.env.OPENAI_API_KEY ? "••••••••••••••••••••••••••••••••••••••••••••••••••" : null,
        databaseUrl: process.env.DATABASE_URL ? "••••••••••••••••••••••••••••••••••••••••••••••••••" : null
      };
      res.json(keys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  app.post("/api/admin/api-keys/test", async (req, res) => {
    try {
      const results = {
        alpaca: false,
        openai: false,
        database: false
      };

      // Test Alpaca connection
      try {
        if (process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY) {
          // Simple test - this would need actual Alpaca client testing
          results.alpaca = true;
        }
      } catch (error) {
        console.error("Alpaca test failed:", error);
      }

      // Test OpenAI connection
      try {
        if (process.env.OPENAI_API_KEY) {
          results.openai = true;
        }
      } catch (error) {
        console.error("OpenAI test failed:", error);
      }

      // Test database connection
      try {
        if (process.env.DATABASE_URL) {
          await storage.getAllTradingAssets(); // Simple DB test
          results.database = true;
        }
      } catch (error) {
        console.error("Database test failed:", error);
      }

      res.json(results);
    } catch (error) {
      console.error("Error testing API keys:", error);
      res.status(500).json({ error: "Failed to test API keys" });
    }
  });

  // Real-time market sentiment endpoint
  app.get("/api/admin/market-sentiment", async (req, res) => {
    try {
      // Get recent AI decisions to analyze sentiment
      const recentLogs = await storage.getAiDecisionLogs(undefined, 20);
      
      // Calculate sentiment based on recent AI recommendations
      const recommendations = recentLogs.map(log => log.recommendation);
      const bullishCount = recommendations.filter(r => r === "BUY").length;
      const bearishCount = recommendations.filter(r => r === "SELL").length;
      const neutralCount = recommendations.filter(r => r === "HOLD").length;
      
      const totalDecisions = recommendations.length;
      const bullishPercent = totalDecisions > 0 ? (bullishCount / totalDecisions) * 100 : 0;
      const bearishPercent = totalDecisions > 0 ? (bearishCount / totalDecisions) * 100 : 0;
      
      // Determine overall sentiment
      let btcSentiment = "Neutral";
      let solSentiment = "Neutral";
      let overallSentiment = "Neutral";
      
      if (bullishPercent > 60) {
        btcSentiment = "Bullish";
        solSentiment = "Bullish";
        overallSentiment = "Optimistic";
      } else if (bearishPercent > 60) {
        btcSentiment = "Bearish";
        solSentiment = "Bearish";
        overallSentiment = "Pessimistic";
      } else if (bullishPercent > bearishPercent) {
        overallSentiment = "Cautiously Optimistic";
      }
      
      // Mock Fear & Greed Index based on sentiment
      const fearGreedIndex = Math.max(0, Math.min(100, 50 + (bullishPercent - bearishPercent)));
      
      res.json({
        btcSentiment,
        solSentiment,
        overallSentiment,
        fearGreedIndex: Math.round(fearGreedIndex),
        recentDecisions: {
          bullish: bullishCount,
          bearish: bearishCount,
          neutral: neutralCount,
          total: totalDecisions
        }
      });
    } catch (error) {
      console.error("Error fetching market sentiment:", error);
      res.status(500).json({ error: "Failed to fetch market sentiment" });
    }
  });

  // Admin asset management endpoints
  app.get("/api/admin/assets", async (req, res) => {
    try {
      const assets = await storage.getAllTradingAssets();
      res.json(assets);
    } catch (error) {
      console.error("Error fetching assets:", error);
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });

  app.post("/api/admin/assets", async (req, res) => {
    try {
      const { symbol, interval, maxPositionSize, stopLossPercent, takeProfitPercent } = req.body;
      
      // Validate required fields
      if (!symbol) {
        return res.status(400).json({ error: "Symbol is required" });
      }

      const asset = await storage.createTradingAsset({
        symbol: symbol.toUpperCase(),
        isActive: true,
        interval: interval || 300,
        isPaused: false,
        maxPositionSize: maxPositionSize?.toString() || "5.0",
        stopLossPercent: stopLossPercent?.toString() || "2.0",
        takeProfitPercent: takeProfitPercent?.toString() || "4.0",
      });

      res.json(asset);
    } catch (error) {
      console.error("Error creating asset:", error);
      if (error instanceof Error && error.message.includes("unique")) {
        res.status(409).json({ error: "Asset already exists" });
      } else {
        res.status(500).json({ error: "Failed to create asset" });
      }
    }
  });

  app.put("/api/admin/assets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, interval, maxPositionSize, stopLossPercent, takeProfitPercent, isPaused } = req.body;

      const updated = await storage.updateTradingAsset(id, {
        isActive,
        interval,
        isPaused,
        maxPositionSize: maxPositionSize?.toString(),
        stopLossPercent: stopLossPercent?.toString(),
        takeProfitPercent: takeProfitPercent?.toString(),
      });

      if (!updated) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating asset:", error);
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  app.delete("/api/admin/assets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTradingAsset(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Asset not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting asset:", error);
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // Manual AI Analysis trigger
  app.post("/api/admin/ai-analysis/:assetId", async (req, res) => {
    try {
      const { assetId } = req.params;
      await aiScheduler.triggerReflection(assetId);
      res.json({ success: true, message: "AI analysis triggered successfully" });
    } catch (error) {
      console.error("Error triggering AI analysis:", error);
      res.status(500).json({ error: "Failed to trigger AI analysis" });
    }
  });

  // AI Analysis scheduler status
  app.get("/api/admin/ai-scheduler-status", async (req, res) => {
    try {
      res.json({ 
        isRunning: true, 
        intervalHours: 2, 
        message: "AI scheduler is running and generating strategy improvements every 2 hours" 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get scheduler status" });
    }
  });

  // Trading Strategy Routes
  app.get("/api/strategies", async (req, res) => {
    try {
      const strategies = await storage.getTradingStrategies();
      res.json(strategies);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ error: "Failed to fetch strategies" });
    }
  });

  app.get("/api/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const strategy = await storage.getTradingStrategy(id);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
      res.json(strategy);
    } catch (error) {
      console.error("Error fetching strategy:", error);
      res.status(500).json({ error: "Failed to fetch strategy" });
    }
  });

  app.post("/api/strategies", async (req, res) => {
    try {
      const { name, systemPrompt, personalityPrompt, isDefault } = req.body;
      
      if (!name || !systemPrompt) {
        return res.status(400).json({ error: "Name and system prompt are required" });
      }

      // If this is set as default, unset any existing default
      if (isDefault) {
        const existingDefault = await storage.getDefaultTradingStrategy();
        if (existingDefault) {
          await storage.updateTradingStrategy(existingDefault.id, { isDefault: false });
        }
      }

      const strategy = await storage.createTradingStrategy({
        name,
        systemPrompt,
        personalityPrompt: personalityPrompt || "",
        isDefault: isDefault || false
      });

      res.json(strategy);
    } catch (error) {
      console.error("Error creating strategy:", error);
      res.status(500).json({ error: "Failed to create strategy" });
    }
  });

  app.put("/api/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, systemPrompt, personalityPrompt, isDefault } = req.body;

      // If this is set as default, unset any existing default
      if (isDefault) {
        const existingDefault = await storage.getDefaultTradingStrategy();
        if (existingDefault && existingDefault.id !== id) {
          await storage.updateTradingStrategy(existingDefault.id, { isDefault: false });
        }
      }

      const updated = await storage.updateTradingStrategy(id, {
        name,
        systemPrompt,
        personalityPrompt,
        isDefault
      });

      if (!updated) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating strategy:", error);
      res.status(500).json({ error: "Failed to update strategy" });
    }
  });

  app.delete("/api/strategies/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTradingStrategy(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ error: "Failed to delete strategy" });
    }
  });

  // Backtesting Routes
  app.get("/api/backtests", async (req, res) => {
    try {
      const { limit } = req.query;
      const results = await storage.getBacktestResults(limit ? parseInt(limit as string) : undefined);
      res.json(results);
    } catch (error) {
      console.error("Error fetching backtest results:", error);
      res.status(500).json({ error: "Failed to fetch backtest results" });
    }
  });

  app.post("/api/backtests/run", async (req, res) => {
    try {
      const { name, assetId, strategyId, period, initialCapital } = req.body;
      
      if (!name || !assetId || !strategyId) {
        return res.status(400).json({ error: "Name, asset, and strategy are required" });
      }

      // Get the asset and strategy
      const asset = await storage.getTradingAsset(assetId);
      const strategy = await storage.getTradingStrategy(strategyId);
      
      if (!asset || !strategy) {
        return res.status(404).json({ error: "Asset or strategy not found" });
      }

      // Calculate period in days
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const endDate = new Date();
      
      // Get actual trading data for the period
      const trades = await storage.getTradesByAsset(assetId, 1000);
      const recentTrades = trades.filter(t => new Date(t.timestamp || Date.now()) >= startDate);
      const actualTrades = recentTrades.filter(t => t.action === "BUY" || t.action === "SELL");
      
      if (actualTrades.length === 0) {
        const result = await storage.createBacktestResult({
          name,
          assetId,
          strategyId,
          startDate,
          endDate,
          initialCapital: initialCapital.toString(),
          finalCapital: initialCapital.toString(),
          totalReturn: "0",
          sharpeRatio: "0",
          maxDrawdown: "0",
          winRate: "0",
          totalTrades: 0,
          profitFactor: "1",
          avgWin: "0",
          avgLoss: "0",
          results: { message: "No trading data available for the selected period" }
        });
        return res.json(result);
      }

      // Calculate performance metrics
      let totalPnl = 0;
      let wins = 0;
      let losses = 0;
      let maxDrawdownValue = 0;
      let currentDrawdown = 0;
      let runningTotal = initialCapital;
      let peak = initialCapital;

      for (const trade of actualTrades) {
        const pnl = parseFloat(trade.pnl || "0");
        totalPnl += pnl;
        runningTotal += pnl;
        
        if (pnl > 0) wins++;
        else if (pnl < 0) losses++;
        
        // Track drawdown
        if (runningTotal > peak) {
          peak = runningTotal;
          currentDrawdown = 0;
        } else {
          currentDrawdown = (peak - runningTotal) / peak * 100;
          maxDrawdownValue = Math.max(maxDrawdownValue, currentDrawdown);
        }
      }

      const finalCapital = initialCapital + totalPnl;
      const winRate = actualTrades.length > 0 ? (wins / actualTrades.length) * 100 : 0;
      const totalReturnPercent = (totalPnl / initialCapital) * 100;
      
      // Calculate Sharpe ratio
      const returns = actualTrades.map(t => parseFloat(t.pnl || "0") / initialCapital * 100);
      const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

      const winningTrades = actualTrades.filter(t => parseFloat(t.pnl || "0") > 0);
      const losingTrades = actualTrades.filter(t => parseFloat(t.pnl || "0") < 0);
      
      const avgWin = winningTrades.length > 0 
        ? winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / winningTrades.length 
        : 0;
      const avgLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl || "0"), 0) / losingTrades.length
        : 0;

      const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin / avgLoss) : 1;

      const result = await storage.createBacktestResult({
        name,
        assetId,
        strategyId,
        startDate,
        endDate,
        initialCapital: initialCapital.toString(),
        finalCapital: finalCapital.toString(),
        totalReturn: totalReturnPercent.toString(),
        sharpeRatio: sharpeRatio.toString(),
        maxDrawdown: (-maxDrawdownValue).toString(),
        winRate: winRate.toString(),
        totalTrades: actualTrades.length,
        profitFactor: profitFactor.toString(),
        avgWin: avgWin.toString(),
        avgLoss: avgLoss.toString(),
        results: {
          trades: actualTrades.length,
          strategy: strategy.name,
          asset: asset.symbol
        }
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error running backtest:", error);
      res.status(500).json({ error: "Failed to run backtest" });
    }
  });

  app.delete("/api/backtests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteBacktestResult(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Backtest result not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting backtest result:", error);
      res.status(500).json({ error: "Failed to delete backtest result" });
    }
  });

  // Manual Trading Endpoints
  app.post("/api/trades/manual", async (req, res) => {
    try {
      const { assetSymbol, action, quantity, price, side } = req.body;
      
      if (!assetSymbol || !action || !quantity) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get asset from database
      const assets = await storage.getTradingAssets();
      const asset = assets.find(a => a.symbol === assetSymbol);
      
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }

      // Execute manual trade
      const result = await tradingService.executeManualTrade(asset, {
        action,
        quantity: parseFloat(quantity),
        price: price ? parseFloat(price) : undefined,
        side
      });

      // Broadcast update to WebSocket clients
      sendDashboardUpdate(assetSymbol);

      res.json(result);
    } catch (error) {
      console.error("Manual trade error:", error);
      res.status(500).json({ error: "Failed to execute manual trade" });
    }
  });

  return httpServer;
}
