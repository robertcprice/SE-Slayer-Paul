# trading/broker.py

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.models import Position
from tradingbot.config import Config
import logging

class Broker:
    def __init__(self):
        self.client = TradingClient(
            api_key=Config.ALPACA_API_KEY,
            secret_key=Config.ALPACA_SECRET_KEY,
            paper=Config.TRADING_PAPER
        )

    def get_account_info(self):
        try:
            return self.client.get_account()
        except Exception as e:
            logging.error(f"Broker: get_account_info failed: {e}")
            return None

    def get_positions(self):
        try:
            return self.client.get_all_positions()
        except Exception as e:
            logging.error(f"Broker: get_positions failed: {e}")
            return []

    def submit_market_order(self, symbol: str, qty: float, side: str) -> dict:
        """
        side: "BUY" or "SELL"
        qty: base currency amount (ex: 0.05 BTC)
        """
        try:
            order = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL,
                time_in_force=TimeInForce.GTC
            )
            resp = self.client.submit_order(order)
            logging.info(f"Market order submitted: {side} {qty} {symbol}")
            return resp
        except Exception as e:
            logging.error(f"Broker: submit_market_order failed: {e}")
            return {"error": str(e)}

    def close_position(self, symbol: str) -> dict:
        try:
            resp = self.client.close_position(symbol)
            logging.info(f"Position closed: {symbol}")
            return resp
        except Exception as e:
            logging.error(f"Broker: close_position failed: {e}")
            return {"error": str(e)}
