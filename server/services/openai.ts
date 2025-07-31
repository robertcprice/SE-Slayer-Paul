import OpenAI from "openai";
import type { Position } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || "your-openai-api-key-here"
});

export interface AIDecision {
  recommendation: "BUY" | "SELL" | "HOLD";
  reasoning: string;
  position_sizing: number;
  stop_loss?: number;
  take_profit?: number;
  next_cycle_seconds?: number;
}

export interface MarketSummary {
  close: number[];
  rsi: number[];
  macd: number[];
  macd_signal: number[];
  bb_upper: number[];
  bb_lower: number[];
  sma20: number[];
  sma50: number[];
  ema20: number[];
  ema50: number[];
  volume: number[];
  timestamp: string[];
}

export async function analyzeMarketWithOpenAI(
  summary: MarketSummary, 
  asset: string, 
  positions: Position[] = []
): Promise<AIDecision> {
  // Format positions for the prompt
  let positionsStr = "No open positions.";
  if (positions.length > 0) {
    positionsStr = "Current open positions:\n";
    positions.forEach(pos => {
      positionsStr += `- ${pos.symbol}: ${pos.quantity} (${pos.side}) @ ${pos.avgEntryPrice}\n`;
    });
  }

  const prompt = `
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
${positionsStr}

Given the following technical summary for ${asset}, make a recommendation using ICT and SMC principles.
Clearly explain which concepts informed your analysis.

Technical Data:
- Recent closes: ${summary.close.slice(-10).join(', ')}
- RSI(14): ${summary.rsi.slice(-5).join(', ')}
- MACD: ${summary.macd.slice(-5).join(', ')}
- SMA20: ${summary.sma20.slice(-5).join(', ')}
- SMA50: ${summary.sma50.slice(-5).join(', ')}
- Bollinger Upper: ${summary.bb_upper.slice(-5).join(', ')}
- Bollinger Lower: ${summary.bb_lower.slice(-5).join(', ')}

Output a valid JSON object with these fields:
- recommendation: "BUY", "SELL", or "HOLD"
- reasoning: A concise but actionable rationale referencing ICT/SMC concepts used
- position_sizing: Percent of account equity to use (0–100; 0 means HOLD)
- stop_loss: Suggested stop loss percentage (can be null)
- take_profit: Suggested take profit percentage (can be null)
- next_cycle_seconds: (optional) If you think the bot should check again sooner than usual, set this to the number of seconds until the next check. Otherwise, set null or omit.

Example output:
{
  "recommendation": "BUY",
  "reasoning": "Price swept liquidity below equal lows and filled a 1h FVG; bullish order block formed at NY open; market structure shift to bullish.",
  "position_sizing": 15,
  "stop_loss": 2.5,
  "take_profit": 7.0,
  "next_cycle_seconds": 60
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.2,
    });

    const rawContent = response.choices[0].message.content;
    if (!rawContent) {
      throw new Error("No content received from OpenAI");
    }

    const aiDecision = JSON.parse(rawContent) as AIDecision;

    // Set defaults if missing
    aiDecision.recommendation = aiDecision.recommendation || "HOLD";
    aiDecision.reasoning = aiDecision.reasoning || "No response from AI.";
    aiDecision.position_sizing = aiDecision.position_sizing || 0;

    return aiDecision;

  } catch (error) {
    console.error("OpenAI API error:", error);
    return {
      recommendation: "HOLD",
      reasoning: `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      position_sizing: 0,
    };
  }
}

export async function generateReflection(
  asset: string,
  recentTrades: any[],
  stats: any
): Promise<{ reflection: string; improvements: string }> {
  const tradesText = recentTrades.map(trade => 
    `${trade.action} ${trade.quantity} @ ${trade.price} - ${trade.aiReasoning}`
  ).join('\n');

  const prompt = `
Analyze the trading performance for ${asset} and provide insights:

Recent Trades:
${tradesText}

Performance Stats:
- Total P&L: ${stats.totalPnl}
- Win Rate: ${(stats.winRate * 100).toFixed(1)}%
- Total Trades: ${stats.totalTrades}
- Average Win: ${stats.averageWin}
- Average Loss: ${stats.averageLoss}

Analyze the trading style and provide insights. What works best, what doesn't, and how can this strategy be improved?

Respond with JSON in this format:
{
  "reflection": "Analysis of current strategy performance and what's working",
  "improvements": "Specific recommendations for strategy improvements"
}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      reflection: result.reflection || "No reflection available",
      improvements: result.improvements || "No improvements suggested"
    };

  } catch (error) {
    console.error("OpenAI reflection error:", error);
    return {
      reflection: "Error generating reflection",
      improvements: "Error generating improvements"
    };
  }
}
