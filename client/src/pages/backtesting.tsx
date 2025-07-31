import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trash2, Play, TrendingUp, TrendingDown } from "lucide-react";
import type { TradingAsset, TradingStrategy, BacktestResult } from "@shared/schema";

export default function Backtesting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [backtestConfig, setBacktestConfig] = useState({
    name: "",
    assetId: "",
    strategyId: "",
    period: "30d",
    initialCapital: "10000"
  });

  // Fetch assets and strategies
  const { data: assets = [] } = useQuery<TradingAsset[]>({
    queryKey: ["/api/admin/assets"],
    queryFn: () => apiRequest("/api/admin/assets")
  });

  const { data: strategies = [] } = useQuery<TradingStrategy[]>({
    queryKey: ["/api/strategies"],
    queryFn: () => apiRequest("/api/strategies")
  });

  const { data: backtestResults = [], isLoading: resultsLoading } = useQuery<BacktestResult[]>({
    queryKey: ["/api/backtests"],
    queryFn: () => apiRequest("/api/backtests")
  });

  // Run backtest mutation
  const runBacktestMutation = useMutation({
    mutationFn: (config: any) => apiRequest("/api/backtests/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    }),
    onSuccess: (result: BacktestResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtests"] });
      toast({ 
        title: "Backtest completed successfully",
        description: `Total Return: ${parseFloat(result.totalReturn).toFixed(2)}%`
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
                placeholder="Enter backtest name"
              />
            </div>

            <div>
              <Label htmlFor="asset">Trading Asset</Label>
              <Select value={backtestConfig.assetId} onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, assetId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an asset" />
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
              <Select value={backtestConfig.strategyId} onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, strategyId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a strategy" />
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
              <Label htmlFor="period">Time Period</Label>
              <Select value={backtestConfig.period} onValueChange={(value) => setBacktestConfig(prev => ({ ...prev, period: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
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
              <Play className="h-4 w-4 mr-2" />
              {runBacktestMutation.isPending ? "Running..." : "Run Backtest"}
            </Button>
          </CardContent>
        </Card>

        {/* Backtest Results */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Backtest Results</CardTitle>
            <CardDescription>Historical performance of your trading strategies</CardDescription>
          </CardHeader>
          <CardContent>
            {resultsLoading ? (
              <div>Loading results...</div>
            ) : backtestResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No backtest results yet. Run your first backtest to see performance metrics.
              </div>
            ) : (
              <div className="space-y-4">
                {backtestResults.map((result: BacktestResult) => {
                  const totalReturn = parseFloat(result.totalReturn);
                  const initialCapital = parseFloat(result.initialCapital);
                  const finalCapital = parseFloat(result.finalCapital);
                  const winRate = parseFloat(result.winRate);
                  const sharpeRatio = parseFloat(result.sharpeRatio);
                  const maxDrawdown = parseFloat(result.maxDrawdown);

                  return (
                    <Card key={result.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{result.name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant={totalReturn >= 0 ? "default" : "destructive"}>
                              {totalReturn >= 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {formatPercentage(totalReturn)}
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteBacktestMutation.mutate(result.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Initial Capital</p>
                            <p className="font-medium">{formatCurrency(initialCapital)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Final Capital</p>
                            <p className={`font-medium ${getReturnColor(totalReturn)}`}>
                              {formatCurrency(finalCapital)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Win Rate</p>
                            <p className="font-medium">{winRate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Trades</p>
                            <p className="font-medium">{result.totalTrades}</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>Performance Metrics</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-muted-foreground">Sharpe Ratio</p>
                              <p className="font-medium">{sharpeRatio.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Max Drawdown</p>
                              <p className={`font-medium ${maxDrawdown < 0 ? 'text-red-500' : ''}`}>
                                {maxDrawdown.toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Profit Factor</p>
                              <p className="font-medium">{parseFloat(result.profitFactor).toFixed(2)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-muted-foreground">
                          Tested: {new Date(result.startDate).toLocaleDateString()} - {new Date(result.endDate).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}