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
  const [allTrades, setAllTrades] = useState<any[]>([]);

  const updateGradient = () => {
    document.body.style.background = `linear-gradient(-45deg, ${colorConfig.color1}, ${colorConfig.color2})`;
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

  // Fetch and aggregate data from all assets periodically
  useEffect(() => {
    const fetchAggregateData = async () => {
      if (!assets) return;

      let totalPnl = 0;
      let allPositions: Position[] = [];
      let allTrades: any[] = [];
      let totalTrades = 0;
      let totalWinRate = 0;
      let assetCount = 0;

      for (const asset of assets) {
        try {
          const response = await fetch(`/api/assets/${encodeURIComponent(asset.symbol)}/dashboard`);
          const data = await response.json();
          
          // Calculate real P&L from positions
          const assetPnl = data.positions
            .filter((pos: any) => pos.isOpen)
            .reduce((sum: number, pos: any) => sum + parseFloat(pos.unrealizedPnl || "0"), 0);
          
          totalPnl += assetPnl;
          allPositions.push(...data.positions);
          allTrades.push(...data.feed);
          totalTrades += data.stats.totalTrades;
          totalWinRate += data.stats.winRate;
          assetCount++;
        } catch (error) {
          console.error(`Failed to fetch data for ${asset.symbol}:`, error);
        }
      }

      setAllPositions(allPositions);
      setAllTrades(allTrades.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ));
      
      setAggregateStats({
        totalPnl,
        winRate: assetCount > 0 ? totalWinRate / assetCount : 0,
        sharpeRatio: 0,
        totalTrades,
        drawdown: 0,
        averageWin: 0,
        averageLoss: 0,
      });
    };

    fetchAggregateData();
    const interval = setInterval(fetchAggregateData, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [assets]);

  const handleStatsUpdate = useCallback((assetStats: DashboardStats, positions: Position[], trades: any[]) => {
    // This will be handled by the periodic fetch above
  }, []);

  const handlePositionsUpdate = useCallback((positions: Position[]) => {
    // This will be handled by the periodic fetch above
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
      {/* Color Customizer - Moved to center top */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 glass-panel rounded-2xl p-4">
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
        <h1 className="text-5xl font-black uppercase tracking-widest mb-2 text-white">
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
              onStatsUpdate={handleStatsUpdate}
              onPositionsUpdate={handlePositionsUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
