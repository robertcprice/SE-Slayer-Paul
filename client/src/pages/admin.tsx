import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, TrendingUp, Settings, BarChart3, Play, Pause, Key, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { AssetManagementPanel } from "@/components/AssetManagementPanel";

interface SystemStats {
  totalPnl: number;
  totalTrades: number;
  activePositions: number;
  totalAssets: number;
}

interface BacktestResult {
  startDate: string;
  endDate: string;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  strategy: string;
}

interface MarketSentiment {
  btcSentiment: string;
  solSentiment: string;
  overallSentiment: string;
  fearGreedIndex: number;
  recentDecisions: {
    bullish: number;
    bearish: number;
    neutral: number;
    total: number;
  };
}

interface ApiKeyStatus {
  alpacaApiKey: string | null;
  alpacaSecretKey: string | null;  
  openaiApiKey: string | null;
  databaseUrl: string | null;
}

interface ApiTestResults {
  alpaca: boolean;
  openai: boolean;
  database: boolean;
}

function ApiKeyManagementPanel() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<ApiTestResults | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data: apiKeys } = useQuery<ApiKeyStatus>({
    queryKey: ["/api/admin/api-keys"],
    queryFn: () => apiRequest("/api/admin/api-keys")
  });

  const testApiKeys = async () => {
    setIsTesting(true);
    try {
      const results = await apiRequest("/api/admin/api-keys/test", { method: "POST" });
      setTestResults(results);
      toast({
        title: "API Key Test Complete",
        description: "Check the results below"
      });
    } catch (error) {
      toast({
        title: "Test Failed",
        description: "Unable to test API keys",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusIcon = (isConfigured: boolean, isWorking?: boolean) => {
    if (!isConfigured) return <XCircle className="h-4 w-4 text-red-400" />;
    if (isWorking === undefined) return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    return isWorking ? <CheckCircle className="h-4 w-4 text-green-400" /> : <XCircle className="h-4 w-4 text-red-400" />;
  };

  const getStatusText = (isConfigured: boolean, isWorking?: boolean) => {
    if (!isConfigured) return "Not Configured";
    if (isWorking === undefined) return "Configured";
    return isWorking ? "Working" : "Error";
  };

  const getStatusColor = (isConfigured: boolean, isWorking?: boolean) => {
    if (!isConfigured) return "bg-red-500/20 text-red-400";
    if (isWorking === undefined) return "bg-yellow-500/20 text-yellow-400";
    return isWorking ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400";
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Key Management
            </CardTitle>
            <p className="text-slate-400">Monitor and test your API connections</p>
          </div>
          <Button onClick={testApiKeys} disabled={isTesting} variant="outline">
            {isTesting ? "Testing..." : "Test All Keys"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(!!apiKeys?.alpacaApiKey, testResults?.alpaca)}
                <span className="text-slate-300">Alpaca API Key</span>
              </div>
              <Badge className={getStatusColor(!!apiKeys?.alpacaApiKey, testResults?.alpaca)}>
                {getStatusText(!!apiKeys?.alpacaApiKey, testResults?.alpaca)}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(!!apiKeys?.alpacaSecretKey, testResults?.alpaca)}
                <span className="text-slate-300">Alpaca Secret Key</span>
              </div>
              <Badge className={getStatusColor(!!apiKeys?.alpacaSecretKey, testResults?.alpaca)}>
                {getStatusText(!!apiKeys?.alpacaSecretKey, testResults?.alpaca)}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(!!apiKeys?.openaiApiKey, testResults?.openai)}
                <span className="text-slate-300">OpenAI API Key</span>
              </div>
              <Badge className={getStatusColor(!!apiKeys?.openaiApiKey, testResults?.openai)}>
                {getStatusText(!!apiKeys?.openaiApiKey, testResults?.openai)}
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
              <div className="flex items-center gap-2">
                {getStatusIcon(!!apiKeys?.databaseUrl, testResults?.database)}
                <span className="text-slate-300">Database Connection</span>
              </div>
              <Badge className={getStatusColor(!!apiKeys?.databaseUrl, testResults?.database)}>
                {getStatusText(!!apiKeys?.databaseUrl, testResults?.database)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-slate-700/20 rounded-lg">
          <p className="text-sm text-slate-400">
            API keys are managed through environment variables. Contact your system administrator to update keys.
            {!apiKeys?.alpacaApiKey && " Missing Alpaca keys will prevent trading."}
            {!apiKeys?.openaiApiKey && " Missing OpenAI key will prevent AI analysis."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MarketSentimentPanel() {
  const { data: sentiment } = useQuery<MarketSentiment>({
    queryKey: ["/api/admin/market-sentiment"],
    refetchInterval: 10000,
  });

  const getSentimentColor = (sentiment: string) => {
    if (sentiment.includes("Bullish") || sentiment.includes("Optimistic")) return "bg-green-500/20 text-green-400";
    if (sentiment.includes("Bearish") || sentiment.includes("Pessimistic")) return "bg-red-500/20 text-red-400";
    return "bg-yellow-500/20 text-yellow-400";
  };

  const getFearGreedLabel = (index: number) => {
    if (index >= 75) return "Extreme Greed";
    if (index >= 55) return "Greed";
    if (index >= 45) return "Neutral";
    if (index >= 25) return "Fear";
    return "Extreme Fear";
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-xl text-slate-100">Real-time Market Sentiment</CardTitle>
        <p className="text-slate-400">AI-powered sentiment analysis from recent trading decisions</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Bitcoin Sentiment</span>
              <Badge className={getSentimentColor(sentiment?.btcSentiment || "Neutral")}>
                {sentiment?.btcSentiment || "Loading..."}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Solana Sentiment</span>
              <Badge className={getSentimentColor(sentiment?.solSentiment || "Neutral")}>
                {sentiment?.solSentiment || "Loading..."}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-300">Overall Market</span>
              <Badge className={getSentimentColor(sentiment?.overallSentiment || "Neutral")}>
                {sentiment?.overallSentiment || "Loading..."}
              </Badge>
            </div>
            {sentiment?.recentDecisions && (
              <div className="mt-4 p-3 bg-slate-700/30 rounded-lg">
                <div className="text-sm text-slate-400 mb-2">Recent AI Decisions ({sentiment.recentDecisions.total})</div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-400">Buy: {sentiment.recentDecisions.bullish}</span>
                  <span className="text-red-400">Sell: {sentiment.recentDecisions.bearish}</span>
                  <span className="text-yellow-400">Hold: {sentiment.recentDecisions.neutral}</span>
                </div>
              </div>
            )}
          </div>
          <div className="bg-slate-700/50 p-4 rounded-lg">
            <div className="text-sm text-slate-400 mb-2">AI Fear & Greed Index</div>
            <div className="text-3xl font-bold text-orange-400">
              {sentiment?.fearGreedIndex || "..."}
            </div>
            <div className="text-sm text-slate-400">
              {sentiment ? getFearGreedLabel(sentiment.fearGreedIndex) : "Loading..."}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState("BTC/USD");
  const [selectedPeriod, setSelectedPeriod] = useState("30d");

  const { data: systemStats } = useQuery<SystemStats>({
    queryKey: ["/api/admin/system-stats"],
    refetchInterval: 5000,
  });

  const runBacktest = async () => {
    setBacktestLoading(true);
    try {
      const response = await fetch("/api/admin/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: selectedAsset,
          period: selectedPeriod,
          strategy: "AI ICT/SMC",
        }),
      });
      const result = await response.json();
      setBacktestResult(result);
    } catch (error) {
      console.error("Backtest failed:", error);
    }
    setBacktestLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Admin Control Center
            </h1>
            <p className="text-slate-400 mt-2">Comprehensive trading bot management and analytics</p>
          </div>
          <Badge variant="secondary" className="px-4 py-2">
            <Activity className="w-4 h-4 mr-2" />
            System Online
          </Badge>
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total P&L</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                ${systemStats?.totalPnl?.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Total Trades</CardTitle>
              <BarChart3 className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">
                {systemStats?.totalTrades || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Active Positions</CardTitle>
              <Activity className="h-4 w-4 text-orange-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-400">
                {systemStats?.activePositions || 0}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">Trading Assets</CardTitle>
              <Settings className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">
                {systemStats?.totalAssets || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="backtest" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-slate-800/50 border-slate-700">
            <TabsTrigger value="backtest">Backtesting</TabsTrigger>
            <TabsTrigger value="sentiment">Market Sentiment</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Backtesting Tab */}
          <TabsContent value="backtest" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl text-slate-100">Strategy Backtesting</CardTitle>
                <p className="text-slate-400">Test AI trading strategies against historical data</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Asset</label>
                    <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                      <SelectTrigger className="bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                        <SelectItem value="SOL/USD">SOL/USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Period</label>
                    <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                      <SelectTrigger className="bg-slate-700 border-slate-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">7 Days</SelectItem>
                        <SelectItem value="30d">30 Days</SelectItem>
                        <SelectItem value="90d">90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={runBacktest}
                      disabled={backtestLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {backtestLoading ? "Running..." : "Run Backtest"}
                    </Button>
                  </div>
                </div>

                {backtestResult && (
                  <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400">Total Return</div>
                      <div className="text-2xl font-bold text-green-400">
                        +{backtestResult.totalReturn}%
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400">Sharpe Ratio</div>
                      <div className="text-2xl font-bold text-blue-400">
                        {backtestResult.sharpeRatio}
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400">Max Drawdown</div>
                      <div className="text-2xl font-bold text-red-400">
                        {backtestResult.maxDrawdown}%
                      </div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <div className="text-sm text-slate-400">Win Rate</div>
                      <div className="text-2xl font-bold text-purple-400">
                        {backtestResult.winRate}%
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Market Sentiment Tab */}
          <TabsContent value="sentiment" className="space-y-6">
            <MarketSentimentPanel />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <ApiKeyManagementPanel />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <AssetManagementPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}