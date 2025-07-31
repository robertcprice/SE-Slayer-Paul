import OpenAI from "openai";
import type { Position } from "@shared/schema";
import { storage } from "../storage";

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
  positions: Position[] = [],
  assetId?: string,
  strategy?: any,
  secondarySummary?: MarketSummary
): Promise<AIDecision> {
  // Format positions for the prompt
  let positionsStr = "No open positions.";
  if (positions.length > 0) {
    positionsStr = "Current open positions:\n";
    positions.forEach(pos => {
      positionsStr += `- ${pos.symbol}: ${pos.quantity} (${pos.side}) @ ${pos.avgEntryPrice}\n`;
    });
  }

  // Use strategy configuration if provided
  const systemPrompt = strategy?.systemPrompt || `You are an advanced AI trading assistant specializing in ICT (Inner Circle Trader), Smart Money Concepts (SMC), and institutional order flow strategies.
When analyzing a trading opportunity, consider the following concepts:
- Market structure (BOS, CHoCH)
- Liquidity grabs and inducements
- Fair value gaps (FVG)
- Order blocks (OB)
- Premium/discount zones
- Imbalance
- Session timing (e.g. London/NY killzones)
- Relative equal highs/lows (liquidity pools)
- Classic indicators (RSI, moving averages) only as confluence, not as a primary driver`;

  const personalityPrompt = strategy?.personalityPrompt || "";
  const primaryTimeframe = strategy?.primaryTimeframe || "1h";
  const secondaryTimeframe = strategy?.secondaryTimeframe;
  const includedIndicators = strategy?.includedIndicators || ['rsi', 'macd', 'sma20', 'sma50', 'bb_upper', 'bb_lower'];

  // Build technical data string based on included indicators
  let technicalData = `Primary Timeframe (${primaryTimeframe}) Data:\n`;
  technicalData += `- Recent closes: ${summary.close.slice(-10).join(', ')}\n`;
  
  if (includedIndicators.includes('rsi')) {
    technicalData += `- RSI(14): ${summary.rsi.slice(-5).join(', ')}\n`;
  }
  if (includedIndicators.includes('macd')) {
    technicalData += `- MACD: ${summary.macd.slice(-5).join(', ')}\n`;
  }
  if (includedIndicators.includes('sma20')) {
    technicalData += `- SMA20: ${summary.sma20.slice(-5).join(', ')}\n`;
  }
  if (includedIndicators.includes('sma50')) {
    technicalData += `- SMA50: ${summary.sma50.slice(-5).join(', ')}\n`;
  }
  if (includedIndicators.includes('bb_upper')) {
    technicalData += `- Bollinger Upper: ${summary.bb_upper.slice(-5).join(', ')}\n`;
  }
  if (includedIndicators.includes('bb_lower')) {
    technicalData += `- Bollinger Lower: ${summary.bb_lower.slice(-5).join(', ')}\n`;
  }

  // Add secondary timeframe data if available
  if (secondarySummary && secondaryTimeframe) {
    technicalData += `\nSecondary Timeframe (${secondaryTimeframe}) Data:\n`;
    technicalData += `- Recent closes: ${secondarySummary.close.slice(-10).join(', ')}\n`;
    
    if (includedIndicators.includes('rsi')) {
      technicalData += `- RSI(14): ${secondarySummary.rsi.slice(-5).join(', ')}\n`;
    }
    if (includedIndicators.includes('macd')) {
      technicalData += `- MACD: ${secondarySummary.macd.slice(-5).join(', ')}\n`;
    }
    if (includedIndicators.includes('sma20')) {
      technicalData += `- SMA20: ${secondarySummary.sma20.slice(-5).join(', ')}\n`;
    }
    if (includedIndicators.includes('sma50')) {
      technicalData += `- SMA50: ${secondarySummary.sma50.slice(-5).join(', ')}\n`;
    }
  }

  const prompt = `${systemPrompt}

${personalityPrompt ? `Trading Personality: ${personalityPrompt}\n` : ''}

POSITION MANAGEMENT RULES:
The trading system supports both LONG and SHORT positions with sophisticated position management:

1. NO OPEN POSITION:
   - BUY recommendation = Opens new LONG position
   - SELL recommendation = Opens new SHORT position

2. CURRENT LONG POSITION:
   - BUY recommendation = Increases LONG position size
   - SELL recommendation with quantity ≤ current position = Reduces/closes LONG position
   - SELL recommendation with quantity > current position = Closes LONG + opens SHORT with remaining quantity

3. CURRENT SHORT POSITION:
   - SELL recommendation = Increases SHORT position size
   - BUY recommendation with quantity ≤ current position = Reduces/closes SHORT position
   - BUY recommendation with quantity > current position = Closes SHORT + opens LONG with remaining quantity

POSITION SIZING STRATEGY:
- Consider your current position when sizing new trades
- To close a position: Set position_sizing to match or exceed current position
- To reverse positions: Set position_sizing > current position (excess becomes new opposite position)
- To add to position: Set position_sizing for additional quantity desired

Here is the current position status:
${positionsStr}

Given the following technical summary for ${asset}, make a recommendation.
Clearly explain your analysis and reasoning.

Technical Data:
${technicalData}

Output a valid JSON object with these fields:
- recommendation: "BUY", "SELL", or "HOLD"
- reasoning: A concise but actionable rationale referencing ICT/SMC concepts used
- position_sizing: Percent of account equity to use (0–100; 0 means HOLD)
- stop_loss: Suggested stop loss percentage (can be null)
- take_profit: Suggested take profit percentage (can be null)
- next_cycle_seconds: (optional) If you think the bot should check again sooner than usual, set this to the number of seconds until the next check. Otherwise, set null or omit.

Example outputs:
{
  "recommendation": "BUY",
  "reasoning": "Price swept liquidity below equal lows and filled a 1h FVG; bullish order block formed at NY open; market structure shift to bullish.",
  "position_sizing": 15,
  "stop_loss": 2.5,
  "take_profit": 7.0
}

{
  "recommendation": "SELL",
  "reasoning": "Break of structure to downside; swept equal highs creating liquidity; premium zone rejection indicates institutional selling.",
  "position_sizing": 20,
  "stop_loss": 3.0,
  "take_profit": 8.0
}
`;

  // Track timing and create comprehensive log
  const startTime = Date.now();
  let aiDecision: AIDecision;
  let responseTimeMs: number = 0;
  let rawResponse: any = null;
  let tokenUsage: any = null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 400,
      temperature: 0.2,
    });

    responseTimeMs = Date.now() - startTime;
    rawResponse = response;
    tokenUsage = response.usage;

    const rawContent = response.choices[0].message.content;
    if (!rawContent) {
      throw new Error("No content received from OpenAI");
    }

    aiDecision = JSON.parse(rawContent) as AIDecision;

    // Set defaults if missing
    aiDecision.recommendation = aiDecision.recommendation || "HOLD";
    aiDecision.reasoning = aiDecision.reasoning || "No response from AI.";
    aiDecision.position_sizing = aiDecision.position_sizing || 0;

  } catch (error) {
    responseTimeMs = Date.now() - startTime;
    console.error("OpenAI API error:", error);
    
    aiDecision = {
      recommendation: "HOLD",
      reasoning: `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      position_sizing: 0,
    };
  }

  // Log every OpenAI response to database
  try {
    if (assetId) {
      await storage.createAiDecisionLog({
        assetId,
        symbol: asset,
        recommendation: aiDecision.recommendation,
        reasoning: aiDecision.reasoning,
        positionSizing: aiDecision.position_sizing?.toString() || null,
        stopLoss: aiDecision.stop_loss?.toString() || null,
        takeProfit: aiDecision.take_profit?.toString() || null,
        nextCycleSeconds: aiDecision.next_cycle_seconds || null,
        marketData: summary,
        rawResponse,
        responseTimeMs,
        modelUsed: "gpt-4o",
        promptTokens: tokenUsage?.prompt_tokens || null,
        completionTokens: tokenUsage?.completion_tokens || null,
        totalTokens: tokenUsage?.total_tokens || null,
      });
      
      console.log(`✅ OpenAI decision logged for ${asset}:`, {
        recommendation: aiDecision.recommendation,
        responseTime: `${responseTimeMs}ms`,
        tokens: tokenUsage?.total_tokens || 0,
      });
    }
  } catch (logError) {
    console.error("Failed to log AI decision:", logError);
  }

  return aiDecision;
}

export async function generateReflection(
  asset: string,
  recentTrades: any[],
  stats: any
): Promise<{ reflection: string; improvements: string }> {
  if (!recentTrades || recentTrades.length === 0) {
    return {
      reflection: "Insufficient trading data for analysis",
      improvements: "Continue trading to gather performance data"
    };
  }

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
