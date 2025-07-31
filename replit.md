# AI Trading Bot System

## Overview
This project is a full-stack TypeScript trading bot application that integrates an AI-powered trading assistant. Its primary purpose is to analyze cryptocurrency markets using technical indicators and execute trades via the Alpaca API. The system leverages OpenAI for market analysis, PostgreSQL with Drizzle ORM for data persistence, and provides a real-time web dashboard built with React and WebSockets. The business vision is to create an intelligent, automated trading solution capable of strategic market engagement and continuous optimization.

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
- **Tables**: users, trading_assets, trades, positions, market_data, ai_reflections, trading_strategies, backtest_results

### Key System Features
- **AI Analysis**: OpenAI GPT-4o integration for market analysis using ICT/SMC strategies, with configurable data sources (multi-timeframe, customizable indicators, variable data points).
- **Trading Engine**: Supports technical indicators (RSI, MACD, Bollinger Bands, moving averages), risk management (position sizing, stop-loss, take-profit), Alpaca API integration for order execution, and an AI-powered reflection system for strategy optimization. Includes true short selling and sophisticated position management.
- **Real-time Dashboard**: Live charts (Chart.js), real-time trade execution updates via WebSocket, performance metrics (P&L, win rate, Sharpe ratio, drawdown), asset management, and a control panel for trading adjustments.
- **WebSocket Communication**: Asset-specific channels for trading updates, chart data, statistics, and AI reflections.
- **Data Flow**: Market data ingestion, AI analysis and decision generation, trade execution, data persistence, real-time updates via WebSockets, and periodic AI reflection for strategy optimization.
- **Strategy Management**: Full CRUD interface for customizing AI trading prompts and personalities, including a default strategy system.
- **Backtesting System**: Complete backtesting functionality using historical trading data with comprehensive performance analytics.
- **Manual Trading Interface**: Allows for direct trade execution with immediate updates.
- **System Reset**: Functionality to close Alpaca positions and clear all bot-related data, with clear explanations of Alpaca API limitations.

## External Dependencies

### Trading Infrastructure
- **Alpaca Markets API**: Cryptocurrency trading execution and market data.
- **OpenAI API**: GPT-4o model for intelligent market analysis.
- **Neon Database**: Serverless PostgreSQL hosting.

### Development Tools
- **Drizzle ORM**: Type-safe database operations.
- **TanStack Query**: Server state management.
- **Chart.js**: Professional charting library for financial visualizations.
- **Shadcn/ui**: Production-ready component library.