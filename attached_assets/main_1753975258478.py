from tradingbot.trading.strategy import TradingStrategy
from tradingbot.config import Config
import time

def run_all_trading_loops():
    strategies = {asset: TradingStrategy(asset) for asset in Config.ASSETS}
    print("Starting trading cycles. Press Ctrl+C to stop.")
    try:
        while True:
            min_sleep = Config.TRADING_CYCLE_INTERVAL  # default from config/env
            for asset, strat in strategies.items():
                print(f"\n=== Running trading cycle for {asset} ===")
                result = strat.trading_cycle()
                print(result)
                # Look for next_cycle_seconds
                ai_decision = result.get("ai_decision", {})
                next_cycle = ai_decision.get("next_cycle_seconds")
                # Use the *shortest* requested interval from any asset
                if isinstance(next_cycle, int) and 5 <= next_cycle < min_sleep:
                    min_sleep = next_cycle
            print(f"\nSleeping for {min_sleep} seconds...\n")
            time.sleep(min_sleep)
    except KeyboardInterrupt:
        print("Stopped.")
