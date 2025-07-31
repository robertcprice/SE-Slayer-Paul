import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    ALPACA_API_KEY = os.getenv('ALPACA_API_KEY')
    ALPACA_SECRET_KEY = os.getenv('ALPACA_SECRET_KEY')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
    ASSETS = ["BTC/USD", "SOL/USD"]
    TIMEFRAME = "1H"  # 1 hour bars (can be changed)
    TRADING_PAPER = True  # Paper trade mode

