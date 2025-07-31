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

### July 31, 2025 - Admin Panel Configuration Controls
- **Asset Management Panel**: Complete UI for adding, editing, and removing trading assets
- **Trading Parameter Controls**: Real-time editing of max position size, stop loss, and take profit percentages
- **Database Schema Extension**: Added risk management fields to trading_assets table
- **Asset-Specific Settings**: Individual configuration per asset with persistent storage
- **API Endpoints**: Full CRUD operations for asset management (/api/admin/assets)
- **Live Configuration Updates**: Changes immediately affect trading parameters without restart

### July 31, 2025 - P&L Graph Enhancement & Automated AI Analysis
- **P&L Graph Update**: Modified to show 5-minute intervals over past 2 hours instead of 24-hour view
- **Enhanced Controls**: Pause/interval dropdown controls now properly update database via API calls
- **Automated AI Scheduler**: Created AISchedulerService for strategy analysis every 2 hours
- **Real-time Analysis**: AI scheduler generates strategy improvements and stores reflections in database
- **Performance Tracking**: Comprehensive metrics calculation (win rate, P&L, drawdown) for AI analysis
- **Auto-Start Integration**: AI scheduler automatically starts with server and monitors all active assets

### July 31, 2025 - Complete Strategy Management & Backtesting System
- **Strategy Editor Implementation**: Full CRUD interface for customizing AI trading prompts and personalities
- **Character Limits**: 200-character limit on personality prompts with real-time counter
- **Default Strategy System**: Automatic management of default strategy with database enforcement
- **Backtesting Engine**: Complete backtesting functionality using historical trading data
- **Performance Analytics**: Comprehensive backtest metrics (Sharpe ratio, max drawdown, profit factor)
- **Database Integration**: New tables for trading_strategies and backtest_results with full persistence
- **Navigation Enhancement**: Added Strategy Editor and Backtesting pages to main navigation
- **Real Trading Data**: Backtesting uses actual trade history from database for accurate performance analysis
- **Multi-Asset Support**: Strategy editor and backtesting work with all configured trading assets

### July 31, 2025 - Configurable OpenAI Data Sources
- **Multi-Timeframe Support**: Added support for 1m, 5m, 15m, and 1h data analysis with dual timeframe capability
- **Data Configuration UI**: New strategy editor section for configuring OpenAI input data
- **Customizable Indicators**: Checkbox interface for selecting which technical indicators to send to OpenAI
- **Variable Data Points**: Configurable number of historical candles (10-1000) for analysis
- **Database Schema Extension**: Extended trading_strategies table with data configuration fields
- **Enhanced Data Client**: Updated to generate data for different timeframes with proper interval calculations
- **OpenAI Service Enhancement**: Modified to use strategy-specific data configuration instead of fixed inputs
- **Selective Technical Analysis**: AI now receives only the indicators specified in the strategy configuration

### July 31, 2025 - Manual Trading Interface & Trade Execution Fix
- **Manual Trading UI**: Added floating action button with modal interface for direct trade execution
- **Asset Selection**: Dropdown menu for choosing BTC/USD, SOL/USD, or other configured assets
- **Trade Parameters**: Input fields for quantity, optional price (defaults to market), and buy/sell actions
- **Trade Execution Fix**: Modified trading service to always execute AI recommendations with simulated fills
- **Position Management**: Enhanced position tracking with proper quantity and P&L calculations
- **Real-time Updates**: Manual trades trigger WebSocket broadcasts for immediate dashboard updates
- **API Endpoint**: New /api/trades/manual endpoint for executing direct trading orders
- **Database Integration**: Manual trades stored alongside AI trades with execution metadata

### July 31, 2025 - True Short Selling Implementation
- **Bidirectional Trading**: Complete short selling support - SELL orders now open short positions when no long position exists
- **Position Reversal Logic**: Sophisticated position management allowing seamless transitions between long and short positions
- **Smart Position Sizing**: AI can now close existing positions and open opposite positions in single trade
- **Enhanced AI Prompt**: Updated OpenAI prompt with detailed position management rules and sizing strategies
- **Short Position P&L**: Proper profit/loss calculations for short positions (inverted from long positions)
- **Position State Management**: System tracks both long and short positions with accurate quantity and entry price averaging
- **Automated Position Transitions**: When SELL quantity exceeds long position, automatically closes long and opens short with remainder

### July 31, 2025 - Complete Reset System & UI Improvements  
- **Export & Reset All Data**: Complete system reset with JSON export of all trading data before clearing database
- **Alpaca Account Reset**: Button to close all Alpaca paper trading positions with robust error handling
- **Demo Mode Support**: Graceful fallback when Alpaca API is not accessible, simulates position closure
- **Internal Position Reset**: Both Alpaca and internal database positions are closed during account reset
- **Simple Theme Picker**: Redesigned theme controls as two small color boxes in top left corner
- **Enhanced Error Handling**: Comprehensive error handling for API failures with informative user feedback
- **Data Export Format**: Complete JSON export includes trades, positions, AI logs, reflections, market data, and statistics
- **Reset Confirmation Dialogs**: Warning dialogs with detailed information about irreversible actions

### July 31, 2025 - Fixed Critical Reset & Manual Trading Issues
- **Complete Data Reset**: Alpaca account reset now clears ALL trading data including trades, AI logs, and statistics
- **Manual Trade P&L Fix**: Manual trades now properly calculate and update position P&L in real-time
- **Position Management Enhancement**: Improved position tracking combining both Alpaca and internal database positions
- **P&L Calculation Accuracy**: Fixed unrealized P&L calculations for both BUY and SELL manual trades
- **Dashboard Synchronization**: Manual trades and resets now immediately update dashboard with accurate position data
- **Database Consistency**: Enhanced position updates with proper quantity averaging and P&L tracking
- **Trade Feed Integration**: Manual trades properly appear in trade feed with correct P&L display

### July 31, 2025 - Simplified Reset System with Clear Alpaca Limitations
- **Clarified Reset Functionality**: Updated reset system to clearly explain Alpaca API limitations regarding account balance changes
- **Single Reset Button**: Simplified to one "Close Positions & Reset Data" button that closes Alpaca positions and clears bot data
- **Clear User Instructions**: Prominent instructions for users to manually create new Alpaca paper account for balance changes
- **Accurate Messaging**: Backend and frontend messages now clearly state what the reset actually does vs what requires manual action
- **Removed Target Equity Input**: Eliminated confusing target equity field since API cannot set account balance programmatically
- **User Education**: Added helpful step-by-step instructions for Alpaca dashboard account management

### Active Trading Status  
- **Database Persistence**: All historical logs and trades now permanently stored and accessible
- **Trading Interval Control**: Proper 5-minute intervals enforced - no more multiple API calls within seconds
- **Trade Execution**: AI recommendations now properly execute with simulated fills when Alpaca API unavailable
- **Manual Trading**: Users can execute direct trades through dashboard interface with immediate position updates
- **Position Tracking**: Real-time position updates showing quantity, entry price, and unrealized P&L
- **Logging Infrastructure**: Both database and file-based logging operational for complete audit trail
- **Real Portfolio**: Live connection to Alpaca paper trading account with simulated execution fallback
- **Strategy Management**: ICT Smart Money Concepts strategy configured as default with conservative personality
- **Backtesting Ready**: System can analyze historical performance using actual trading data from database
- **Reset Clarity**: Users now understand exactly what reset functions do and what requires manual Alpaca dashboard actions