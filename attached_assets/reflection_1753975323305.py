# tradingbot/utils/reflection.py

import json
import os
from tradingbot.utils.trade_log import load_trade_log, TRADE_LOG_HEADER
from tradingbot.utils.performance import trade_performance_stats

def summarize_last_n_trades(asset, n=10):
    df = load_trade_log(asset)
    if df.empty:
        return "No trades yet."
    last_trades = df.tail(n)
    stats = trade_performance_stats(asset)
    summary = (
        f"Last {n} trades summary for {asset}:\n"
        f"Net P&L: {stats['net_pnl']:.2f}\n"
        f"Average Win: {stats['average_win']:.2f}\n"
        f"Average Loss: {stats['average_loss']:.2f}\n"
        f"Win Rate: {stats['win_rate']*100:.1f}%\n"
        f"Best trade: {stats['best_trade']}\n"
        f"Worst trade: {stats['worst_trade']}\n"
    )
    style_info = "; ".join(last_trades["ai_reasoning"].dropna().tail(n))
    prompt = (
        summary +
        f"\nAnalyze the trading style based on the above and these AI reasonings: {style_info}. "
        "What works best, what doesn't, and how can this strategy be improved? "
        "Be concise. Respond in JSON with keys: 'reflection', 'improvements', 'stat_summary'."
    )
    return prompt

def log_reflection(asset, reflection):
    log_path = f"logs/{asset.replace('/', '-')}_reflections.jsonl"
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a") as f:
        f.write(json.dumps(reflection) + "\n")

def load_last_reflection(asset):
    log_path = f"logs/{asset.replace('/', '-')}_reflections.jsonl"
    if not os.path.exists(log_path):
        return None
    with open(log_path, "r") as f:
        lines = f.readlines()
        if not lines:
            return None
        return json.loads(lines[-1])
