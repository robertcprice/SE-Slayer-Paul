import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { TradingStrategy } from "@shared/schema";

export default function StrategyEditor() {
  const [selectedStrategy, setSelectedStrategy] = useState<TradingStrategy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    systemPrompt: "",
    personalityPrompt: "",
    isDefault: false
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch strategies
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ["/api/strategies"],
    queryFn: () => apiRequest("/api/strategies")
  });

  // Create strategy mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/strategies", {
      method: "POST",
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setIsEditing(false);
      resetForm();
      toast({ title: "Strategy created successfully" });
    }
  });

  // Update strategy mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest(`/api/strategies/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      setIsEditing(false);
      toast({ title: "Strategy updated successfully" });
    }
  });

  // Delete strategy mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/strategies/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      if (selectedStrategy) {
        setSelectedStrategy(null);
        resetForm();
      }
      toast({ title: "Strategy deleted successfully" });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      systemPrompt: "",
      personalityPrompt: "",
      isDefault: false
    });
  };

  const handleStrategySelect = (strategy: TradingStrategy) => {
    setSelectedStrategy(strategy);
    setFormData({
      name: strategy.name,
      systemPrompt: strategy.systemPrompt,
      personalityPrompt: strategy.personalityPrompt,
      isDefault: strategy.isDefault || false
    });
    setIsEditing(false);
  };

  const handleSave = () => {
    if (selectedStrategy) {
      updateMutation.mutate({ id: selectedStrategy.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePersonalityChange = (value: string) => {
    if (value.length <= 200) {
      setFormData(prev => ({ ...prev, personalityPrompt: value }));
    }
  };

  const defaultSystemPrompt = `You are an advanced AI trading assistant specializing in ICT (Inner Circle Trader), Smart Money Concepts (SMC), and institutional order flow strategies.

When analyzing a trading opportunity, consider the following concepts:
- Market structure (BOS - Break of Structure, CHoCH - Change of Character)
- Liquidity grabs and inducements
- Fair value gaps (FVG)
- Order blocks (OB) 
- Premium/discount zones
- Imbalance
- Session timing (e.g. London/NY killzones)
- Relative equal highs/lows (liquidity pools)
- Classic indicators (RSI, moving averages) only as confluence, not as a primary driver

Analyze the market data provided and make a recommendation based on ICT/SMC principles. Clearly explain which concepts informed your analysis.

Respond with a JSON object containing:
- recommendation: "BUY", "SELL", or "HOLD"
- reasoning: Detailed explanation of your analysis
- position_sizing: Percentage of portfolio (0.1 to 10.0)
- stop_loss: Percentage below entry (0.5 to 5.0)
- take_profit: Percentage above entry (1.0 to 10.0)`;

  useEffect(() => {
    if (strategies.length > 0 && !selectedStrategy) {
      const defaultStrategy = strategies.find((s: TradingStrategy) => s.isDefault);
      if (defaultStrategy) {
        handleStrategySelect(defaultStrategy);
      }
    }
  }, [strategies]);

  if (isLoading) {
    return <div className="p-8">Loading strategies...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Trading Strategy Editor</h1>
        <Button 
          onClick={() => {
            setSelectedStrategy(null);
            resetForm();
            setFormData(prev => ({ ...prev, systemPrompt: defaultSystemPrompt }));
            setIsEditing(true);
          }}
        >
          Create New Strategy
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Strategy List */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Strategies</CardTitle>
            <CardDescription>Select a strategy to view or edit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {strategies.map((strategy: TradingStrategy) => (
              <div
                key={strategy.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedStrategy?.id === strategy.id 
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                    : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                }`}
                onClick={() => handleStrategySelect(strategy)}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{strategy.name}</h3>
                  {strategy.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
                  {strategy.personalityPrompt || "No personality set"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Strategy Editor */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStrategy || isEditing ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {isEditing ? "Edit Strategy" : selectedStrategy?.name || "New Strategy"}
                      </CardTitle>
                      <CardDescription>
                        Customize the AI trading prompt and personality
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {!isEditing && selectedStrategy && (
                        <Button variant="outline" onClick={() => setIsEditing(true)}>
                          Edit
                        </Button>
                      )}
                      {selectedStrategy && (
                        <Button
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(selectedStrategy.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Strategy Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      disabled={!isEditing}
                      placeholder="e.g., ICT Scalping Strategy"
                    />
                  </div>

                  <div>
                    <Label htmlFor="personality">
                      Trading Personality ({formData.personalityPrompt.length}/200)
                    </Label>
                    <Textarea
                      id="personality"
                      value={formData.personalityPrompt}
                      onChange={(e) => handlePersonalityChange(e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g., Aggressive scalper focusing on 1-5 minute timeframes, seeking quick profits with tight stop losses"
                      className="h-20"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Define the trading style and personality (scalper, swing trader, conservative, aggressive, etc.)
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="systemPrompt">System Prompt</Label>
                    <Textarea
                      id="systemPrompt"
                      value={formData.systemPrompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                      disabled={!isEditing}
                      className="h-96 font-mono text-sm"
                      placeholder="Enter the complete system prompt for the AI trading assistant..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This prompt controls how the AI analyzes market data and makes trading decisions
                    </p>
                  </div>

                  {isEditing && (
                    <div className="flex gap-2 pt-4">
                      <Button 
                        onClick={handleSave}
                        disabled={!formData.name || !formData.systemPrompt || createMutation.isPending || updateMutation.isPending}
                      >
                        {selectedStrategy ? "Save Changes" : "Create Strategy"}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          if (selectedStrategy) {
                            handleStrategySelect(selectedStrategy);
                          } else {
                            setSelectedStrategy(null);
                            resetForm();
                          }
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-gray-500">No Strategy Selected</h3>
                  <p className="text-gray-400 mt-2">Select a strategy from the list or create a new one</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}