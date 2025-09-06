# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Development
```bash
npm run dev          # Start development server with hot reload (runs server and client)
npm run build        # Build for production (Vite + esbuild)
npm run start        # Start production server
npm run check        # TypeScript type checking
```

### Database Operations
```bash
npm run db:push      # Push database schema changes to PostgreSQL using Drizzle
```

### Environment Setup
```bash
cp .env.example .env # Set up environment variables
npm install          # Install dependencies
```

## Architecture Overview

This is a sophisticated AI-powered cryptocurrency trading bot built with a full-stack TypeScript architecture. The system integrates OpenAI GPT-4o with Alpaca Markets for live trading using ICT (Inner Circle Trader) and SMC (Smart Money Concepts) strategies.

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- **Backend**: Express + TypeScript + WebSocket (ws)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI GPT-4o API
- **Trading**: Alpaca Markets API (Paper Trading)
- **Realtime**: WebSocket for live updates
- **State Management**: TanStack Query + XState

### Project Structure

```
├── client/src/           # React frontend
│   ├── components/       # React components
│   │   ├── TradingDashboard.tsx    # Main dashboard with asset grid
│   │   ├── AssetPanel.tsx          # Individual asset trading panels
│   │   ├── AdminConsole.tsx        # System administration interface
│   │   └── ui/                     # Radix UI components (shadcn/ui)
│   └── App.tsx          # Main app component with routing (wouter)
├── server/              # Express backend
│   ├── services/        # Business logic services
│   │   ├── trading.ts            # Core trading engine with AI integration
│   │   ├── alpaca.ts             # Alpaca API client and order management
│   │   ├── openai.ts             # OpenAI API integration with logging
│   │   ├── dataClient.ts         # Market data fetching from multiple sources
│   │   └── logger.ts             # System logging and console streaming
│   ├── routes.ts        # API routes and WebSocket handlers
│   ├── storage.ts       # Data persistence layer (Drizzle interface)
│   └── index.ts         # Express server setup
└── shared/
    └── schema.ts        # Database schema and TypeScript types (Drizzle)
```

### Core Trading Flow

1. **Asset Configuration** → Each crypto asset (BTC/USD, SOL/USD, XRP/USD) has configurable trading intervals, position sizing, and risk parameters
2. **Trading Cycle** → Runs on configurable intervals (1min-1hour), fetches 30 periods of market data, calculates technical indicators
3. **Market Analysis** → Aggregates market data with ICT/SMC concepts (market structure, liquidity zones, fair value gaps)
4. **AI Decision** → OpenAI GPT-4o analyzes market summary using trading strategy prompts, generates buy/sell/hold decisions with reasoning
5. **Trade Execution** → Validates AI decisions against account balance and risk limits, places orders through Alpaca API
6. **Position Tracking** → Real-time P&L calculation from Alpaca positions, persistent P&L accumulation across trades

### Key Services Architecture

**TradingService** (`server/services/trading.ts`)
- Central coordinator for trading cycles
- Orchestrates data fetching, AI analysis, and trade execution
- Manages real-time dashboard data aggregation

**AlpacaClient** (`server/services/alpaca.ts`)  
- Handles all Alpaca Markets API interactions
- Order placement, position tracking, account management
- Market data retrieval for cryptocurrencies

**OpenAI Integration** (`server/services/openai.ts`)
- GPT-4o integration with ICT/SMC strategy prompts
- Complete request/response logging with token usage tracking
- AI reflection system for strategy improvement

**Data Storage** (`server/storage.ts`)
- Unified interface for all database operations
- Drizzle ORM with PostgreSQL backend
- Handles trades, positions, P&L tracking, AI logs, and strategy management

### Database Schema Highlights

- **tradingAssets**: Asset configuration with intervals, risk parameters, UI preferences
- **trades**: Complete trade execution history with AI reasoning
- **positions**: Real-time and historical position tracking
- **persistentPnl**: Accumulated P&L across all trades (realized + unrealized)
- **aiDecisionLogs**: Full OpenAI API call logging with token usage
- **tradingStrategies**: AI prompt management with default strategy system
- **aiReflections**: Automated performance analysis and strategy improvements

### WebSocket Architecture

Real-time communication uses WebSocket channels:
- **Asset Channels**: Live trading updates, position changes, P&L updates
- **Console Channel**: System log streaming to admin panel
- **Auto-reconnection**: Exponential backoff on connection loss

### Strategy Management System

- **Default Strategy Pattern**: One strategy marked as "default" becomes active for all assets
- **Custom AI Prompts**: System prompts define AI personality and ICT/SMC approach
- **Performance Feedback**: AI reflections analyze trading performance every 2 hours
- **Backtesting**: Historical strategy performance testing with comprehensive metrics

### Environment Variables Required

```bash
ALPACA_API_KEY=paper_trading_key      # Alpaca paper trading API key
ALPACA_SECRET_KEY=paper_trading_secret # Alpaca paper trading secret
OPENAI_API_KEY=your_openai_key        # OpenAI API key for GPT-4o
DATABASE_URL=postgresql://connection   # PostgreSQL connection string
```

### Development Notes

- **Paper Trading Only**: Uses Alpaca paper trading environment for safety
- **Real-time P&L**: Calculates from actual Alpaca positions, not simulated data  
- **ICT/SMC Focus**: AI prompts emphasize Inner Circle Trader and Smart Money Concepts
- **Comprehensive Logging**: All AI decisions, trade executions, and system events are logged
- **Hot Reload**: Development server supports hot reload for both client and server

### Important Patterns

- **Persistent P&L Tracking**: Maintains accurate P&L across all trades using `persistentPnl` table
- **AI Decision Logging**: Every OpenAI API call is logged with full context and token usage
- **Real-time WebSocket Updates**: All trading events are broadcast to connected clients
- **Strategy Reflection System**: AI analyzes its own performance and suggests improvements
- **Multi-timeframe Analysis**: Supports multiple timeframes for comprehensive market analysis

### Common Development Tasks

When working with this codebase:
- Database schema changes require `npm run db:push` to apply via Drizzle
- All trading logic flows through `TradingService.runTradingCycle()`
- AI prompts are managed in the `tradingStrategies` table with a default strategy pattern
- WebSocket messages are broadcast via the routes defined in `server/routes.ts`
- Real-time data synchronization happens through WebSocket channels, not polling
