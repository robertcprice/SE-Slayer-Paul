# tradingbot/utils/performance.py

from tradingbot.utils.trade_log import load_trade_log
import numpy as np
import pandas as pd

def trade_performance_stats(asset):
    df = load_trade_log(asset)
    if df.empty:
        return {}

    # PnL: For now, price * qty (improve with direction logic if needed)
    df["qty"] = pd.to_numeric(df["qty"], errors="coerce").fillna(0)
    df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0)
    df["pnl"] = df["qty"] * df["price"]

    win_trades = df[df["pnl"] > 0]
    loss_trades = df[df["pnl"] < 0]

    stats = {
        "total_trades": int(len(df)),
        "net_pnl": float(df["pnl"].sum()),
        "average_win": float(win_trades["pnl"].mean()) if not win_trades.empty else 0,
        "average_loss": float(loss_trades["pnl"].mean()) if not loss_trades.empty else 0,
        "win_rate": float(len(win_trades) / len(df)) if len(df) else 0,
        "best_trade": win_trades.iloc[win_trades["pnl"].idxmax()].to_dict() if not win_trades.empty else {},
        "worst_trade": loss_trades.iloc[loss_trades["pnl"].idxmin()].to_dict() if not loss_trades.empty else {},
    }
    return stats

def best_asset_overall(assets):
    best = None
    best_pnl = float('-inf')
    for asset in assets:
        stats = trade_performance_stats(asset)
        if stats and stats["net_pnl"] > best_pnl:
            best = asset
            best_pnl = stats["net_pnl"]
    return best, best_pnl
