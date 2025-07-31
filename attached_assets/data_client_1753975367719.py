# tradingbot/data/data_client.py
import sys
print(sys.executable)

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoBarsRequest
from alpaca.data.timeframe import TimeFrame
import pandas as pd
from datetime import datetime, timedelta
from tradingbot.config import Config

class DataClient:
    def __init__(self):
        self.crypto_client = CryptoHistoricalDataClient(
            api_key=Config.ALPACA_API_KEY,
            secret_key=Config.ALPACA_SECRET_KEY
        )

    def get_historical_data(self, symbol: str, days: int = 30, timeframe: str = "1H") -> pd.DataFrame:
        tf_str = timeframe.lower()
        if tf_str == "1h":
            tf = TimeFrame.Hour
        elif tf_str == "1d":
            tf = TimeFrame.Day
        elif tf_str.endswith("min"):
            n = int(tf_str.replace("min", ""))
            tf = TimeFrame.Minute(amount=n)
        else:
            raise ValueError(f"Invalid timeframe: {timeframe}")

        start = datetime.utcnow() - timedelta(days=days)
        request = CryptoBarsRequest(
            symbol_or_symbols=[symbol],
            timeframe=tf,
            start=start
        )
        bars = self.crypto_client.get_crypto_bars(request)
        df = bars.df
        # Only filter if the symbol column exists (i.e., multiple symbols)
        if "symbol" in df.columns:
            df = df[df['symbol'] == symbol]
        df = df.reset_index(drop=True)
        return df



