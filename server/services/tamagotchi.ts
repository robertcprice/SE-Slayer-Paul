import type { Express } from "express";
import { WebSocket } from "ws";

const clients = new Set<WebSocket>();

export function registerTamagotchiRoutes(app: Express) {
  app.post("/api/tamagotchi/event", (req, res) => {
    try {
      const event = req.body;
      const message = JSON.stringify({ type: "tamagotchi_event", event });
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Tamagotchi webhook error:", error);
      res.status(500).json({ error: "Failed to process event" });
    }
  });
}

export function subscribeTamagotchi(ws: WebSocket) {
  clients.add(ws);
}

export function unsubscribeTamagotchi(ws: WebSocket) {
  clients.delete(ws);
}

