import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Position } from "@shared/schema";

interface ActivePositionsProps {
  positions: Position[];
}

export default function ActivePositions({ positions }: ActivePositionsProps) {
  const [positionToClose, setPositionToClose] = useState<Position | null>(null);
  const { toast } = useToast();

  const closePositionMutation = useMutation({
    mutationFn: async (positionId: string) => {
      console.log(`Attempting to close position: ${positionId}`);
      return await apiRequest(`/api/positions/${positionId}/close`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Position Closed",
        description: "Position closed successfully",
      });
      setPositionToClose(null);
      // Refresh the page to update all data
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Close Position",
        description: error.message || "Failed to close position",
        variant: "destructive",
      });
    },
  });

  const confirmClosePosition = () => {
    if (positionToClose) {
      closePositionMutation.mutate(positionToClose.id);
    }
  };

  return (
    <Card className="glass-panel-dark border-white/20">
      <CardHeader>
        <CardTitle className="text-white">Active Positions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Positions Table */}
        {positions.length === 0 ? (
          <p className="text-center text-white/70">No open positions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Symbol</th>
                  <th className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Side</th>
                  <th className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Quantity</th>
                  <th className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Entry Price</th>
                  <th className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/70">P&L</th>
                  <th className="pb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Action</th>
                </tr>
              </thead>
              <tbody>
                {positions.filter(pos => pos.isOpen).map((position) => (
                  <tr key={position.id} className="border-b border-white/10">
                    <td className="py-3 font-semibold text-cyan-400">{position.symbol}</td>
                    <td className="py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                        position.side === 'long' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {position.side}
                      </span>
                    </td>
                    <td className="py-3 text-white">{parseFloat(position.quantity || "0").toFixed(6)}</td>
                    <td className="py-3 text-white">${parseFloat(position.avgEntryPrice || "0").toFixed(2)}</td>
                    <td className={`py-3 font-bold ${
                      parseFloat(position.unrealizedPnl || "0") >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {parseFloat(position.unrealizedPnl || "0") >= 0 ? '+' : ''}
                      ${parseFloat(position.unrealizedPnl || "0").toFixed(2)}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPositionToClose(position)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Close Position Confirmation Dialog */}
        {positionToClose && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4 glass-panel-dark border-white/20">
              <CardHeader>
                <CardTitle className="text-white">Close Position</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-white/80">
                  Are you sure you want to close your {positionToClose.side} position in {positionToClose.symbol}?
                </p>
                <div className="flex space-x-2">
                  <Button
                    onClick={confirmClosePosition}
                    disabled={closePositionMutation.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    {closePositionMutation.isPending ? "Closing..." : "Close Position"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPositionToClose(null)}
                    className="flex-1 border-white/20 text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}