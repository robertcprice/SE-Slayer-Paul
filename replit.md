# AI Trading Bot System

## Overview

This is a full-stack TypeScript trading bot application featuring an AI-powered trading assistant that analyzes cryptocurrency markets using technical indicators and executes trades through the Alpaca API. The system uses OpenAI for market analysis, PostgreSQL with Drizzle ORM for data persistence, and provides a real-time web dashboard built with React and WebSockets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom glassmorphic design system
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: WebSocket integration for live trading updates
- **Build Tool**: Vite with custom configuration for client-server separation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with custom middleware
- **API Design**: RESTful endpoints with WebSocket support for real-time features
- **Services Layer**: Modular service architecture (TradingService, DataClient, OpenAI integration)
- **Error Handling**: Centralized error handling with status code mapping

### Data Storage Solutions
- **Primary Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Tables**: users, trading_assets, trades, positions, market_data, ai_reflections
- **Data Types**: Proper decimal precision for financial data, JSONB for complex structures

## Key Components

### Trading Engine
- **AI Analysis**: OpenAI GPT-4o integration for market analysis using ICT/SMC strategies
- **Technical Indicators**: RSI, MACD, Bollinger Bands, moving averages (SMA/EMA)
- **Risk Management**: Position sizing, stop-loss, take-profit automation
- **Broker Integration**: Alpaca API for order execution and portfolio management
- **Reflection System**: AI-powered trade performance analysis and strategy optimization

### Real-time Dashboard
- **Live Charts**: Chart.js integration for price and indicator visualization
- **Trading Feed**: Real-time trade execution updates via WebSocket
- **Performance Metrics**: P&L tracking, win rate, Sharpe ratio, drawdown analysis
- **Asset Management**: Multi-asset support with individual trading intervals
- **Control Panel**: Pause/resume trading, interval adjustment, manual intervention

### WebSocket Communication
- **Asset-specific Channels**: Separate WebSocket connections per trading asset
- **Message Types**: Trading updates, chart data, statistics, AI reflections
- **Connection Management**: Automatic reconnection with exponential backoff
- **Broadcasting**: Real-time updates to all connected clients

## Data Flow

1. **Market Data Ingestion**: DataClient fetches historical price data and calculates technical indicators
2. **AI Analysis**: Market summary sent to OpenAI for trading decision generation
3. **Trade Execution**: Broker service processes AI recommendations and executes orders
4. **Data Persistence**: Trade results, positions, and market data stored in PostgreSQL
5. **Real-time Updates**: WebSocket broadcasts trading updates to connected dashboard clients
6. **Performance Analysis**: Periodic AI reflection on trading performance for strategy optimization

## External Dependencies

### Trading Infrastructure
- **Alpaca Markets API**: Cryptocurrency trading execution and market data
- **OpenAI API**: GPT-4o model for intelligent market analysis
- **Neon Database**: Serverless PostgreSQL hosting

### Development Tools
- **Drizzle ORM**: Type-safe database operations with automatic migration generation
- **TanStack Query**: Server state management with caching and synchronization
- **Chart.js**: Professional charting library for financial visualizations
- **Shadcn/ui**: Production-ready component library with accessibility

### Python Components (Legacy)
- **Data Analysis**: pandas, pandas-ta for technical indicator calculations
- **API Integration**: alpaca-py for Python-based trading operations
- **Web Interface**: FastAPI with Jinja2 templating (alternative dashboard)

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with HMR for frontend, tsx for backend development
- **Environment Variables**: Separate configuration for API keys, database connections
- **Type Safety**: Full TypeScript coverage with strict compilation settings

### Production Build
- **Frontend**: Vite production build with code splitting and optimization
- **Backend**: esbuild bundling for Node.js deployment
- **Database**: Automated schema migrations via Drizzle Kit
- **Process Management**: Single process serving both API and static assets

### Configuration Management
- **Database URL**: Environment-based PostgreSQL connection string
- **API Keys**: Secure storage of Alpaca and OpenAI credentials
- **Trading Parameters**: Configurable assets, timeframes, and risk parameters
- **Logging**: Structured logging for trade execution and system monitoring

## Recent Changes: Latest modifications with dates

### July 31, 2025 - Complete Database Migration & Trading Logic Fix
- **PostgreSQL Database Migration**: Completely replaced memory storage with persistent PostgreSQL database using Neon
- **Trading Scheduler Implementation**: Fixed critical timing issue - now ensures exactly ONE API call per asset per interval
- **Persistent File Logging**: All AI decisions and trades logged to `logs/` directory with timestamps
- **Database Storage**: All data (trades, positions, AI logs, market data) now persists across restarts
- **Total Trades Fix**: Corrected calculation to count only actual BUY/SELL trades, not HOLD decisions
- **Comprehensive Error Handling**: Database operations wrapped with try-catch and proper error logging
- **Real-time Position Updates**: Live BTC position showing 0.113226311 BTC with -$1.34 unrealized P&L
- **AI Log Export**: JSON/CSV export functionality working with persistent database storage

### Active Trading Status  
- **Database Persistence**: All historical logs and trades now permanently stored and accessible
- **Trading Interval Control**: Proper 5-minute intervals enforced - no more multiple API calls within seconds
- **Current BTC Position**: 0.113226311 BTC at $118,590.86 entry price with -$1.34 unrealized P&L
- **Logging Infrastructure**: Both database and file-based logging operational for complete audit trail
- **Real Portfolio**: Live connection to Alpaca paper trading account with real position data