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
  maxPositionSize: decimal("max_position_size", { precision: 5, scale: 2 }).default("5.0"), // percentage of portfolio
  stopLossPercent: decimal("stop_loss_percent", { precision: 5, scale: 2 }).default("2.0"), // percentage
  takeProfitPercent: decimal("take_profit_percent", { precision: 5, scale: 2 }).default("4.0"), // percentage
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

// P&L history tracking for dashboard graphs
export const pnlHistory = pgTable("pnl_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  timestamp: timestamp("timestamp").defaultNow(),
  totalPnl: decimal("total_pnl", { precision: 18, scale: 2 }),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 18, scale: 2 }),
  realizedPnl: decimal("realized_pnl", { precision: 18, scale: 2 }),
  positionValue: decimal("position_value", { precision: 18, scale: 2 }),
  marketPrice: decimal("market_price", { precision: 18, scale: 2 }),
});

export const aiDecisionLogs = pgTable("ai_decision_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  timestamp: timestamp("timestamp").defaultNow(),
  symbol: text("symbol").notNull(),
  recommendation: text("recommendation").notNull(), // BUY, SELL, HOLD
  reasoning: text("reasoning").notNull(),
  positionSizing: decimal("position_sizing", { precision: 5, scale: 2 }),
  stopLoss: decimal("stop_loss", { precision: 5, scale: 2 }),
  takeProfit: decimal("take_profit", { precision: 5, scale: 2 }),
  nextCycleSeconds: integer("next_cycle_seconds"),
  marketData: jsonb("market_data"), // The technical summary sent to AI
  rawResponse: jsonb("raw_response"), // Complete OpenAI API response
  responseTimeMs: integer("response_time_ms"), // Time taken for AI response
  modelUsed: text("model_used").default("gpt-4o"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  totalTokens: integer("total_tokens"),
});

// Trading Strategy Configuration
export const tradingStrategies = pgTable("trading_strategies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  personalityPrompt: text("personality_prompt"),
  isDefault: boolean("is_default").default(false),
  // Data configuration for OpenAI analysis
  primaryTimeframe: text("primary_timeframe").default("1h"), // 1m, 5m, 15m, 1h
  secondaryTimeframe: text("secondary_timeframe"), // Optional second timeframe
  dataPoints: integer("data_points").default(100), // Number of candles to include
  includedIndicators: text("included_indicators").array().default(sql`ARRAY['rsi', 'macd', 'sma20', 'sma50', 'bb_upper', 'bb_lower']::text[]`),
  customDataFields: text("custom_data_fields").array().default(sql`ARRAY[]::text[]`), // For future extensibility
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Backtesting Results
export const backtestResults = pgTable("backtest_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  assetId: varchar("asset_id").references(() => tradingAssets.id),
  strategyId: varchar("strategy_id").references(() => tradingStrategies.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  initialCapital: decimal("initial_capital", { precision: 18, scale: 2 }).default("10000"),
  finalCapital: decimal("final_capital", { precision: 18, scale: 2 }),
  totalReturn: decimal("total_return", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  winRate: decimal("win_rate", { precision: 5, scale: 2 }),
  totalTrades: integer("total_trades"),
  profitFactor: decimal("profit_factor", { precision: 8, scale: 4 }),
  avgWin: decimal("avg_win", { precision: 18, scale: 2 }),
  avgLoss: decimal("avg_loss", { precision: 18, scale: 2 }),
  results: jsonb("results"),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertAiDecisionLogSchema = createInsertSchema(aiDecisionLogs).omit({
  id: true,
  timestamp: true,
});

export const insertTradingStrategySchema = createInsertSchema(tradingStrategies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBacktestResultSchema = createInsertSchema(backtestResults).omit({
  id: true,
  createdAt: true,
});

export const insertPnlHistorySchema = createInsertSchema(pnlHistory).omit({
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

export type AiDecisionLog = typeof aiDecisionLogs.$inferSelect;
export type InsertAiDecisionLog = z.infer<typeof insertAiDecisionLogSchema>;

export type TradingStrategy = typeof tradingStrategies.$inferSelect;
export type InsertTradingStrategy = z.infer<typeof insertTradingStrategySchema>;

export type BacktestResult = typeof backtestResults.$inferSelect;
export type InsertBacktestResult = z.infer<typeof insertBacktestResultSchema>;

export type PnlHistory = typeof pnlHistory.$inferSelect;
export type InsertPnlHistory = z.infer<typeof insertPnlHistorySchema>;

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

export type AccountBalance = {
  equity: string;
  cash: string;
  buyingPower: string;
  dayTradeCount: number;
  status: string;
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
  accountBalance?: AccountBalance;
};
