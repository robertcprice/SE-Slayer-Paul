# tradingbot/ai/openai_agent.py

import openai
from tradingbot.config import Config
import logging
import os
import json

# Use OpenAI v1+ client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY") or Config.OPENAI_API_KEY)

def analyze_market_with_openai(summary: str, asset: str, positions=None) -> dict:
    """
    Analyze a technical summary for a given asset using OpenAI, with optional current positions.
    Returns a dict with keys like recommendation, reasoning, position_sizing, stop_loss, take_profit, etc.
    """
    # --- Format positions for the prompt robustly ---
    positions_str = ""
    if positions:
        # Helper to convert object to dict
        def pos_to_dict(p):
            if isinstance(p, dict):
                return p
            return {
                "symbol": getattr(p, "symbol", "?"),
                "qty": getattr(p, "qty", "?"),
                "side": getattr(p, "side", "?"),
                "avg_entry_price": getattr(p, "avg_entry_price", None)
            }
        if isinstance(positions, str):
            positions_str = positions
        elif isinstance(positions, list):
            if not positions:
                positions_str = "No open positions."
            else:
                positions_str = "Current open positions:\n"
                for p in positions:
                    pdict = pos_to_dict(p)
                    positions_str += (
                        f"- {pdict.get('symbol','?')}: {pdict.get('qty','?')} "
                        f"({pdict.get('side','?')}) @ {pdict.get('avg_entry_price','-')}\n"
                    )
        else:
            positions_str = str(positions)
    else:
        positions_str = "No open positions."

    # --- Compose the prompt ---
    prompt = f"""
You are an advanced AI trading assistant specializing in ICT (Inner Circle Trader), Smart Money Concepts (SMC), and institutional order flow strategies.
When analyzing a trading opportunity, consider the following concepts:
- Market structure (BOS, CHoCH)
- Liquidity grabs and inducements
- Fair value gaps (FVG)
- Order blocks (OB)
- Premium/discount zones
- Imbalance
- Session timing (e.g. London/NY killzones)
- Relative equal highs/lows (liquidity pools)
- Classic indicators (RSI, moving averages) only as confluence, not as a primary driver

Here is the current position status:
{positions_str}

Given the following technical summary for {asset}, make a recommendation using ICT and SMC principles.
Clearly explain which concepts informed your analysis.

Output a valid JSON object with these fields:
- recommendation: "BUY", "SELL", or "HOLD"
- reasoning: A concise but actionable rationale referencing ICT/SMC concepts used (e.g. "Liquidity sweep below Asian low, FVG fill, bullish OB in NY session")
- position_sizing: Percent of account equity to use (0–100; 0 means HOLD)
- stop_loss: Suggested stop loss percentage (can be null)
- take_profit: Suggested take profit percentage (can be null)
- next_cycle_seconds: (optional) If you think the bot should check again sooner than usual, set this to the number of seconds until the next check. Otherwise, set null or omit.

Example output:
{{
  "recommendation": "BUY",
  "reasoning": "Price swept liquidity below equal lows and filled a 1h FVG; bullish order block formed at NY open; market structure shift to bullish.",
  "position_sizing": 15,
  "stop_loss": 2.5,
  "take_profit": 7.0,
  "next_cycle_seconds": 60
}}

Summary to analyze:
{summary}
"""

    try:
        # OpenAI v1.x+ syntax (client-based)
        response = client.chat.completions.create(
            model="gpt-4o",  # Or "gpt-3.5-turbo" etc
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=400,
            temperature=0.2,
        )

        raw = response.choices[0].message.content

        # Extract JSON from the output robustly
        json_start = raw.find('{')
        json_end = raw.rfind('}')
        if json_start == -1 or json_end == -1 or json_end < json_start:
            return {
                "error": "OpenAI did not return valid JSON.",
                "raw_response": raw
            }
        json_str = raw[json_start:json_end + 1]

        try:
            ai_decision = json.loads(json_str)
        except Exception as e:
            return {
                "error": f"OpenAI JSON parse error: {str(e)}",
                "raw_response": raw
            }

        # Set defaults if missing
        ai_decision.setdefault("recommendation", "HOLD")
        ai_decision.setdefault("reasoning", "No response from AI.")
        ai_decision.setdefault("position_sizing", 0)
        ai_decision.setdefault("stop_loss", None)
        ai_decision.setdefault("take_profit", None)
        ai_decision.setdefault("next_cycle_seconds", None)

        return ai_decision

    except Exception as e:
        logging.error(f"OpenAI API error: {str(e)}")
        return {
            "error": f"OpenAI API error: {str(e)}",
            "raw_response": None
        }
