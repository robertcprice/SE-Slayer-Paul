import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const tradingAssets = pgTable("trading_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  isActive: boolean("is_active").default(true),
  interval: integer("interval").default(300), // seconds
  isPaused: boolean("is_paused").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  timestamp: timestamp("timestamp").defaultNow(),
  action: text("action").notNull(), // BUY, SELL, HOLD
  quantity: decimal("quantity", { precision: 18, scale: 8 }),
  price: decimal("price", { precision: 18, scale: 2 }),
  positionSizing: decimal("position_sizing", { precision: 5, scale: 2 }),
  stopLoss: decimal("stop_loss", { precision: 5, scale: 2 }),
  takeProfit: decimal("take_profit", { precision: 5, scale: 2 }),
  aiReasoning: text("ai_reasoning"),
  aiDecision: jsonb("ai_decision"),
  executionResult: jsonb("execution_result"),
  pnl: decimal("pnl", { precision: 18, scale: 2 }),
});

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // long, short
  quantity: decimal("quantity", { precision: 18, scale: 8 }),
  avgEntryPrice: decimal("avg_entry_price", { precision: 18, scale: 2 }),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 2 }),
  isOpen: boolean("is_open").default(true),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  timestamp: timestamp("timestamp").defaultNow(),
  open: decimal("open", { precision: 18, scale: 2 }),
  high: decimal("high", { precision: 18, scale: 2 }),
  low: decimal("low", { precision: 18, scale: 2 }),
  close: decimal("close", { precision: 18, scale: 2 }),
  volume: decimal("volume", { precision: 18, scale: 8 }),
  indicators: jsonb("indicators"),
});

export const aiReflections = pgTable("ai_reflections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  timestamp: timestamp("timestamp").defaultNow(),
  reflection: text("reflection"),
  improvements: text("improvements"),
  summary: jsonb("summary"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertTradingAssetSchema = createInsertSchema(tradingAssets).omit({
  id: true,
  createdAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  timestamp: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  openedAt: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  timestamp: true,
});

export const insertAiReflectionSchema = createInsertSchema(aiReflections).omit({
  id: true,
  timestamp: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type TradingAsset = typeof tradingAssets.$inferSelect;
export type InsertTradingAsset = z.infer<typeof insertTradingAssetSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;

export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;

export type AiReflection = typeof aiReflections.$inferSelect;
export type InsertAiReflection = z.infer<typeof insertAiReflectionSchema>;

// Dashboard data types
export type DashboardStats = {
  totalPnl: number;
  winRate: number;
  sharpeRatio: number;
  totalTrades: number;
  drawdown: number;
  averageWin: number;
  averageLoss: number;
};

export type ChartData = {
  dates: string[];
  close: number[];
  volume?: number[];
};

export type TradeFeed = {
  timestamp: string;
  action: string;
  quantity: string;
  price: string;
  aiReasoning: string;
  pnl?: number;
};

export type WebSocketMessage = {
  action?: 'pause' | 'resume' | 'set_interval';
  interval?: number;
  stats?: DashboardStats;
  chart?: ChartData;
  positions?: Position[];
  feed?: TradeFeed[];
  reflection?: string;
  improvements?: string;
  paused?: boolean;
  asset?: string;
};
