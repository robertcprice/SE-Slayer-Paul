import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Settings, Pause, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface TradingAsset {
  id: string;
  symbol: string;
  isActive: boolean;
  interval: number;
  isPaused: boolean;
  maxPositionSize: string;
  stopLossPercent: string;
  takeProfitPercent: string;
  createdAt: string;
}

interface AssetForm {
  symbol: string;
  interval: number;
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export function AssetManagementPanel() {
  const { toast } = useToast();
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [newAsset, setNewAsset] = useState<AssetForm>({
    symbol: "",
    interval: 300,
    maxPositionSize: 5.0,
    stopLossPercent: 2.0,
    takeProfitPercent: 4.0,
  });

  // Fetch assets
  const { data: assets = [], isLoading } = useQuery<TradingAsset[]>({
    queryKey: ["/api/admin/assets"],
    refetchInterval: 5000,
  });

  // Create asset mutation
  const createAssetMutation = useMutation({
    mutationFn: async (asset: AssetForm) => {
      const response = await fetch("/api/admin/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] }); // Also invalidate dashboard assets
      setIsAddingAsset(false);
      setNewAsset({
        symbol: "",
        interval: 300,
        maxPositionSize: 5.0,
        stopLossPercent: 2.0,
        takeProfitPercent: 4.0,
      });
      toast({
        title: "Asset Added",
        description: "Trading asset created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create asset",
        variant: "destructive",
      });
    },
  });

  // Update asset mutation
  const updateAssetMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TradingAsset> }) => {
      const response = await fetch(`/api/admin/assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] }); // Also invalidate dashboard assets
      setEditingAsset(null);
      toast({
        title: "Asset Updated",
        description: "Trading settings updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update asset",
        variant: "destructive",
      });
    },
  });

  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/assets/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assets"] }); // Also invalidate dashboard assets
      toast({
        title: "Asset Removed",
        description: "Trading asset deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete asset",
        variant: "destructive",
      });
    },
  });

  const handleCreateAsset = () => {
    if (!newAsset.symbol.trim()) {
      toast({
        title: "Error",
        description: "Symbol is required",
        variant: "destructive",
      });
      return;
    }
    createAssetMutation.mutate(newAsset);
  };

  const handleUpdateAsset = (asset: TradingAsset, field: string, value: any) => {
    updateAssetMutation.mutate({
      id: asset.id,
      updates: { [field]: value },
    });
  };

  const handleDeleteAsset = (id: string) => {
    if (confirm("Are you sure you want to delete this asset?")) {
      deleteAssetMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center text-slate-400">Loading assets...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add New Asset */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Trading Asset
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAddingAsset ? (
            <Button 
              onClick={() => setIsAddingAsset(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Asset
            </Button>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300">Symbol</label>
                <Input
                  value={newAsset.symbol}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, symbol: e.target.value.toUpperCase() }))}
                  placeholder="BTC/USD"
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Interval (seconds)</label>
                <Input
                  type="number"
                  value={newAsset.interval}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Max Position (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={newAsset.maxPositionSize}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, maxPositionSize: parseFloat(e.target.value) }))}
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Stop Loss (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={newAsset.stopLossPercent}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, stopLossPercent: parseFloat(e.target.value) }))}
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300">Take Profit (%)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={newAsset.takeProfitPercent}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, takeProfitPercent: parseFloat(e.target.value) }))}
                  className="bg-slate-700 border-slate-600 text-slate-100"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={handleCreateAsset}
                  disabled={createAssetMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createAssetMutation.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  onClick={() => setIsAddingAsset(false)}
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Assets */}
      <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Trading Assets & Configuration
          </CardTitle>
          <p className="text-slate-400">Manage position sizes, stop losses, and take profits</p>
        </CardHeader>
        <CardContent>
          {assets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No trading assets configured. Add one above to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {assets.map((asset: TradingAsset) => (
                <div
                  key={asset.id}
                  className="p-4 bg-slate-700/50 rounded-lg border border-slate-600"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-100">{asset.symbol}</h3>
                      <Badge variant={asset.isActive ? "default" : "secondary"}>
                        {asset.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {asset.isPaused && (
                        <Badge variant="outline" className="border-orange-500 text-orange-400">
                          Paused
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateAsset(asset, "isPaused", !asset.isPaused)}
                        className="border-slate-600"
                      >
                        {asset.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="border-red-600 text-red-400 hover:bg-red-600/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {editingAsset === asset.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-300">Interval (sec)</label>
                        <Input
                          type="number"
                          defaultValue={asset.interval}
                          onBlur={(e) => handleUpdateAsset(asset, "interval", parseInt(e.target.value))}
                          className="bg-slate-600 border-slate-500 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Max Position (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          defaultValue={asset.maxPositionSize}
                          onBlur={(e) => handleUpdateAsset(asset, "maxPositionSize", e.target.value)}
                          className="bg-slate-600 border-slate-500 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Stop Loss (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          defaultValue={asset.stopLossPercent}
                          onBlur={(e) => handleUpdateAsset(asset, "stopLossPercent", e.target.value)}
                          className="bg-slate-600 border-slate-500 text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-300">Take Profit (%)</label>
                        <Input
                          type="number"
                          step="0.1"
                          defaultValue={asset.takeProfitPercent}
                          onBlur={(e) => handleUpdateAsset(asset, "takeProfitPercent", e.target.value)}
                          className="bg-slate-600 border-slate-500 text-slate-100"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-400">Interval</label>
                        <div className="text-lg font-semibold text-blue-400">{asset.interval}s</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-400">Max Position</label>
                        <div className="text-lg font-semibold text-green-400">{asset.maxPositionSize}%</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-400">Stop Loss</label>
                        <div className="text-lg font-semibold text-red-400">{asset.stopLossPercent}%</div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-400">Take Profit</label>
                        <div className="text-lg font-semibold text-orange-400">{asset.takeProfitPercent}%</div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingAsset(editingAsset === asset.id ? null : asset.id)}
                      className="border-slate-600 text-slate-300"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      {editingAsset === asset.id ? "Done" : "Edit Settings"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}