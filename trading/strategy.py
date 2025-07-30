from datetime import datetime
from tradingbot.data.data_client import DataClient
from tradingbot.trading.broker import Broker
from tradingbot.trading.indicators import add_indicators, summarize_for_ai
from tradingbot.utils.trade_log import log_trade
from tradingbot.utils.performance import trade_performance_stats
from tradingbot.utils.reflection import summarize_last_n_trades, log_reflection
from tradingbot.ai.openai_agent import analyze_market_with_openai
import logging

class TradingStrategy:
    def __init__(self, asset: str):
        self.asset = asset
        self.data_client = DataClient()
        self.broker = Broker()
        # ... other setup ...

    def trading_cycle(self, reflection_interval=10):
        """
        Run one trading cycle: fetch data, analyze, possibly trade, log everything.
        After every 'reflection_interval' trades, run a reflection prompt & log summary.
        """
        try:
            # 1. Fetch historical data
            df = self.data_client.get_historical_data(self.asset, days=30, timeframe='1h')
            if df.empty:
                raise ValueError("No data received for asset.")

            # 2. Add indicators
            df = add_indicators(df)

            # 3. Summarize for AI
            summary = summarize_for_ai(df, bars=30)

            # 4. Get AI analysis/decision
            ai_decision = analyze_market_with_openai(summary, self.asset)
            if 'error' in ai_decision:
                return {"error": ai_decision["error"], "ai_response": ai_decision.get("raw_response", "")}

            # 5. Execute trade if appropriate
            executed = None
            if ai_decision.get("recommendation") in ("BUY", "SELL") and float(ai_decision.get("position_sizing", 0)) > 0:
                account = self.broker.get_account_info()
                equity = float(account.equity)
                position_value = equity * float(ai_decision["position_sizing"]) / 100
                price = float(df['close'].iloc[-1])
                qty = round(position_value / price, 6)
                executed = self.broker.submit_market_order(self.asset, qty, ai_decision["recommendation"])
            else:
                executed = {"info": "No trade triggered."}

            # 6. Log trade (standardized)
            trade_record = {
                "timestamp": datetime.utcnow().isoformat(),
                "asset": self.asset,
                "ai_decision": ai_decision,
                "executed": executed
            }
            log_trade(self.asset, trade_record)

            # 7. Check trade count and trigger reflection every N trades
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
