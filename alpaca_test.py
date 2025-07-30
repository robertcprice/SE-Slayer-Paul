# alpaca_test.py
from dotenv import load_dotenv
import os
from alpaca.trading.client import TradingClient

load_dotenv()
api = os.getenv('ALPACA_API_KEY')
secret = os.getenv('ALPACA_SECRET_KEY')

if not api or not secret:
    raise Exception("Alpaca keys not found in environment!")

client = TradingClient(api, secret, paper=True)
account = client.get_account()
print("Account status:", account.status)
print("Equity:", account.equity)

