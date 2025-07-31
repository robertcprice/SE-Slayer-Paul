import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TradingAsset, TradingStrategy, BacktestResult } from "@shared/schema";
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Calendar } from "lucide-react";

export default function Backtesting() {
  const [backtestConfig, setBacktestConfig] = useState({
    name: "",
    assetId: "",
    strategyId: "",
    period: "30d",
    initialCapital: "10000"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch assets and strategies
  const { data: assets = [] } = useQuery({
    queryKey: ["/api/admin/assets"],
    queryFn: () => apiRequest("/api/admin/assets")
  });

  const { data: strategies = [] } = useQuery({
    queryKey: ["/api/strategies"],
    queryFn: () => apiRequest("/api/strategies")
  });

  const { data: backtestResults = [], isLoading: resultsLoading } = useQuery({
    queryKey: ["/api/backtests"],
    queryFn: () => apiRequest("/api/backtests")
  });

  // Run backtest mutation
  const runBacktestMutation = useMutation({
    mutationFn: (config: any) => apiRequest("/api/backtests/run", {
      method: "POST",
      body: JSON.stringify(config)
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtests"] });
      toast({ 
        title: "Backtest completed successfully",
        description: `Total Return: ${result.totalReturn}%`
      });
      // Reset form
      setBacktestConfig({
        name: "",
        assetId: "",
        strategyId: "",
        period: "30d",
        initialCapital: "10000"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Backtest failed",
        description: error.message || "An error occurred during backtesting",
        variant: "destructive"
      });
    }
  });

  // Delete backtest mutation
  const deleteBacktestMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/backtests/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtests"] });
      toast({ title: "Backtest result deleted" });
    }
  });

  const handleRunBacktest = () => {
    if (!backtestConfig.name || !backtestConfig.assetId || !backtestConfig.strategyId) {
      toast({ 
        title: "Missing required fields",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    runBacktestMutation.mutate({
      ...backtestConfig,
      initialCapital: parseFloat(backtestConfig.initialCapital)
    });
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatPercentage = (value: number) => 
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const getReturnColor = (value: number) => 
    value >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Strategy Backtesting</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Backtest Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Run New Backtest</CardTitle>
            <CardDescription>Test your trading strategies against historical data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Backtest Name</Label>
              <Input
                id="name"
                value={backtestConfig.name}
                onChange={(e) => setBacktestConfig(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., ICT Strategy - BTC 30D"
              />
            </div>

            <div>
              <Label htmlFor="asset">Trading Asset</Label>
              <Select
                value={backtestConfig.assetId}
                onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, assetId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select asset" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((asset: TradingAsset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="strategy">Trading Strategy</Label>
              <Select
                value={backtestConfig.strategyId}
                onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, strategyId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((strategy: TradingStrategy) => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      {strategy.name}
                      {strategy.isDefault && " (Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="period">Test Period</Label>
              <Select
                value={backtestConfig.period}
                onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, period: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="capital">Initial Capital ($)</Label>
              <Input
                id="capital"
                type="number"
                value={backtestConfig.initialCapital}
                onChange={(e) => setBacktestConfig(prev => ({ ...prev, initialCapital: e.target.value }))}
                placeholder="10000"
              />
            </div>

            <Button 
              onClick={handleRunBacktest}
              disabled={runBacktestMutation.isPending}
              className="w-full"
            >
              {runBacktestMutation.isPending ? "Running Backtest..." : "Run Backtest"}
            </Button>

            {runBacktestMutation.isPending && (
              <div className="space-y-2">
                <Progress value={66} className="w-full" />
                <p className="text-xs text-center text-gray-500">
                  Analyzing historical data...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backtest Results */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Backtest Results</CardTitle>
              <CardDescription>Historical performance of your trading strategies</CardDescription>
            </CardHeader>
            <CardContent>
              {resultsLoading ? (
                <div className="text-center py-8">Loading results...</div>
              ) : backtestResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No backtest results yet. Run your first backtest to see performance metrics.
                </div>
              ) : (
                <div className="space-y-4">
                  {backtestResults.map((result: BacktestResult) => (
                    <Card key={result.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold">{result.name}</h3>
                          <p className="text-sm text-gray-500">
                            {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={parseFloat(result.totalReturn || "0") >= 0 ? "default" : "destructive"}>
                            {formatPercentage(parseFloat(result.totalReturn || "0"))}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteBacktestMutation.mutate(result.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Final Capital</p>
                            <p className="font-medium">{formatCurrency(parseFloat(result.finalCapital || "0"))}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Win Rate</p>
                            <p className="font-medium">{parseFloat(result.winRate || "0").toFixed(1)}%</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Sharpe Ratio</p>
                            <p className="font-medium">{parseFloat(result.sharpeRatio || "0").toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-xs text-gray-500">Max Drawdown</p>
                            <p className="font-medium text-red-600">{formatPercentage(parseFloat(result.maxDrawdown || "0"))}</p>
                          </div>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Trades</p>
                          <p className="font-medium">{result.totalTrades}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Avg Win</p>
                          <p className="font-medium text-green-600">{formatCurrency(parseFloat(result.avgWin || "0"))}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Avg Loss</p>
                          <p className="font-medium text-red-600">{formatCurrency(parseFloat(result.avgLoss || "0"))}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}