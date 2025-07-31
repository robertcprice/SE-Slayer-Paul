# AI Trading Bot System

## Overview

A sophisticated AI-powered cryptocurrency trading bot that integrates OpenAI's GPT-4o with Alpaca Markets for live trading. The system employs ICT (Inner Circle Trader) and SMC (Smart Money Concepts) strategies for intelligent market analysis and decision-making. Features real-time dashboard monitoring, comprehensive AI decision logging, and automated trading execution.

## Architecture

### Frontend (React + TypeScript)
```
client/src/
├── components/           # React components
│   ├── TradingDashboard.tsx    # Main dashboard container
│   ├── AssetPanel.tsx          # Individual asset trading panels
│   ├── AiLogsPanel.tsx         # AI decision logging interface
│   ├── Navigation.tsx          # App navigation bar
│   └── ui/                     # Shadcn/ui components
├── pages/                # Route pages
│   ├── dashboard.tsx           # Trading dashboard page
│   └── ai-logs.tsx            # AI logs viewing page
├── hooks/                # Custom React hooks
│   ├── useWebSocket.ts         # WebSocket connection management
│   └── use-toast.ts           # Toast notifications
└── lib/                  # Utilities
    ├── queryClient.ts          # TanStack Query configuration
    └── utils.ts               # Utility functions
```

### Backend (Node.js + Express + TypeScript)
```
server/
├── services/             # Business logic services
│   ├── trading.ts              # Core trading engine
│   ├── alpaca.ts              # Alpaca API integration
│   ├── openai.ts              # OpenAI API integration
│   └── data-client.ts         # Market data fetching
├── routes.ts             # API routes and WebSocket handlers
├── storage.ts            # Data persistence layer
├── index.ts              # Express server setup
└── vite.ts               # Vite dev server integration
```

### Shared (TypeScript Types)
```
shared/
└── schema.ts             # Database schema and shared types
```

## Key Components

### 1. Trading Engine (`server/services/trading.ts`)

**Core Functions:**
- `runTradingCycle()`: Main trading loop for each asset
- `executeTrade()`: Handles order execution via Alpaca API
- `getDashboardData()`: Aggregates real-time trading data

**Flow:**
1. Fetches historical market data (30 periods, 1-hour intervals)
2. Calculates technical indicators (RSI, MACD, Bollinger Bands, SMAs)
3. Sends market summary to OpenAI for ICT/SMC analysis
4. Executes trades based on AI recommendations
5. Updates positions and calculates P&L
6. Broadcasts updates via WebSocket

### 2. OpenAI Integration (`server/services/openai.ts`)

**Core Functions:**
- `analyzeMarketWithOpenAI()`: Sends market data to GPT-4o for analysis
- `generateReflection()`: Creates performance analysis after trades

**Features:**
- ICT/SMC strategy prompting (Market Structure, Liquidity Grabs, Fair Value Gaps)
- Comprehensive logging of every API call with timing and token usage
- JSON response format for structured trading decisions
- Error handling with fallback decisions

**Logged Data:**
- Full AI reasoning and recommendations
- Response time in milliseconds
- Token usage (prompt/completion/total)
- Market data sent to AI
- Complete raw OpenAI response
- Position sizing and risk parameters

### 3. Alpaca Integration (`server/services/alpaca.ts`)

**Core Functions:**
- `getAccount()`: Fetches account equity and buying power
- `getPositions()`: Retrieves current open positions
- `placeOrder()`: Executes buy/sell orders
- `getHistoricalData()`: Fetches market data for analysis

**Configuration:**
- Uses paper trading environment for safety
- Supports cryptocurrency trading (BTC/USD, SOL/USD)
- Real-time position tracking and P&L calculation

### 4. Data Storage (`server/storage.ts`)

**Storage Interface:**
- In-memory storage for development
- Database-ready structure for production deployment
- Supports trading assets, trades, positions, market data, AI reflections, and AI decision logs

**Key Tables:**
- `tradingAssets`: Asset configuration and trading intervals
- `trades`: Historical trade execution records
- `positions`: Current and historical position data
- `aiDecisionLogs`: Comprehensive OpenAI response logging
- `aiReflections`: Performance analysis and strategy improvements

### 5. WebSocket Communication (`server/routes.ts`)

**Features:**
- Asset-specific channels for real-time updates
- Automatic reconnection with exponential backoff
- Broadcasting of trading updates, chart data, and AI decisions

**Message Types:**
- Trading updates (new positions, P&L changes)
- Chart data (price and volume updates)
- Statistics (win rate, Sharpe ratio, drawdown)
- AI reflections and strategy improvements

### 6. Real-time Dashboard (`client/src/components/`)

**TradingDashboard.tsx:**
- Multi-asset monitoring interface
- Live price charts with Chart.js
- Real-time P&L and performance metrics

**AssetPanel.tsx:**
- Individual asset trading controls
- Pause/resume trading functionality
- Interval adjustment (1min to 1hour)
- Live position display and charts

**AiLogsPanel.tsx:**
- View all OpenAI API calls and responses
- Filter by asset and limit results
- Export logs as JSON or CSV
- Real-time token usage and cost tracking

### 7. API Routes (`server/routes.ts`)

**Trading APIs:**
- `GET /api/assets` - List configured trading assets
- `GET /api/assets/:symbol/dashboard` - Get real-time dashboard data

**AI Logging APIs:**
- `GET /api/ai-logs` - Fetch AI decision logs with filtering
- `GET /api/ai-logs/export/json` - Export logs as JSON
- `GET /api/ai-logs/export/csv` - Export logs as CSV

**WebSocket Endpoints:**
- `WS /ws` - Real-time trading updates and notifications

## Technical Stack

### Dependencies
- **Frontend**: React 18, TypeScript, TanStack Query, Wouter, Shadcn/ui, Chart.js
- **Backend**: Node.js, Express, TypeScript, WebSocket (ws)
- **Trading**: Alpaca Markets API (@alpacahq/alpaca-trade-api)
- **AI**: OpenAI API (gpt-4o model)
- **Database**: PostgreSQL with Drizzle ORM (ready for production)
- **Build**: Vite, esbuild

### Development Setup
```bash
npm install
npm run dev  # Starts both frontend and backend
```

### Environment Variables
```
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=your_postgresql_url (for production)
```

## Trading Strategy

### ICT/SMC Concepts Implemented
- **Market Structure**: Break of Structure (BOS), Change of Character (CHoCH)
- **Liquidity**: Liquidity grabs, inducements, relative equal highs/lows
- **Order Flow**: Fair value gaps (FVG), order blocks (OB)
- **Zones**: Premium/discount zones, imbalance areas
- **Session Analysis**: London/NY killzone timing

### Risk Management
- Configurable position sizing (0-100% of account equity)
- Stop-loss and take-profit automation
- Real-time P&L monitoring
- Drawdown tracking and alerts

### Performance Analytics
- Win rate calculation
- Sharpe ratio analysis
- Average win/loss tracking
- Trade frequency optimization

## AI Decision Logging

### Comprehensive Tracking
Every OpenAI API call is logged with:
- **Request Data**: Market summary, technical indicators, current positions
- **Response Data**: Trading recommendation, reasoning, position sizing
- **Metadata**: Response time, token usage, model version
- **Raw Data**: Complete OpenAI API response for debugging

### Export Capabilities
- **JSON Export**: Full structured data for analysis
- **CSV Export**: Spreadsheet-compatible format for reporting
- **Real-time Viewing**: Dashboard interface with filtering and search

### Cost Tracking
- Prompt token count
- Completion token count
- Total token usage per decision
- Response time monitoring for performance optimization

## Deployment

### Development
- Vite dev server with HMR for frontend development
- tsx for backend TypeScript execution
- In-memory storage for rapid prototyping

### Production
- Vite production build with code splitting
- PostgreSQL database with Drizzle migrations
- PM2 or Docker for process management
- Environment-based configuration

## Monitoring and Debugging

### Logging
- Structured console logging for all trading activities
- AI decision logging with full context
- WebSocket connection status tracking
- Error handling with detailed stack traces

### Dashboard Features
- Real-time connection status indicators
- Live position and P&L updates
- Trading activity feed
- AI reflection and performance insights

## Security Considerations

### API Key Management
- Environment variable storage
- No hardcoded credentials
- Separate development/production environments

### Trading Safety
- Paper trading environment by default
- Position size limits
- Stop-loss enforcement
- Manual override capabilities

This system provides a complete AI-powered trading solution with full transparency into AI decision-making, real-time monitoring, and comprehensive logging for analysis and optimization.