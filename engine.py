import os
from dotenv import load_dotenv
from anthropic import Anthropic

# Load environment variables
load_dotenv()  # This loads the .env file

# Configuration for update intervals (in seconds)
WEB_UPDATE_INTERVAL = int(os.getenv('WEB_UPDATE_INTERVAL', 300))       # default: 5 minutes
TRADING_CYCLE_INTERVAL = int(os.getenv('TRADING_CYCLE_INTERVAL', 900))   # default: 15 minutes

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
        # Initialize clients using proper environment variable names
        self.anthropic = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        self.trading_client = TradingClient(
            api_key=os.getenv('ALPACA_API_KEY'),
            secret_key=os.getenv('ALPACA_SECRET_KEY'),
            paper=True
        )
        
        # Alpaca crypto historical data client (if needed, pass API keys here too)
        self.crypto_client = CryptoHistoricalDataClient()
        
        # Alpha Vantage setup for additional data
        self.alpha_vantage_key = os.getenv('ALPHA_VANTAGE_KEY')
        self.crypto = CryptoCurrencies(key=self.alpha_vantage_key)
        
        # Trading state
        self.symbol = "BTC/USD"
        self.analysis_cache = {}
        self.trades_history = []
        
    async def get_technical_indicators(self):
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
            logger.info(f"Bollinger Bands columns: {bb.columns.tolist()}")

            # Extract Bollinger Bands columns based on substring matching.
            bb_upper_col = next((col for col in bb.columns if "BBU" in col), None)
            bb_middle_col = next((col for col in bb.columns if "BBM" in col), None)
            bb_lower_col = next((col for col in bb.columns if "BBL" in col), None)
            if not (bb_upper_col and bb_middle_col and bb_lower_col):
                raise KeyError(f"Expected Bollinger Bands columns not found in: {bb.columns.tolist()}")
            
            df['BB_Upper'] = bb[bb_upper_col]
            df['BB_Middle'] = bb[bb_middle_col]
            df['BB_Lower'] = bb[bb_lower_col]
            
            # Volume analysis
            df['Volume_SMA'] = ta.sma(df['volume'], length=20)
            
            # Helper function to convert keys to strings
            def convert_keys_to_str(d):
                return {str(k): v for k, v in d.items()}
            
            # Use tail(50) for internal use (e.g., charting) but analysis prompt will trim this data.
            return {
                'price_data': convert_keys_to_str(df['close'].tail(50).to_dict()),
                'volume_data': convert_keys_to_str(df['volume'].tail(50).to_dict()),
                'indicators': {
                    'sma_20': convert_keys_to_str(df['SMA_20'].tail(50).to_dict()),
                    'sma_50': convert_keys_to_str(df['SMA_50'].tail(50).to_dict()),
                    'macd': convert_keys_to_str(df['MACD'].tail(50).to_dict()),
                    'macd_signal': convert_keys_to_str(df['MACD_Signal'].tail(50).to_dict()),
                    'rsi': convert_keys_to_str(df['RSI'].tail(50).to_dict()),
                    'bb_upper': convert_keys_to_str(df['BB_Upper'].tail(50).to_dict()),
                    'bb_lower': convert_keys_to_str(df['BB_Lower'].tail(50).to_dict())
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting technical indicators: {str(e)}")
            return None

    async def analyze_market_conditions(self, technical_data):
        try:
            # Function to trim a dictionary to only its last num_points items
            def trim_data(d, num_points=20):
                if isinstance(d, dict):
                    keys = list(d.keys())
                    return {k: d[k] for k in keys[-num_points:]}
                return d

            # Trim the data in technical_data to reduce prompt size.
            trimmed_data = {}
            for key, value in technical_data.items():
                if isinstance(value, dict):
                    trimmed_data[key] = trim_data(value, num_points=20)
                elif isinstance(value, list):
                    trimmed_data[key] = value[-20:]
                else:
                    trimmed_data[key] = value

            # Build a compact prompt in Anthropic’s conversational format.
            prompt = (
                f"Human: Analyze the following market data:\n{json.dumps(trimmed_data)}\n\n"
                "Consider these crypto-specific factors:\n"
                "1. 24/7 trading nature\n"
                "2. High volatility\n"
                "3. Global market influence\n"
                "4. On-chain metrics implications\n\n"
                "Please analyze this data and provide:\n"
                "1. Current market condition assessment\n"
                "2. Key support and resistance levels\n"
                "3. Trend direction and strength\n"
                "4. Volatility analysis\n"
                "5. Specific trading recommendation (BUY/SELL/HOLD)\n"
                "6. Position sizing recommendation (1-100%)\n"
                "7. Stop loss and take profit levels (as percentages)\n\n"
                "Format your response as JSON with these exact keys:\n"
                "market_condition, support_levels, resistance_levels, trend, volatility, recommendation, "
                "position_size, stop_loss_pct, take_profit_pct, reasoning\n\n"
                "Assistant:"
            )
            
            message = await asyncio.to_thread(
                self.anthropic.messages.create,
                model="claude-3-opus-20240229",
                max_tokens=512,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Log the raw response for debugging.
            raw_response = message.content[0].text
            logger.info(f"Anthropic raw response: {raw_response}")
            
            # Extract JSON starting at the first "{" character.
            json_start = raw_response.find('{')
            if json_start == -1:
                logger.error("No JSON found in Anthropic response")
                return None
            json_str = raw_response[json_start:]
            
            # Parse JSON using strict=False to allow unescaped control characters.
            analysis = json.loads(json_str, strict=False)
            self.analysis_cache['BTC'] = analysis
            return analysis
            
        except Exception as e:
            logger.error(f"Error getting Claude analysis: {str(e)}")
            return None

    async def execute_trade(self, analysis):
        try:
            # Only execute trade if recommendation is BUY or SELL and position_size is nonzero.
            if analysis['recommendation'] in ['BUY', 'SELL'] and analysis.get('position_size', 0) > 0:
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
                
                # Wait for the configured trading cycle interval (default 15 minutes)
                await asyncio.sleep(TRADING_CYCLE_INTERVAL)
                    
            except Exception as e:
                logger.error(f"Error in trading cycle: {str(e)}")
                await asyncio.sleep(60)  # Wait if error occurs

    def get_performance_metrics(self):
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
    
    # Start the trading cycle as a background task.
    trading_task = asyncio.create_task(bot.run_trading_cycle())
    
    try:
        while True:
            # Send updates to the frontend at the configured interval (default 5 minutes)
            update = {
                'analysis_cache': bot.analysis_cache,
                'trades_history': bot.trades_history,
                'performance': bot.get_performance_metrics()
            }
            await websocket.send_json(update)
            await asyncio.sleep(WEB_UPDATE_INTERVAL)
            
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        await websocket.close()
        trading_task.cancel()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
