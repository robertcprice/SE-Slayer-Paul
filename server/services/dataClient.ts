import type { MarketData, InsertMarketData } from "@shared/schema";

export interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  ema20: number;
  ema50: number;
  rsi14: number;
  macd: number;
  macd_signal: number;
  macd_hist: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  volume_sma20?: number;
}

export interface HistoricalData {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  indicators?: TechnicalIndicators;
}

export class DataClient {
  private mockPrices: Map<string, number> = new Map();
  
  constructor() {
    // Initialize mock prices
    this.mockPrices.set("BTC/USD", 43000);
    this.mockPrices.set("SOL/USD", 95);
  }

  async getHistoricalData(asset: string, days = 30, timeframe = '1h'): Promise<HistoricalData[]> {
    // In a real implementation, this would fetch from Alpaca or another data provider
    // For now, generate realistic mock data with proper technical indicators
    
    const basePrice = this.mockPrices.get(asset) || 100;
    const data: HistoricalData[] = [];
    const hoursBack = days * 24;
    
    let currentPrice = basePrice;
    
    for (let i = hoursBack; i >= 0; i--) {
      const timestamp = new Date(Date.now() - i * 3600000);
      
      // Generate realistic price movement
      const volatility = asset === "BTC/USD" ? 0.02 : 0.03;
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);
      
      const high = currentPrice * (1 + Math.random() * 0.01);
      const low = currentPrice * (1 - Math.random() * 0.01);
      const open = low + Math.random() * (high - low);
      const close = low + Math.random() * (high - low);
      const volume = Math.random() * 1000000 + 500000;
      
      data.push({
        timestamp,
        open,
        high,
        low,
        close,
        volume,
      });
    }
    
    // Add technical indicators
    return this.addTechnicalIndicators(data);
  }

  private addTechnicalIndicators(data: HistoricalData[]): HistoricalData[] {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    
    return data.map((item, index) => {
      const indicators: TechnicalIndicators = {
        sma20: this.calculateSMA(closes, index, 20),
        sma50: this.calculateSMA(closes, index, 50),
        ema20: this.calculateEMA(closes, index, 20),
        ema50: this.calculateEMA(closes, index, 50),
        rsi14: this.calculateRSI(closes, index, 14),
        macd: 0,
        macd_signal: 0,
        macd_hist: 0,
        bb_upper: 0,
        bb_middle: 0,
        bb_lower: 0,
        volume_sma20: this.calculateSMA(volumes, index, 20),
      };
      
      // Calculate MACD
      const macdData = this.calculateMACD(closes, index);
      indicators.macd = macdData.macd;
      indicators.macd_signal = macdData.signal;
      indicators.macd_hist = macdData.histogram;
      
      // Calculate Bollinger Bands
      const bbData = this.calculateBollingerBands(closes, index, 20, 2);
      indicators.bb_upper = bbData.upper;
      indicators.bb_middle = bbData.middle;
      indicators.bb_lower = bbData.lower;
      
      return {
        ...item,
        indicators,
      };
    });
  }

  private calculateSMA(values: number[], index: number, period: number): number {
    if (index < period - 1) return values[index];
    
    const slice = values.slice(Math.max(0, index - period + 1), index + 1);
    return slice.reduce((sum, val) => sum + val, 0) / slice.length;
  }

  private calculateEMA(values: number[], index: number, period: number): number {
    if (index === 0) return values[0];
    
    const multiplier = 2 / (period + 1);
    const prevEMA = index === 0 ? values[0] : this.calculateEMA(values, index - 1, period);
    
    return (values[index] * multiplier) + (prevEMA * (1 - multiplier));
  }

  private calculateRSI(values: number[], index: number, period: number): number {
    if (index < period) return 50;
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = Math.max(1, index - period + 1); i <= index; i++) {
      const change = values[i] - values[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    const avgGain = gains.reduce((sum, gain) => sum + gain, 0) / period;
    const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(values: number[], index: number): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(values, index, 12);
    const ema26 = this.calculateEMA(values, index, 26);
    const macd = ema12 - ema26;
    
    // For signal line, we'd need to calculate EMA of MACD values
    // Simplified calculation for demo
    const signal = macd * 0.9;
    const histogram = macd - signal;
    
    return { macd, signal, histogram };
  }

  private calculateBollingerBands(values: number[], index: number, period: number, stdDev: number): { upper: number; middle: number; lower: number } {
    if (index < period - 1) {
      return { upper: values[index], middle: values[index], lower: values[index] };
    }
    
    const sma = this.calculateSMA(values, index, period);
    const slice = values.slice(Math.max(0, index - period + 1), index + 1);
    
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev),
    };
  }

  getCurrentPrice(asset: string): number {
    return this.mockPrices.get(asset) || 100;
  }

  updatePrice(asset: string, price: number): void {
    this.mockPrices.set(asset, price);
  }
}
