import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from "recharts";
import { Activity, TrendingUp, TrendingDown, AlertTriangle, Settings, BarChart3, Brain } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MarketSentimentData {
  timestamp: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  fearGreedIndex: number;
  socialMentions: number;
  newsScore: number;
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

export default function Admin() {
  const [selectedAsset, setSelectedAsset] = useState("BTC/USD");
  const [backtestPeriod, setBacktestPeriod] = useState("30d");
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [globalPaused, setGlobalPaused] = useState(false);

  // Mock data - replace with real API calls
  const sentimentData: MarketSentimentData[] = [
    { timestamp: "2025-07-31T10:00:00Z", sentiment: "bullish", confidence: 0.75, fearGreedIndex: 65, socialMentions: 12500, newsScore: 0.8 },
    { timestamp: "2025-07-31T11:00:00Z", sentiment: "bullish", confidence: 0.82, fearGreedIndex: 68, socialMentions: 13200, newsScore: 0.9 },
    { timestamp: "2025-07-31T12:00:00Z", sentiment: "neutral", confidence: 0.45, fearGreedIndex: 52, socialMentions: 11800, newsScore: 0.6 },
    { timestamp: "2025-07-31T13:00:00Z", sentiment: "bearish", confidence: 0.71, fearGreedIndex: 35, socialMentions: 14500, newsScore: 0.3 },
    { timestamp: "2025-07-31T14:00:00Z", sentiment: "bearish", confidence: 0.88, fearGreedIndex: 28, socialMentions: 16200, newsScore: 0.2 },
  ];

  const { data: assets } = useQuery({
    queryKey: ["/api/assets"],
  });

  const { data: systemStats } = useQuery({
    queryKey: ["/api/admin/system-stats"],
    refetchInterval: 5000,
  });

  const runBacktest = async () => {
    setIsBacktesting(true);
    try {
      // Implement backtesting API call
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate API call
    } finally {
      setIsBacktesting(false);
    }
  };

  const toggleGlobalTrading = async () => {
    setGlobalPaused(!globalPaused);
    // Implement global pause/resume API call
  };

  const currentSentiment = sentimentData[sentimentData.length - 1];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trading System Admin</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={!globalPaused}
              onCheckedChange={toggleGlobalTrading}
              id="global-trading"
            />
            <Label htmlFor="global-trading">Global Trading</Label>
          </div>
          <Badge variant={globalPaused ? "destructive" : "default"}>
            {globalPaused ? "PAUSED" : "ACTIVE"}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sentiment">Market Sentiment</TabsTrigger>
          <TabsTrigger value="backtest">Backtesting</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">+$2,457.32</div>
                <p className="text-xs text-muted-foreground">+12.3% from last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">Across 2 assets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">68.5%</div>
                <p className="text-xs text-muted-foreground">Last 100 trades</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Decisions</CardTitle>
                <Brain className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,247</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Asset Performance</CardTitle>
              <CardDescription>Daily P&L by asset</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { asset: "BTC/USD", pnl: 1245.50, trades: 45 },
                  { asset: "SOL/USD", pnl: 567.20, trades: 38 },
                  { asset: "ETH/USD", pnl: 890.15, trades: 52 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="asset" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="pnl" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Sentiment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Badge variant={
                    currentSentiment.sentiment === "bullish" ? "default" :
                    currentSentiment.sentiment === "bearish" ? "destructive" : "secondary"
                  }>
                    {currentSentiment.sentiment.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(currentSentiment.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="mt-2">
                  <div className="text-2xl font-bold">{currentSentiment.fearGreedIndex}</div>
                  <p className="text-xs text-muted-foreground">Fear & Greed Index</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentSentiment.socialMentions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Mentions in last hour</p>
                <div className="mt-2">
                  <div className="text-lg font-semibold">{Math.round(currentSentiment.newsScore * 100)}%</div>
                  <p className="text-xs text-muted-foreground">News sentiment score</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sentiment Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">High volatility detected</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Fear index below 30</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Real-time Sentiment Analysis</CardTitle>
              <CardDescription>Market sentiment over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={sentimentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="fearGreedIndex"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sentiment Confidence</CardTitle>
              <CardDescription>AI confidence in sentiment analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={sentimentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(time) => new Date(time).toLocaleTimeString()} />
                  <YAxis domain={[0, 1]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="confidence" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backtest" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Strategy Backtesting</CardTitle>
              <CardDescription>Test trading strategies against historical data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asset-select">Asset</Label>
                  <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BTC/USD">BTC/USD</SelectItem>
                      <SelectItem value="SOL/USD">SOL/USD</SelectItem>
                      <SelectItem value="ETH/USD">ETH/USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period-select">Period</Label>
                  <Select value={backtestPeriod} onValueChange={setBacktestPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                      <SelectItem value="90d">90 Days</SelectItem>
                      <SelectItem value="1y">1 Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>&nbsp;</Label>
                  <Button onClick={runBacktest} disabled={isBacktesting} className="w-full">
                    {isBacktesting ? "Running..." : "Run Backtest"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Current Strategy Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total Return:</span>
                        <span className="font-bold text-green-600">+24.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sharpe Ratio:</span>
                        <span className="font-bold">1.85</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Drawdown:</span>
                        <span className="font-bold text-red-600">-8.2%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Win Rate:</span>
                        <span className="font-bold">68.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Trades:</span>
                        <span className="font-bold">247</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Strategy Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { strategy: "Current AI", return: 24.5, sharpe: 1.85 },
                        { strategy: "Buy & Hold", return: 18.2, sharpe: 1.12 },
                        { strategy: "RSI Only", return: 15.8, sharpe: 0.95 },
                        { strategy: "MACD Only", return: 12.4, sharpe: 0.78 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="strategy" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="return" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>Manage global trading parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-limit">Risk Limit (%)</Label>
                  <Input id="risk-limit" type="number" defaultValue="2" min="0.1" max="10" step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-positions">Max Positions</Label>
                  <Input id="max-positions" type="number" defaultValue="5" min="1" max="20" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-interval">Default Interval (seconds)</Label>
                  <Input id="default-interval" type="number" defaultValue="300" min="60" max="3600" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sentiment-weight">Sentiment Weight</Label>
                  <Input id="sentiment-weight" type="number" defaultValue="0.3" min="0" max="1" step="0.1" />
                </div>
              </div>
              
              <div className="flex space-x-4 pt-4">
                <Button>Save Configuration</Button>
                <Button variant="outline">Reset to Defaults</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Model Settings</CardTitle>
              <CardDescription>Configure OpenAI model parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select defaultValue="gpt-4o">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input id="temperature" type="number" defaultValue="0.1" min="0" max="2" step="0.1" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}