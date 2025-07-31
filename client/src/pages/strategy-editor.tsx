import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Plus, Save, X } from "lucide-react";
import type { TradingStrategy, InsertTradingStrategy } from "@shared/schema";

export default function StrategyEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [selectedStrategy, setSelectedStrategy] = useState<TradingStrategy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    systemPrompt: "",
    personalityPrompt: "",
    isDefault: false
  });

  // Fetch all strategies
  const { data: strategies = [], isLoading } = useQuery<TradingStrategy[]>({
    queryKey: ["/api/strategies"],
    queryFn: () => apiRequest("/api/strategies")
  });

  // Create strategy mutation
  const createMutation = useMutation({
    mutationFn: (data: InsertTradingStrategy) => apiRequest("/api/strategies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy created successfully" });
      resetForm();
      setIsEditing(false);
    },
    onError: (error: any) => {
      console.error("Create strategy error:", error);
      toast({ 
        title: "Failed to create strategy",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  // Update strategy mutation  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TradingStrategy> }) => apiRequest(`/api/strategies/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy updated successfully" });
      setIsEditing(false);
    },
    onError: (error: any) => {
      console.error("Update strategy error:", error);
      toast({ 
        title: "Failed to update strategy",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    }
  });

  // Delete strategy mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/strategies/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strategies"] });
      toast({ title: "Strategy deleted successfully" });
      setSelectedStrategy(null);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Delete strategy error:", error);
      toast({ 
        title: "Failed to delete strategy",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
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
      personalityPrompt: strategy.personalityPrompt || "",
      isDefault: strategy.isDefault || false
    });
    setIsEditing(false);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      toast({
        title: "Missing required fields",
        description: "Name and system prompt are required",
        variant: "destructive"
      });
      return;
    }

    if (selectedStrategy && !isEditing) {
      // This should not happen, but handle it gracefully
      setIsEditing(true);
      return;
    }

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
  }, [strategies, selectedStrategy]);

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
            setIsEditing(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
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
                  <div>
                    <h3 className="font-medium">{strategy.name}</h3>
                    {strategy.isDefault && (
                      <Badge variant="secondary" className="mt-1">Default</Badge>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStrategySelect(strategy);
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(strategy.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Strategy Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedStrategy && !isEditing ? "Strategy Details" : "Edit Strategy"}
              </CardTitle>
              {selectedStrategy && !isEditing && (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedStrategy && !isEditing ? (
              <div className="text-center py-8 text-muted-foreground">
                Select a strategy to view details or create a new one
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="name">Strategy Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter strategy name"
                    disabled={selectedStrategy && !isEditing}
                  />
                </div>

                <div>
                  <Label htmlFor="systemPrompt">System Prompt *</Label>
                  <Textarea
                    id="systemPrompt"
                    value={formData.systemPrompt}
                    onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    placeholder={`Enter the AI system prompt... 

Example: You are an advanced AI trading assistant specializing in ICT (Inner Circle Trader), Smart Money Concepts (SMC), and institutional order flow strategies.

When analyzing trading opportunities, consider:
- Market structure (BOS - Break of Structure, CHoCH - Change of Character)
- Liquidity grabs and inducements
- Fair value gaps (FVG)
- Order blocks (OB)
- Premium/discount zones
- Session timing (e.g. London/NY killzones)

Respond with JSON containing:
- recommendation: "BUY", "SELL", or "HOLD"
- reasoning: Detailed explanation
- position_sizing: Percentage (0.1 to 10.0)
- stop_loss: Percentage (0.5 to 5.0)
- take_profit: Percentage (1.0 to 10.0)`}
                    className="min-h-[200px]"
                    disabled={selectedStrategy && !isEditing}
                  />
                </div>

                <div>
                  <Label htmlFor="personalityPrompt">
                    Personality Prompt ({formData.personalityPrompt.length}/200)
                  </Label>
                  <Textarea
                    id="personalityPrompt"
                    value={formData.personalityPrompt}
                    onChange={(e) => handlePersonalityChange(e.target.value)}
                    placeholder="Optional: Define trading personality (aggressive, conservative, etc.)"
                    className="min-h-[100px]"
                    disabled={selectedStrategy && !isEditing}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                    disabled={selectedStrategy && !isEditing}
                  />
                  <Label htmlFor="isDefault">Set as default strategy</Label>
                </div>

                {(isEditing || !selectedStrategy) && (
                  <div className="flex gap-2 pt-4">
                    <Button 
                      onClick={handleSave}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {selectedStrategy ? "Update" : "Create"} Strategy
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        if (selectedStrategy) {
                          handleStrategySelect(selectedStrategy);
                        } else {
                          resetForm();
                          setSelectedStrategy(null);
                          setIsEditing(false);
                        }
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}