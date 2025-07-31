import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
} from "chart.js";
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  TimeScale
);

interface PnlHistoryProps {
  assetId: string;
  assetSymbol: string;
}

export default function PnlHistoryChart({ assetId, assetSymbol }: PnlHistoryProps) {
  const [timeRange, setTimeRange] = useState("100");

  const { data: pnlHistory, isLoading, error } = useQuery({
    queryKey: ["/api/assets", assetId, "pnl-history", timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}/pnl-history?limit=${timeRange}`);
      if (!response.ok) {
        throw new Error("Failed to fetch P&L history");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-white">P&L History - {assetSymbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-400">Loading P&L history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !pnlHistory || !pnlHistory.dates || pnlHistory.dates.length === 0) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="text-white">P&L History - {assetSymbol}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="text-gray-400">No P&L history data available yet</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate cumulative P&L (realized + unrealized)
  const cumulativePnl = pnlHistory.totalPnl.map((total: number, index: number) => 
    pnlHistory.realizedPnl[index] + pnlHistory.unrealizedPnl[index]
  );

  const chartData = {
    labels: pnlHistory.dates,
    datasets: [
      {
        label: "Total P&L",
        data: cumulativePnl,
        borderColor: "rgb(34, 211, 238)",
        backgroundColor: "rgba(34, 211, 238, 0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      {
        label: "Realized P&L",
        data: pnlHistory.realizedPnl,
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        fill: false,
        tension: 0.4,
        pointRadius: 1,
        pointHoverRadius: 3,
      },
      {
        label: "Unrealized P&L",
        data: pnlHistory.unrealizedPnl,
        borderColor: "rgb(251, 191, 36)",
        backgroundColor: "rgba(251, 191, 36, 0.1)",
        fill: false,
        tension: 0.4,
        pointRadius: 1,
        pointHoverRadius: 3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time' as const,
        time: {
          displayFormats: {
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM dd',
          },
        },
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          maxTicksLimit: 8,
        },
      },
      y: {
        grid: {
          color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.7)",
          callback: function(value: any) {
            return `$${value.toFixed(2)}`;
          },
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "white",
        bodyColor: "white",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            const label = context.dataset.label;
            return `${label}: $${value.toFixed(2)}`;
          },
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  // Calculate summary stats
  const latestTotal = cumulativePnl[cumulativePnl.length - 1] || 0;
  const latestRealized = pnlHistory.realizedPnl[pnlHistory.realizedPnl.length - 1] || 0;
  const latestUnrealized = pnlHistory.unrealizedPnl[pnlHistory.unrealizedPnl.length - 1] || 0;
  const maxTotal = Math.max(...cumulativePnl);
  const minTotal = Math.min(...cumulativePnl);

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">P&L History - {assetSymbol}</CardTitle>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="50">Last 50</SelectItem>
            <SelectItem value="100">Last 100</SelectItem>
            <SelectItem value="200">Last 200</SelectItem>
            <SelectItem value="500">Last 500</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400">Current Total</div>
            <div className={`text-lg font-bold ${latestTotal >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${latestTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400">Realized P&L</div>
            <div className={`text-lg font-bold ${latestRealized >= 0 ? "text-green-400" : "text-red-400"}`}>
              ${latestRealized.toFixed(2)}
            </div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400">Peak</div>
            <div className="text-lg font-bold text-cyan-400">
              ${maxTotal.toFixed(2)}
            </div>
          </div>
          <div className="bg-black/20 rounded-lg p-3">
            <div className="text-xs text-gray-400">Drawdown</div>
            <div className="text-lg font-bold text-red-400">
              ${minTotal.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <Line data={chartData} options={chartOptions} />
        </div>
      </CardContent>
    </Card>
  );
}