# data/data_client.py

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame
import pandas as pd
from datetime import datetime, timedelta
from tradingbot.config import Config

class DataClient:
    def __init__(self):
        # Paper/live trading doesn't matter for data API keys
        self.crypto_client = CryptoHistoricalDataClient(
            api_key=Config.ALPACA_API_KEY,
            secret_key=Config.ALPACA_SECRET_KEY
        )

    def get_historical_data(self, symbol: str, days: int = 30, timeframe: str = "1H") -> pd.DataFrame:
        """
        Fetches OHLCV data for a symbol over the past `days` with given timeframe.
        symbol: "BTC/USD", "SOL/USD", etc.
        timeframe: "1H", "15Min", "5Min" (see alpaca-py docs for options)
        """
        # Map string to Alpaca's TimeFrame object
        tf_map = {
            "1H": TimeFrame.Hour,
            "15Min": TimeFrame.Min,
            "5Min": TimeFrame.Min,
            "1D": TimeFrame.Day
        }
        tf = tf_map.get(timeframe, TimeFrame.Hour)

        start = datetime.utcnow() - timedelta(days=days)
        request = CryptoBarsRequest(
            symbol_or_symbols=[symbol],
            timeframe=tf,
            start=start
        )
        bars = self.crypto_client.get_crypto_bars(request)
        df = bars.df
        # Alpaca returns multiindex if you request >1 symbol, so filter just this symbol
        df = df[df['symbol'] == symbol]
        df = df.reset_index(drop=True)
        return df

