import json
import os

INTERVAL_FILE = "interval_settings.json"

def load_intervals():
    if os.path.exists(INTERVAL_FILE):
        with open(INTERVAL_FILE, "r") as f:
            return json.load(f)
    return {}

def save_intervals(data):
    with open(INTERVAL_FILE, "w") as f:
        json.dump(data, f)

def get_interval(asset, default=60):
    intervals = load_intervals()
    return intervals.get(asset, default)

def set_interval(asset, interval):
    intervals = load_intervals()
    intervals[asset] = interval
    save_intervals(intervals)
