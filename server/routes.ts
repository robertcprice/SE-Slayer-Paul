import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { TradingService } from "./services/trading";
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

        if (!asset.isPaused) {
          console.log(`Running trading cycle for ${assetSymbol}`);
          const result = await tradingService.runTradingCycle(asset);
          
          if (result.success) {
            console.log(`Trading cycle completed for ${assetSymbol}`);
            // Send update to all connected clients
            sendDashboardUpdate(assetSymbol);
          } else {
            console.error(`Trading cycle failed for ${assetSymbol}:`, result.error);
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

  return httpServer;
}
