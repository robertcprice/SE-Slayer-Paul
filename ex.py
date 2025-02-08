from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

# Paper trading API info
API_KEY = "PK1J5Z41C23EN991WWR6"
API_SECRET = "qng7l3vbZIrSriJCPMYNB0STl7NpjervwbqkXWjt"

# Initialize trading client
trading_client = TradingClient(API_KEY, API_SECRET, paper=True)

# Get account info
account = trading_client.get_account()
print(account.status)
