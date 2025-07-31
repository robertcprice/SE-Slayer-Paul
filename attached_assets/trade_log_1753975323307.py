# tradingbot/utils/trade_log.py
print("trade_log.py loaded from:", __file__)

import csv
import os
import json
import pandas as pd   # <-- Make sure this line is here!

print("trade_log.py loaded from1111:", __file__)

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
    "result"
]

def log_trade(asset: str, record: dict):
    """
    Appends a trade record (as dict) to the CSV log file for this asset.
    """
    log_path = f"logs/{asset.replace('/', '-')}_trades.csv"
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    file_exists = os.path.isfile(log_path)

    # Flatten nested fields for CSV
    row = {
        "timestamp": record.get("timestamp"),
        "asset": asset,
        "action": record.get("ai_decision", {}).get("recommendation"),
        "qty": record.get("executed", {}).get("qty"),
        "price": record.get("executed", {}).get("price"),
        "position_sizing": record.get("ai_decision", {}).get("position_sizing"),
        "stop_loss": record.get("ai_decision", {}).get("stop_loss"),
        "take_profit": record.get("ai_decision", {}).get("take_profit"),
        "ai_reasoning": record.get("ai_decision", {}).get("reasoning"),
        "ai_full_decision": json.dumps(record.get("ai_decision", {})),
        "result": record.get("executed", {}).get("status", "N/A")
    }

    df_row = pd.DataFrame([row], columns=TRADE_LOG_HEADER)
    if file_exists:
        # Append without header
        df_row.to_csv(log_path, mode='a', header=False, index=False)
    else:
        # New file with header
        df_row.to_csv(log_path, mode='w', header=True, index=False)

def load_trade_log(asset: str) -> pd.DataFrame:
    """
    Loads the trade log CSV for the given asset and returns a pandas DataFrame.
    If the file doesn't exist, returns an empty DataFrame with the correct columns.
    """
    log_path = f"logs/{asset.replace('/', '-')}_trades.csv"
    if not os.path.exists(log_path):
        return pd.DataFrame(columns=TRADE_LOG_HEADER)
    df = pd.read_csv(log_path)
    return df

def log_trade_json(asset: str, record: dict):
    """
    Optionally, log raw record as JSONL for forensic/debug usage.
    """
    log_path = f"logs/{asset.replace('/', '-')}_trades.jsonl"
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, "a") as f:
        f.write(json.dumps(record) + "\n")
