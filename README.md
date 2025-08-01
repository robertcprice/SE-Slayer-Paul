# AI Trading Bot System

## How to Run

### Prerequisites
- Node.js 20+ installed
- PostgreSQL database (automatically provided in Replit)
- Required API keys (see Environment Variables section below)

### Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   You'll need these API keys (add them via Replit Secrets):
   - `ALPACA_API_KEY` - Your Alpaca trading API key
   - `ALPACA_SECRET_KEY` - Your Alpaca trading secret key
   - `OPENAI_API_KEY` - Your OpenAI API key for AI analysis
   - `DATABASE_URL` - PostgreSQL connection string (auto-provided in Replit)

3. **Initialize Database**
   ```bash
   npm run db:push
   ```

4. **Start the Application**
   ```bash
   npm run dev
   ```

5. **Access the Dashboard**
   - Open your browser to the provided URL (usually shown in the console)
   - The application runs on port 5000 by default

### Development Commands
- `npm run dev` - Start development server with hot reload
- `npm run db:push` - Push database schema changes
- `npm run build` - Build for production

### Features Available After Setup
- Real-time AI trading with OpenAI analysis
- Live dashboard with trading statistics
- Manual trading interface
- Backtesting functionality
- Strategy editor and management
- Admin console with complete system logs

## Overview

A sophisticated AI-powered cryptocurrency trading bot that integrates OpenAI's GPT-4o with Alpaca Markets for live trading. The system employs ICT (Inner Circle Trader) and SMC (Smart Money Concepts) strategies for intelligent market analysis and decision-making. Features real-time dashboard monitoring, comprehensive AI decision logging, automated trading execution, backtesting, strategy management, and an admin console with real-time system monitoring.

## System Architecture & Logic Flow

### Core Trading Logic

```
1. Asset Configuration → 2. Trading Cycle → 3. Market Analysis → 4. AI Decision → 5. Trade Execution → 6. Position Tracking
```

**1. Asset Configuration:**
- Each trading asset (BTC/USD, SOL/USD, XRP/USD) has configurable parameters
- Trading intervals (1min to 1hour), position sizing, stop-loss/take-profit percentages
- Pause/resume controls for individual assets

**2. Trading Cycle (Every configured interval):**
- Fetches 30 periods of historical market data from Alpaca/external sources
- Calculates technical indicators (RSI, MACD, Bollinger Bands, SMAs)
- Retrieves current account balance and existing positions

**3. Market Analysis:**
- Aggregates market data into structured summary for AI analysis
- Includes price action, volume, technical indicators, and current positions
- Applies ICT/SMC concepts (market structure, liquidity zones, fair value gaps)

**4. AI Decision Making:**
- Sends market summary to OpenAI GPT-4o with trading strategy prompts
- AI analyzes using ICT/SMC principles and generates buy/sell/hold decisions
- Includes position sizing recommendations and risk management parameters

**5. Trade Execution:**
- Validates AI decisions against account balance and risk limits
- Places orders through Alpaca API with proper error handling
- Records all trade details and execution results

**6. Position Tracking:**
- Real-time P&L calculation from Alpaca positions
- Persistent P&L accumulation across all trades
- Performance metrics (win rate, Sharpe ratio, drawdown) calculation

### Strategy Management Logic

**Default Strategy System:**
- Multiple trading strategies can be created with custom AI prompts
- One strategy is marked as "default" - this becomes the active trading strategy
- All assets use the default strategy for AI decision-making
- Strategy changes take effect immediately on next trading cycles

**AI Reflection System:**
- Every 2 hours, AI analyzes recent trading performance
- Generates insights and strategy improvement recommendations
- Creates reflections stored in database for performance tracking

## File Structure & Important Files

### Frontend Architecture (`client/`)

```
client/src/
├── components/                 # React Components
│   ├── TradingDashboard.tsx   # Main dashboard container with asset grid
│   ├── AssetPanel.tsx         # Individual asset trading panel with controls
│   ├── AdminConsole.tsx       # Real-time system console with logs
│   ├── AssetManagementPanel.tsx # Asset configuration interface
│   └── ui/                    # Shadcn/ui reusable components
├── pages/                     # Route Pages
│   ├── dashboard.tsx          # Main trading dashboard page
│   ├── admin.tsx             # Admin panel with system controls
│   ├── ai-logs.tsx           # AI decision log viewer
│   ├── backtesting.tsx       # Strategy backtesting interface
│   └── strategy-editor.tsx   # Trading strategy management
├── hooks/                     # Custom React Hooks
│   ├── useWebSocket.ts        # WebSocket connection management
│   └── use-toast.ts          # Toast notification system
└── lib/                      # Utilities
    ├── queryClient.ts         # TanStack Query configuration
    └── utils.ts              # Utility functions
```

### Backend Architecture (`server/`)

```
server/
├── services/                  # Business Logic Services
│   ├── trading.ts            # Core trading engine with AI integration
│   ├── alpaca.ts             # Alpaca API client and order management
│   ├── openai.ts             # OpenAI API integration with logging
│   ├── data-client.ts        # Market data fetching from multiple sources
│   ├── ai-scheduler.ts       # Automated AI reflection scheduling
│   ├── portfolio-tracker.ts  # Portfolio value tracking and CSV logging
│   ├── position-tracker.ts   # Real-time position P&L tracking
│   └── logger.ts             # System logging and console streaming
├── routes.ts                 # API routes and WebSocket handlers
├── storage.ts                # Data persistence layer with interface
├── db.ts                     # Database connection (Drizzle + PostgreSQL)
├── index.ts                  # Express server setup and initialization
└── vite.ts                   # Vite dev server integration
```

### Shared Types (`shared/`)

```
shared/
└── schema.ts                 # Database schema and TypeScript types
```

## Key File Deep Dive

### 1. `server/services/trading.ts` - Core Trading Engine

**Purpose:** Central trading logic coordinator
**Key Functions:**
- `runTradingCycle()`: Main trading loop for each asset
- `executeTrade()`: Handles order execution via Alpaca API  
- `getDashboardData()`: Aggregates real-time trading data
- `pauseAsset()` / `resumeAsset()`: Trading controls

**Logic Flow:**
```
Asset Interval Trigger → Fetch Market Data → Calculate Indicators → 
AI Analysis → Trade Decision → Order Execution → Position Update → 
WebSocket Broadcast → Performance Calculation
```

### 2. `server/services/openai.ts` - AI Integration

**Purpose:** OpenAI API integration with comprehensive logging
**Key Functions:**
- `analyzeMarketWithOpenAI()`: Market analysis with GPT-4o
- `generateReflection()`: Post-trade performance analysis

**Features:**
- ICT/SMC strategy prompting (Market Structure, Liquidity, Order Flow)
- Complete request/response logging with token usage
- Structured JSON responses for trading decisions
- Error handling with fallback mechanisms

### 3. `server/services/alpaca.ts` - Broker Integration

**Purpose:** Alpaca Markets API integration for live trading
**Key Functions:**
- `getAccount()`: Account equity and buying power
- `getPositions()`: Current position retrieval
- `placeOrder()`: Buy/sell order execution
- `getHistoricalData()`: Market data for analysis

**Configuration:**
- Paper trading environment for safety
- Cryptocurrency support (BTC/USD, SOL/USD, XRP/USD)
- Real-time position and P&L tracking

### 4. `server/storage.ts` - Data Persistence

**Purpose:** Unified data access layer with PostgreSQL backend
**Key Interfaces:**
- `IStorage`: Complete CRUD operations interface
- `DatabaseStorage`: PostgreSQL implementation using Drizzle ORM

**Data Models:**
- `tradingAssets`: Asset configuration and intervals
- `trades`: Complete trade execution history
- `positions`: Real-time and historical positions
- `aiDecisionLogs`: Full OpenAI API call logging
- `aiReflections`: Performance analysis and improvements
- `persistentPnl`: Accumulated P&L across all trades
- `tradingStrategies`: AI prompt management system

### 5. `server/services/position-tracker.ts` - P&L Management

**Purpose:** Real-time position tracking and P&L calculation
**Key Functions:**
- `updateAssetPnL()`: Calculate and persist P&L from Alpaca positions
- `calculateStats()`: Generate performance metrics (win rate, Sharpe ratio)

**Logic:**
- Fetches real Alpaca positions every cycle
- Calculates unrealized P&L from market prices
- Maintains realized P&L from completed trades
- Provides accurate statistics for dashboard display

### 6. `client/src/components/TradingDashboard.tsx` - Main Interface

**Purpose:** Primary user interface for trading operations
**Features:**
- Multi-asset grid layout with real-time updates
- Live price charts using Chart.js
- Portfolio overview with total P&L
- WebSocket integration for real-time data

### 7. `client/src/pages/admin.tsx` - System Administration

**Purpose:** Administrative interface for system management
**Features:**
- Real-time system statistics
- Market sentiment analysis
- Asset management (add/edit/delete)
- Strategy backtesting interface
- API key management
- Real-time console with system logs

### 8. `server/services/logger.ts` - System Monitoring

**Purpose:** Comprehensive system logging and real-time console
**Features:**
- Captures all console output (info, error, warn, debug)
- HTTP request logging with response times
- WebSocket streaming to admin console
- Log filtering, export, and clearing capabilities

## Database Schema & Relationships

### Core Tables
- **tradingAssets**: Asset configuration (symbol, intervals, limits)
- **trades**: Complete trade history with AI reasoning
- **positions**: Position snapshots and P&L tracking  
- **persistentPnl**: Accumulated P&L by asset for statistics
- **aiDecisionLogs**: Full OpenAI API interactions
- **aiReflections**: Performance analysis and improvements
- **tradingStrategies**: AI prompt management with default selection
- **backtestResults**: Historical strategy performance testing

### Relationships
- Assets → Trades (one-to-many)
- Assets → Positions (one-to-many) 
- Assets → PnL Records (one-to-many)
- Strategies → AI Decisions (one-to-many)

## Real-time Communication System

### WebSocket Architecture
- **Asset Channels**: `/ws` with asset subscription model
- **Console Channel**: Real-time log streaming to admin panel
- **Auto-reconnection**: Exponential backoff on connection loss

### Message Types
- **Trading Updates**: Position changes, new trades, P&L updates
- **Chart Data**: Real-time price and volume updates
- **Statistics**: Win rates, Sharpe ratios, performance metrics
- **AI Logs**: Decision reasoning and execution results
- **Console Logs**: System messages, errors, request logs

## API Endpoints

### Trading APIs
```
GET /api/assets                    # List all trading assets
GET /api/assets/:symbol/dashboard  # Real-time dashboard data
POST /api/positions/:id/close      # Close specific position
GET /api/overview                  # Portfolio statistics
```

### AI & Strategy APIs
```
GET /api/ai-logs                   # AI decision logs with filtering
GET /api/strategies                # Trading strategy management
POST /api/strategies               # Create new strategy
PUT /api/strategies/:id            # Update strategy
DELETE /api/strategies/:id         # Delete strategy
```

### Admin APIs
```
GET /api/admin/system-stats        # System statistics
GET /api/admin/market-sentiment    # AI market sentiment analysis
POST /api/admin/export-and-reset   # Export data and reset system
GET /api/admin/console/logs        # Console log retrieval
POST /api/admin/console/clear      # Clear console logs
```

### Backtesting APIs
```
GET /api/backtests                 # List backtest results
POST /api/backtests/run           # Execute strategy backtest
DELETE /api/backtests/:id         # Delete backtest result
```

## Technical Implementation Details

### AI Strategy System
- **Default Strategy**: Single active strategy for all trading decisions
- **Custom Prompts**: System prompts define AI personality and approach
- **ICT/SMC Integration**: Market structure analysis in AI prompts
- **Performance Feedback**: AI reflections improve strategy over time

### Risk Management
- **Position Sizing**: Configurable percentage of account equity
- **Stop Loss/Take Profit**: Automated exit strategies
- **Account Protection**: Maximum position limits and safety checks
- **Real-time Monitoring**: Continuous P&L and drawdown tracking

### Performance Analytics
- **Win Rate Calculation**: Based on completed trades
- **Sharpe Ratio**: Risk-adjusted return measurement
- **Drawdown Tracking**: Maximum portfolio decline monitoring
- **Trade Frequency Analysis**: Optimal timing identification

### Data Sources
- **Primary**: Alpaca Markets API for trading and market data
- **Fallback**: CryptoCompare and Coinbase APIs for price data
- **Real-time**: WebSocket streams for live updates

## Development & Deployment

### Environment Setup
```bash
npm install                 # Install dependencies
npm run dev                # Start development server
npm run db:push            # Push database schema changes
```

### Environment Variables
```
ALPACA_API_KEY=paper_trading_key
ALPACA_SECRET_KEY=paper_trading_secret
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://connection_string
```

### Production Considerations
- **Database**: PostgreSQL with Drizzle ORM migrations
- **Monitoring**: PM2 process management with health checks
- **Security**: Environment-based API key management
- **Scaling**: WebSocket connection pooling and load balancing

This system provides a complete AI-powered trading solution with full transparency into AI decision-making, comprehensive logging, real-time monitoring, and advanced strategy management capabilities.