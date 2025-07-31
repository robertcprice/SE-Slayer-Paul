from datetime import datetime
from tradingbot.data.data_client import DataClient
from tradingbot.trading.broker import Broker
from tradingbot.trading.indicators import add_indicators, summarize_for_ai
from tradingbot.utils.performance import trade_performance_stats
from tradingbot.utils.reflection import summarize_last_n_trades, log_reflection
from tradingbot.ai.openai_agent import analyze_market_with_openai
from tradingbot.utils.trade_log import log_trade, load_trade_log
import pandas as pd
import logging

class TradeHistory:
    def __init__(self, asset: str):
        self.asset = asset
        self.trades = load_trade_log(asset)  # DataFrame

    def record(self, info: dict):
        # Append as row to DataFrame, then log as CSV
        self.trades = pd.concat([self.trades, pd.DataFrame([info])], ignore_index=True)
        log_trade(self.asset, info)

    def last_n(self, n=10):
        return self.trades.tail(n) if not self.trades.empty else self.trades

    def all(self):
        return self.trades

    def get_open_positions(self):
        """
        Returns a list of dicts describing each open position, ready to send as JSON.
        """
        try:
            positions = self.broker.get_positions()
            open_positions = []
            for pos in positions:
                # Make sure all keys used below exist in your broker API!
                open_positions.append({
                    "symbol": pos.get("symbol") or pos.get("asset", ""),
                    "side": pos.get("side", ""),
                    "qty": pos.get("qty", 0),
                    "avg_entry_price": pos.get("avg_entry_price") or pos.get("avg_entry", 0),
                    "unrealized_pnl": pos.get("unrealized_pl", 0) or pos.get("unrealized_pnl", 0),
                    # Optionally include a small PnL history for plotting
                    "pnl_history": pos.get("pnl_history", [])  # You may need to collect this elsewhere
                })
            return open_positions
        except Exception as e:
            import logging
            logging.error(f"Failed to get open positions: {e}")
            return []

class TradingStrategy:
    def __init__(self, asset: str):
        self.asset = asset
        self.data_client = DataClient()
        self.broker = Broker()
        self.history = TradeHistory(asset)

    def trading_cycle(self, reflection_interval=10):
        print("In trading_cycle for", self.asset)
        try:
            # 1. Get current positions for this asset (must implement get_positions for your broker)
            positions = self.broker.get_positions()
            open_position = None
            for pos in positions:
                # Adjust keys as needed for your broker (could be 'symbol' or 'asset')
                pos_symbol = pos.get('symbol') if isinstance(pos, dict) else getattr(pos, 'symbol', '')
                if not pos_symbol and hasattr(pos, 'asset'):
                    pos_symbol = getattr(pos, 'asset', '')
                if pos_symbol.upper().replace('-', '/').replace('_', '/') == self.asset.upper():
                    open_position = pos
                    break

            # 2. Fetch historical data
            print("Fetching historical data...")
            df = self.data_client.get_historical_data(self.asset, days=30, timeframe='1h')
            if df.empty:
                raise ValueError("No data received for asset.")

            # 3. Add indicators
            df = add_indicators(df)

            # 4. Summarize for AI
            summary = summarize_for_ai(df, bars=30)

            # 5. Get AI decision
            print("Calling OpenAI...")
            positions = self.broker.get_positions()
            ai_decision = analyze_market_with_openai(summary, self.asset, positions)
            print("OpenAI call returned:", ai_decision)
            if 'error' in ai_decision:
                return {"error": ai_decision["error"], "ai_response": ai_decision.get("raw_response", "")}

            action = ai_decision.get("recommendation", "HOLD")
            position_sizing = float(ai_decision.get("position_sizing", 0))
            executed = {"info": "No trade triggered."}

            # 6. Decide trade action based on position
            if open_position:
                # You have an open position in this asset
                side = open_position.get("side", "long").lower() if isinstance(open_position, dict) else getattr(open_position, "side", "long").lower()
                pos_qty = abs(float(open_position.get("qty", getattr(open_position, "qty", 0))))
                # If current position is long and AI says SELL: close/reverse
                if side == "long" and action == "SELL":
                    executed = self.broker.submit_market_order(self.asset, pos_qty, "SELL")
                elif side == "short" and action == "BUY":
                    executed = self.broker.submit_market_order(self.asset, pos_qty, "BUY")
                # else: HOLD/do nothing (you may customize further here)
            else:
                # No position: open if AI recommends and position_sizing > 0
                if action in ("BUY", "SELL") and position_sizing > 0:
                    account = self.broker.get_account_info()
                    equity = float(account.equity)
                    position_value = equity * position_sizing / 100
                    price = float(df['close'].iloc[-1])
                    qty = round(position_value / price, 6)
                    executed = self.broker.submit_market_order(self.asset, qty, action)

            # 7. Log trade
            trade_record = {
                "timestamp": datetime.utcnow().isoformat(),
                "asset": self.asset,
                "ai_decision": ai_decision,
                "executed": executed
            }
            self.history.record(trade_record)
            log_trade(self.asset, trade_record)

            # 8. Reflection every N trades
            stats = trade_performance_stats(self.asset)
            trade_count = stats.get("total_trades", 0)
            if trade_count % reflection_interval == 0 and trade_count > 0:
                prompt = summarize_last_n_trades(self.asset, n=reflection_interval)
                reflection = analyze_market_with_openai(prompt, self.asset)
                log_reflection(self.asset, reflection)

            return trade_record

        except Exception as e:
            logging.error(f"Trading cycle error: {e}")
            return {"error": str(e)}
