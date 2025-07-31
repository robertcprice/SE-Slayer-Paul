import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import OverviewStats from "./OverviewStats";
import ActivePositions from "./ActivePositions";
import AssetPanel from "./AssetPanel";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { DashboardStats, Position, TradingAsset } from "@shared/schema";

export default function TradingDashboard() {
  const [colorConfig, setColorConfig] = useState({
    color1: "#0f172a",
    color2: "#22d3ee",
  });

  const { data: assets } = useQuery<TradingAsset[]>({
    queryKey: ["/api/assets"],
  });

  // Aggregate data from all assets
  const [aggregateStats, setAggregateStats] = useState<DashboardStats>({
    totalPnl: 0,
    winRate: 0,
    sharpeRatio: 0,
    totalTrades: 0,
    drawdown: 0,
    averageWin: 0,
    averageLoss: 0,
  });

  const [allPositions, setAllPositions] = useState<Position[]>([]);

  const updateGradient = () => {
    document.body.style.background = `linear-gradient(-45deg, ${colorConfig.color1}, #1e293b, #0369a1, ${colorConfig.color2})`;
    document.body.style.backgroundSize = "400% 400%";
  };

  useEffect(() => {
    updateGradient();
  }, [colorConfig]);

  useEffect(() => {
    // Apply initial gradient and animation class
    document.body.className = "gradient-bg min-h-screen text-white font-inter";
    updateGradient();
  }, []);

  const handleStatsUpdate = useCallback((assetStats: DashboardStats) => {
    // This is a simplified aggregation - in a real app you'd want more sophisticated logic
    setAggregateStats(prev => ({
      totalPnl: prev.totalPnl + assetStats.totalPnl,
      winRate: (prev.winRate + assetStats.winRate) / 2,
      sharpeRatio: (prev.sharpeRatio + assetStats.sharpeRatio) / 2,
      totalTrades: prev.totalTrades + assetStats.totalTrades,
      drawdown: Math.max(prev.drawdown, assetStats.drawdown),
      averageWin: (prev.averageWin + assetStats.averageWin) / 2,
      averageLoss: (prev.averageLoss + assetStats.averageLoss) / 2,
    }));
  }, []);

  const handlePositionsUpdate = useCallback((positions: Position[]) => {
    setAllPositions(prev => {
      // Merge positions, avoiding duplicates
      const existingIds = prev.map(p => p.id);
      const newPositions = positions.filter(p => !existingIds.includes(p.id));
      return [...prev, ...newPositions];
    });
  }, []);

  if (!assets) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading trading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Color Customizer */}
      <div className="fixed top-4 right-4 z-50 glass-panel rounded-2xl p-4">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-semibold uppercase tracking-wider">🎨 Theme</span>
          <input
            type="color"
            value={colorConfig.color1}
            onChange={(e) => setColorConfig(prev => ({ ...prev, color1: e.target.value }))}
            className="w-8 h-8 rounded border-none cursor-pointer"
          />
          <input
            type="color"
            value={colorConfig.color2}
            onChange={(e) => setColorConfig(prev => ({ ...prev, color2: e.target.value }))}
            className="w-8 h-8 rounded border-none cursor-pointer"
          />
        </div>
      </div>

      {/* Header */}
      <header className="text-center py-8">
        <h1 className="text-5xl font-black uppercase tracking-widest mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
          AI Trading Dashboard
        </h1>
        <div className="flex items-center justify-center space-x-2 mt-4">
          <div className="connection-indicator w-3 h-3 bg-green-400 rounded-full"></div>
          <span className="text-sm font-medium text-green-400 uppercase tracking-wide">
            Live Trading Active
          </span>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-8">
        {/* Overview Stats */}
        <OverviewStats stats={aggregateStats} />

        {/* Active Positions */}
        <ActivePositions positions={allPositions} />

        {/* Asset Dashboards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {assets.map((asset, index) => (
            <AssetPanel
              key={asset.id}
              asset={asset}
              animationDelay={0.4 + index * 0.2}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
