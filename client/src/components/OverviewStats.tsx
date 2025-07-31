import type { DashboardStats, AccountBalance } from "@shared/schema";

interface OverviewStatsProps {
  stats: DashboardStats;
  accountBalance?: AccountBalance;
}

export default function OverviewStats({ stats, accountBalance }: OverviewStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="glass-panel rounded-3xl p-6 mb-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide text-cyan-300">
          Portfolio Overview
        </h2>
        {accountBalance && (
          <div className="text-right">
            <div className="text-lg font-bold text-green-400">
              {formatCurrency(parseFloat(accountBalance.equity))}
            </div>
            <div className="text-xs uppercase tracking-wide text-gray-300">
              Account Balance ({accountBalance.status})
            </div>
            <div className="text-xs text-gray-400">
              Cash: {formatCurrency(parseFloat(accountBalance.cash))} | 
              Buying Power: {formatCurrency(parseFloat(accountBalance.buyingPower))}
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="text-center">
          <div className={`text-3xl font-black ${stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatCurrency(stats.totalPnl)}
          </div>
          <div className="text-sm uppercase tracking-wide text-gray-300">Total P&L</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-green-400 to-cyan-400 h-2 rounded-full progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, ((stats.totalPnl + 5000) / 10000) * 100))}%` }}
            ></div>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-3xl font-black text-cyan-400">
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
        
        <div className="text-center">
          <div className="text-3xl font-black text-purple-400">
            {stats.sharpeRatio.toFixed(2)}
          </div>
          <div className="text-sm uppercase tracking-wide text-gray-300">Sharpe Ratio</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full progress-bar"
              style={{ width: `${Math.min(100, Math.max(0, ((stats.sharpeRatio + 2) / 5) * 100))}%` }}
            ></div>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-3xl font-black text-yellow-400">
            {stats.totalTrades}
          </div>
          <div className="text-sm uppercase tracking-wide text-gray-300">Total Trades</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div 
              className="bg-gradient-to-r from-yellow-400 to-orange-400 h-2 rounded-full progress-bar"
              style={{ width: `${Math.min(100, (stats.totalTrades / 500) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
