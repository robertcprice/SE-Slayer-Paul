# trading/indicators.py

import pandas as pd
import pandas_ta as ta

def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds common technical indicators to the DataFrame.
    - SMA20, SMA50
    - EMA20, EMA50
    - RSI (14)
    - MACD
    - Bollinger Bands (20, 2)
    - Volume SMA (20)
    """
    # Moving Averages
    df['SMA20'] = ta.sma(df['close'], length=20)
    df['SMA50'] = ta.sma(df['close'], length=50)
    df['EMA20'] = ta.ema(df['close'], length=20)
    df['EMA50'] = ta.ema(df['close'], length=50)

    # RSI
    df['RSI14'] = ta.rsi(df['close'], length=14)

    # MACD
    macd = ta.macd(df['close'])
    df['MACD'] = macd['MACD_12_26_9']
    df['MACD_signal'] = macd['MACDs_12_26_9']
    df['MACD_hist'] = macd['MACDh_12_26_9']

    # Bollinger Bands
    bb = ta.bbands(df['close'], length=20, std=2)
    df['BB_upper'] = bb['BBU_20_2.0']
    df['BB_middle'] = bb['BBM_20_2.0']
    df['BB_lower'] = bb['BBL_20_2.0']

    # Volume SMA
    if 'volume' in df.columns:
        df['Volume_SMA20'] = ta.sma(df['volume'], length=20)

    # Drop NaN rows created by indicators
    df = df.dropna().reset_index(drop=True)
    return df

def summarize_for_ai(df: pd.DataFrame, bars: int = 30) -> dict:
    """
    Prepares a compact summary for the AI agent: last N bars of prices and indicators.
    """
    last = df.tail(bars)
    return {
        "close": last['close'].round(2).tolist(),
        "rsi": last['RSI14'].round(2).tolist(),
        "macd": last['MACD'].round(2).tolist(),
        "macd_signal": last['MACD_signal'].round(2).tolist(),
        "bb_upper": last['BB_upper'].round(2).tolist(),
        "bb_lower": last['BB_lower'].round(2).tolist(),
        "sma20": last['SMA20'].round(2).tolist(),
        "sma50": last['SMA50'].round(2).tolist(),
        "ema20": last['EMA20'].round(2).tolist(),
        "ema50": last['EMA50'].round(2).tolist(),
        "volume": last['volume'].round(0).astype(int).tolist() if 'volume' in last else [],
        "timestamp": last['timestamp'].astype(str).tolist() if 'timestamp' in last else []
    }
