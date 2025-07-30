# tradingbot/utils/trade_log.py

import csv
import os
import json
import pandas as pd

TRADE_LOG_HEADER = [
    "timestamp",
    "asset",
    "action",
    "qty",
    "price",
    "position_sizing",
    "stop_loss",
    "take_profit",
    "ai_reasoning",
    "ai_full_decision",
    "result",
]

def log_trade(asset: str, record: dict):
    log_path = f"logs/{asset.replace('/', '-')}_trades.csv"
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    file_exists = os.path.isfile(log_path)
    with open(log_path, "a", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TRADE_LOG_HEADER)
        if not file_exists:
            writer.writeheader()
        writer.writerow({
            "timestamp": record.get("timestamp"),
            "asset": asset,
            "action": record.get("ai_decision", {}).get("recommendation"),
            "qty": record.get("executed", {}).get("qty"),
            "price": record.get("executed", {}).get("price"),
            "position_sizing": record.get("ai_decision", {}).get("position_sizing"),
            "stop_loss": record.get("ai_decision", {}).get("stop_loss"),
            "take_profit": record.get("ai_decision", {}).get("take_profit"),
            "ai_reasoning": record.get("ai_decision", {}).get("reasoning"),
            "ai_full_decision": json.dumps(record.get("ai_decision")),
            "result": record.get("executed", {}).get("status", "N/A"),
        })

def log_trade_json(asset: str, record: dict):
    log_path = f"logs/{asset.replace('/', '-')}_trades.jsonl"
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a") as f:
        f.write(json.dumps(record) + "\n")

def load_trade_log(asset):
    """
    Loads the trade log CSV for the given asset and returns a pandas DataFrame.
    If the file doesn't exist, returns an empty DataFrame with the correct columns.
    """
    log_path = f"logs/{asset.replace('/', '-')}_trades.csv"
    if not os.path.exists(log_path):
        return pd.DataFrame(columns=TRADE_LOG_HEADER)
    return pd.read_csv(log_path)
