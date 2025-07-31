import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { TradingAsset, DashboardStats, Position, TradeFeed, ChartData } from "@shared/schema";

interface AssetPanelProps {
  asset: TradingAsset;
  animationDelay: number;
}

export default function AssetPanel({ 
  asset, 
  animationDelay
}: AssetPanelProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalPnl: 0,
    winRate: 0,
    sharpeRatio: 0,
    totalTrades: 0,
    drawdown: 0,
    averageWin: 0,
    averageLoss: 0,
  });
  const [feed, setFeed] = useState<TradeFeed[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [reflection, setReflection] = useState("");
  const [improvements, setImprovements] = useState("");
  const [isPaused, setIsPaused] = useState(asset.isPaused);
  const [currentInterval, setCurrentInterval] = useState(asset.interval);

  // Remove callback references to prevent infinite re-renders

  const { sendMessage, lastMessage, isConnected } = useWebSocket(
    asset.symbol
  );

  // Track last processed message to prevent infinite loops
  const lastMessageIdRef = useRef<string>("");

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        
        // Add a timestamp-based ID to prevent re-processing the same message
        const messageId = `${lastMessage.timeStamp}-${JSON.stringify(data).slice(0, 50)}`;
        if (messageId === lastMessageIdRef.current) {
          return; // Skip if we've already processed this message
        }
        lastMessageIdRef.current = messageId;
        
        if (data.stats) {
          setStats(data.stats);
        }
        
        if (data.chart) {
          updateChart(data.chart);
        }
        
        if (data.positions) {
          setPositions(data.positions);
        }
        
        if (data.feed) {
          setFeed(data.feed);
        }
        
        if (data.reflection) {
          setReflection(data.reflection);
        }
        
        if (data.improvements) {
          setImprovements(data.improvements);
        }
        
        if (typeof data.paused === 'boolean') {
          setIsPaused(data.paused);
        }
        
        if (data.interval) {
          setCurrentInterval(data.interval);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]); // Removed callback deps to prevent infinite re-renders

  const updateChart = (chartData: ChartData) => {
    if (chartRef.current && window.Chart) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (!ctx) return;

      const color = asset.symbol === 'BTC/USD' ? 'rgba(255, 193, 7, 1)' : 'rgba(139, 69, 255, 1)';

      chartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: chartData.dates,
          datasets: [{
            label: 'Price',
            data: chartData.close,
            borderColor: color,
            backgroundColor: color.replace('1)', '0.1)'),
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { 
              display: false,
              grid: { display: false }
            },
            y: {
              display: true,
              grid: { 
                color: 'rgba(255, 255, 255, 0.1)',
                drawBorder: false
              },
              ticks: {
                color: 'rgba(255, 255, 255, 0.7)',
                font: { size: 10 }
              }
            }
          },
          animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
          }
        }
      });
    }
  };

  const togglePause = () => {
    sendMessage(JSON.stringify({ 
      action: isPaused ? "resume" : "pause" 
    }));
  };

  const handleIntervalChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newInterval = parseInt(event.target.value);
    sendMessage(JSON.stringify({ 
      action: "set_interval", 
      interval: newInterval 
    }));
  };

  const getIntervalDisplay = (interval: number) => {
    switch (interval) {
      case 60: return "1 minute";
      case 300: return "5 minutes";
      case 900: return "15 minutes";
      case 1800: return "30 minutes";
      case 3600: return "1 hour";
      default: return `${interval}s`;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  // Clean up chart on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  return (
    <div 
      className="glass-panel rounded-3xl p-6 animate-slide-up" 
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide text-cyan-300">
          {asset.symbol}
        </h2>
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full ${
            isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}></div>
          <span className={`text-sm font-medium uppercase ${
            isConnected ? 'text-green-400' : 'text-red-400'
          }`}>
            {isConnected ? 'Active' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Trading Controls */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={togglePause}
          className={`glass-button px-4 py-2 rounded-xl text-sm font-semibold uppercase tracking-wide ${
            isPaused 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-yellow-500/20 text-yellow-400'
          }`}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-300">
            Interval:
          </label>
          <select
            value={currentInterval || 300}
            onChange={handleIntervalChange}
            className="glass-button px-3 py-1 rounded-lg text-sm bg-gray-700/50 text-white border-gray-600"
          >
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
            <option value="900">15 minutes</option>
            <option value="1800">30 minutes</option>
            <option value="3600">1 hour</option>
          </select>
        </div>
      </div>

      {/* Price Chart */}
      <div className="mb-6 bg-gray-900/50 rounded-2xl p-4">
        <canvas ref={chartRef} height="200"></canvas>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center">
          <div className={`text-2xl font-bold ${
            stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {formatCurrency(stats.totalPnl)}
          </div>
          <div className="text-sm uppercase tracking-wide text-gray-300">P&L</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, ((stats.totalPnl + 2000) / 4000) * 100))}%` }}
            ></div>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-400">
            {(stats.winRate * 100).toFixed(1)}%
          </div>
          <div className="text-sm uppercase tracking-wide text-gray-300">Win Rate</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-cyan-400 to-blue-400 h-2 rounded-full progress-bar"
              style={{ width: `${stats.winRate * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Current Positions */}
      <div className="bg-gray-900/50 rounded-2xl p-4 mb-4">
        <h3 className="text-lg font-bold uppercase tracking-wide text-cyan-300 mb-3">
          Current Positions
        </h3>
        <div className="space-y-2 text-sm">
          {positions.length === 0 ? (
            <div className="text-gray-400">No open positions.</div>
          ) : (
            positions.filter(pos => pos.isOpen).map((position, index) => (
              <div key={index} className="flex justify-between items-center bg-gray-800/50 rounded-lg p-3">
                <div>
                  <div className="text-gray-300">
                    <span className={`font-semibold ${position.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                      {position.side.toUpperCase()}
                    </span> {parseFloat(position.quantity).toFixed(4)} {position.symbol}
                  </div>
                  <div className="text-xs text-gray-400">
                    Entry: ${parseFloat(position.avgEntryPrice).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${
                    parseFloat(position.unrealizedPnl) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {parseFloat(position.unrealizedPnl) >= 0 ? '+' : ''}${parseFloat(position.unrealizedPnl).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(position.openedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="bg-gray-900/50 rounded-2xl p-4 mb-4">
        <h3 className="text-lg font-bold uppercase tracking-wide text-cyan-300 mb-3">
          Recent Trades
        </h3>
        <ul className="space-y-2 text-sm">
          {feed.length === 0 ? (
            <li className="text-gray-400">No trades yet.</li>
          ) : (
            feed.slice(0, 3).map((trade, index) => (
              <li key={index} className="flex justify-between items-center">
                <span className="text-gray-300">
                  [{new Date(trade.timestamp).toLocaleTimeString()}] {trade.action} {parseFloat(trade.quantity).toFixed(3)} @ ${parseFloat(trade.price).toFixed(2)}
                </span>
                <span className={`font-semibold ${
                  (trade.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* AI Insights */}
      <div className="bg-gray-900/50 rounded-2xl p-4">
        <h3 className="text-lg font-bold uppercase tracking-wide text-cyan-300 mb-3">
          🤖 AI Analysis
        </h3>
        <div className="text-sm">
          <div className="text-green-400 mb-2">
            <strong>Strategy:</strong> {reflection || "Analyzing market conditions..."}
          </div>
          <div className="text-blue-400">
            <strong>Improvements:</strong> {improvements || "Generating recommendations..."}
          </div>
        </div>
      </div>
    </div>
  );
}
