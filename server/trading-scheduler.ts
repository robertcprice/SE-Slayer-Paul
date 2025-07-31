// Trading scheduler to ensure proper interval timing
// This prevents multiple API calls within short periods

interface TradingSchedule {
  assetId: string;
  symbol: string;
  lastRunTime: number;
  interval: number; // in seconds
  isRunning: boolean;
}

class TradingScheduler {
  private schedules = new Map<string, TradingSchedule>();
  
  canRunTrade(assetId: string, symbol: string, interval: number): boolean {
    const schedule = this.schedules.get(assetId);
    const now = Date.now();
    
    if (!schedule) {
      // First time running for this asset
      this.schedules.set(assetId, {
        assetId,
        symbol,
        lastRunTime: now,
        interval,
        isRunning: true
      });
      return true;
    }
    
    // Check if enough time has passed since last trade
    const timeSinceLastRun = (now - schedule.lastRunTime) / 1000; // Convert to seconds
    
    if (timeSinceLastRun >= interval && !schedule.isRunning) {
      // Update last run time and mark as running
      schedule.lastRunTime = now;
      schedule.isRunning = true;
      schedule.interval = interval; // Update interval in case it changed
      return true;
    }
    
    return false;
  }
  
  markTradeComplete(assetId: string): void {
    const schedule = this.schedules.get(assetId);
    if (schedule) {
      schedule.isRunning = false;
    }
  }
  
  getTimeUntilNextRun(assetId: string): number {
    const schedule = this.schedules.get(assetId);
    if (!schedule) return 0;
    
    const now = Date.now();
    const timeSinceLastRun = (now - schedule.lastRunTime) / 1000;
    const timeUntilNext = Math.max(0, schedule.interval - timeSinceLastRun);
    
    return timeUntilNext;
  }
  
  getScheduleInfo(): Array<TradingSchedule & { timeUntilNext: number }> {
    return Array.from(this.schedules.values()).map(schedule => ({
      ...schedule,
      timeUntilNext: this.getTimeUntilNextRun(schedule.assetId)
    }));
  }
}

export const tradingScheduler = new TradingScheduler();