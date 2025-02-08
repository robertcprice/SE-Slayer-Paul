import os
from dotenv import load_dotenv
from anthropic import Anthropic

# Load environment variables
load_dotenv()  # This loads the .env file
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpha_vantage.cryptocurrencies import CryptoCurrencies
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import json
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
import asyncio
import pandas_ta as ta

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CryptoTradingBot:
    def __init__(self):
        # Initialize clients
        self.anthropic = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.trading_client = TradingClient(
            api_key=os.getenv('ALPACA_API_KEY'),
            secret_key=os.getenv('ALPACA_SECRET_KEY'),
            paper=True
        )
        
        # Alpaca crypto historical data client
        self.crypto_client = CryptoHistoricalDataClient()
        
        # Alpha Vantage setup for additional data
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_KEY')
        self.crypto = CryptoCurrencies(key=self.alpha_vantage_key)
        
        # Trading state
        self.symbol = "BTC/USD"
        self.analysis_cache = {}
        self.trades_history = []
        
    async def get_technical_indicators(self):
        """Get comprehensive technical analysis for Bitcoin."""
        try:
            # Get historical data from Alpaca
            request_params = CryptoBarsRequest(
                symbol_or_symbols=["BTC/USD"],
                timeframe=TimeFrame.Hour,
                start=datetime.now() - timedelta(days=30)
            )
            
            bars = self.crypto_client.get_crypto_bars(request_params)
            df = bars.df
            
            # Calculate technical indicators
            df['SMA_20'] = ta.sma(df['close'], length=20)
            df['SMA_50'] = ta.sma(df['close'], length=50)
            
            # MACD
            macd = ta.macd(df['close'])
            df['MACD'] = macd['MACD_12_26_9']
            df['MACD_Signal'] = macd['MACDs_12_26_9']
            df['MACD_Hist'] = macd['MACDh_12_26_9']
            
            # RSI
            df['RSI'] = ta.rsi(df['close'], length=14)
            
            # Bollinger Bands
            bb = ta.bbands(df['close'])
            df['BB_Upper'] = bb['BBU_20_2.0']
            df['BB_Middle'] = bb['BBM_20_2.0']
            df['BB_Lower'] = bb['BBL_20_2.0']
            
            # Volume analysis
            df['Volume_SMA'] = ta.sma(df['volume'], length=20)
            
            return {
                'price_data': df['close'].tail(50).to_dict(),
                'volume_data': df['volume'].tail(50).to_dict(),
                'indicators': {
                    'sma_20': df['SMA_20'].tail(50).to_dict(),
                    'sma_50': df['SMA_50'].tail(50).to_dict(),
                    'macd': df['MACD'].tail(50).to_dict(),
                    'macd_signal': df['MACD_Signal'].tail(50).to_dict(),
                    'rsi': df['RSI'].tail(50).to_dict(),
                    'bb_upper': df['BB_Upper'].tail(50).to_dict(),
                    'bb_lower': df['BB_Lower'].tail(50).to_dict()
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting technical indicators: {str(e)}")
            return None

    async def analyze_market_conditions(self, technical_data):
        """Get trading analysis from Claude Opus."""
        try:
            prompt = f"""Analyze Bitcoin trading conditions with the following data:
            
            Technical Indicators:
            {json.dumps(technical_data, indent=2)}
            
            Consider these crypto-specific factors:
            1. 24/7 trading nature
            2. High volatility
            3. Global market influence
            4. On-chain metrics implications
            
            Please analyze this data and provide:
            1. Current market condition assessment
            2. Key support and resistance levels
            3. Trend direction and strength
            4. Volatility analysis
            5. Specific trading recommendation (BUY/SELL/HOLD)
            6. Position sizing recommendation (1-100%)
            7. Stop loss and take profit levels (as percentages)
            
            Format your response as JSON with these exact keys:
            market_condition, support_levels, resistance_levels, trend, volatility, recommendation, 
            position_size, stop_loss_pct, take_profit_pct, reasoning
            """
            
            message = await asyncio.to_thread(
                self.anthropic.messages.create,
                model="claude-3-opus-20240229",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Parse JSON response
            analysis = json.loads(message.content[0].text)
            self.analysis_cache['BTC'] = analysis
            return analysis
            
        except Exception as e:
            logger.error(f"Error getting Claude analysis: {str(e)}")
            return None

    async def execute_trade(self, analysis):
        """Execute crypto trade based on analysis."""
        try:
            if analysis['recommendation'] in ['BUY', 'SELL']:
                # Calculate position size
                account = self.trading_client.get_account()
                buying_power = float(account.buying_power)
                position_value = buying_power * (analysis['position_size'] / 100)
                
                # Get current price from Alpaca
                request_params = CryptoBarsRequest(
                    symbol_or_symbols=["BTC/USD"],
                    timeframe=TimeFrame.Minute,
                    start=datetime.now() - timedelta(minutes=5)
                )
                
                bars = self.crypto_client.get_crypto_bars(request_params)
                current_price = bars.df['close'].iloc[-1]
                
                # Calculate quantity
                quantity = position_value / current_price
                
                if quantity > 0:
                    order_data = MarketOrderRequest(
                        symbol="BTC/USD",
                        qty=quantity,
                        side=OrderSide.BUY if analysis['recommendation'] == 'BUY' else OrderSide.SELL,
                        time_in_force=TimeInForce.DAY
                    )
                    
                    order = self.trading_client.submit_order(order_data)
                    
                    # Record trade
                    trade_record = {
                        'timestamp': datetime.now().isoformat(),
                        'symbol': "BTC/USD",
                        'action': analysis['recommendation'],
                        'quantity': quantity,
                        'price': current_price,
                        'reasoning': analysis['reasoning']
                    }
                    self.trades_history.append(trade_record)
                    
                    return order
                    
        except Exception as e:
            logger.error(f"Error executing trade: {str(e)}")
            return None

    async def run_trading_cycle(self):
        """Run a complete trading cycle."""
        while True:
            try:
                # Get technical data
                technical_data = await self.get_technical_indicators()
                if technical_data:
                    # Get analysis
                    analysis = await self.analyze_market_conditions(technical_data)
                    if analysis:
                        # Execute trade if recommended
                        await self.execute_trade(analysis)
                
                # Wait before next cycle - shorter for crypto due to volatility
                await asyncio.sleep(900)  # 15 minutes between cycles
                    
            except Exception as e:
                logger.error(f"Error in trading cycle: {str(e)}")
                await asyncio.sleep(60)  # Wait if error occurs

    def get_performance_metrics(self):
        """Calculate performance metrics for backtesting display."""
        try:
            account = self.trading_client.get_account()
            
            # Calculate advanced metrics
            trades_df = pd.DataFrame(self.trades_history)
            if not trades_df.empty:
                trades_df['returns'] = trades_df['price'].pct_change()
                
                metrics = {
                    'total_trades': len(self.trades_history),
                    'win_rate': len(trades_df[trades_df['returns'] > 0]) / len(trades_df),
                    'profit_loss': float(account.portfolio_value) - float(account.initial_margin),
                    'sharpe_ratio': trades_df['returns'].mean() / trades_df['returns'].std() * np.sqrt(365),
                    'max_drawdown': (trades_df['price'].cummax() - trades_df['price']).max(),
                    'recent_trades': self.trades_history[-10:],
                    'volatility': trades_df['returns'].std() * np.sqrt(365)
                }
            else:
                metrics = {
                    'total_trades': 0,
                    'win_rate': 0,
                    'profit_loss': 0,
                    'sharpe_ratio': 0,
                    'max_drawdown': 0,
                    'recent_trades': [],
                    'volatility': 0
                }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating metrics: {str(e)}")
            return None

# FastAPI setup
app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")

from fastapi.templating import Jinja2Templates
from fastapi import Request

# Setup templates
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    bot = CryptoTradingBot()
    
    # Start trading cycle
    trading_task = asyncio.create_task(bot.run_trading_cycle())
    
    try:
        while True:
            # Send updates to frontend
            update = {
                'analysis_cache': bot.analysis_cache,
                'trades_history': bot.trades_history,
                'performance': bot.get_performance_metrics()
            }
            await websocket.send_json(update)
            await asyncio.sleep(5)
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()
        trading_task.cancel()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)