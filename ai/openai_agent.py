
# tradingbot/ai/openai_agent.py

import openai
from tradingbot.config import Config
import logging
import os
import json

def analyze_market_with_openai(summary: str, asset: str) -> dict:
    """
    Analyze a technical summary for a given asset using OpenAI.
    Returns a dict with keys like recommendation, reasoning, position_sizing, stop_loss, take_profit, next_cycle_seconds, etc.
    """
    # Compose a clear, structured prompt for the AI
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
        # Call the OpenAI API (streamlined for GPT-4, GPT-4o, or GPT-3.5)
        response = openai.ChatCompletion.create(
            model="gpt-4o",  # Change as needed
            messages=[{"role": "user", "content": prompt}],
            api_key=os.getenv("OPENAI_API_KEY"),
            max_tokens=400,
            temperature=0.2,
        )

        # Get the assistant's message
        raw = response['choices'][0]['message']['content']

        # Extract JSON from the output robustly
        json_start = raw.find('{')
        json_end = raw.rfind('}')
        if json_start == -1 or json_end == -1 or json_end < json_start:
            return {
                "error": "OpenAI did not return valid JSON.",
                "raw_response": raw
            }
        json_str = raw[json_start:json_end+1]

        # Parse the JSON (ignore extra fields)
        try:
            ai_decision = json.loads(json_str)
        except Exception as e:
            return {
                "error": f"OpenAI JSON parse error: {str(e)}",
                "raw_response": raw
            }

        # Set defaults if missing (for code robustness)
        ai_decision.setdefault("recommendation", "HOLD")
        ai_decision.setdefault("reasoning", "No response from AI.")
        ai_decision.setdefault("position_sizing", 0)
        ai_decision.setdefault("stop_loss", None)
        ai_decision.setdefault("take_profit", None)
        ai_decision.setdefault("next_cycle_seconds", None)

        return ai_decision

    except Exception as e:
        # If the OpenAI API call fails (rate limit, no key, etc.)
        return {
            "error": f"OpenAI API error: {str(e)}",
            "raw_response": None
        }
