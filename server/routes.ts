import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { TradingService } from "./services/trading";
import { tradingScheduler } from "./trading-scheduler";
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

  app.post("/api/admin/backtest", async (req, res) => {
    try {
      const { asset, period, strategy } = req.body;
      
      // Get real historical performance data for backtesting
      const targetAsset = await storage.getTradingAssetBySymbol(asset);
      if (!targetAsset) {
        return res.status(404).json({ error: "Asset not found" });
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
      const totalReturnPercent = totalPnl / 10000 * 100; // Assuming $10k initial capital
      
      // Calculate Sharpe ratio (simplified - using average return / volatility)
      const avgReturn = totalPnl / actualTrades.length;
      const returns = actualTrades.map(t => parseFloat(t.pnl || "0"));
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
      const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

      const result = {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        totalReturn: parseFloat(totalReturnPercent.toFixed(2)),
        sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
        maxDrawdown: parseFloat((-maxDrawdownValue).toFixed(2)),
        winRate: parseFloat(winRate.toFixed(1)),
        totalTrades: actualTrades.length,
        strategy: strategy || "AI ICT/SMC"
      };
      
      res.json(result);
    } catch (error) {
      console.error("Error running backtest:", error);
      res.status(500).json({ error: "Failed to run backtest" });
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

  return httpServer;
}
