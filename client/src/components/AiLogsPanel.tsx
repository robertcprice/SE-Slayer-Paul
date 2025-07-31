import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Database } from "lucide-react";
import type { AiDecisionLog } from "@shared/schema";

interface AiLogsPanelProps {
  assetId?: string;
}

export function AiLogsPanel({ assetId }: AiLogsPanelProps) {
  const [selectedAsset, setSelectedAsset] = useState<string>(assetId || "all");
  const [limit, setLimit] = useState<number>(50);

  // Fetch AI decision logs
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/ai-logs', selectedAsset === "all" ? undefined : selectedAsset, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAsset !== "all") params.set('assetId', selectedAsset);
      params.set('limit', limit.toString());
      
      const response = await fetch(`/api/ai-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch AI logs');
      return response.json() as Promise<AiDecisionLog[]>;
    },
  });

  // Fetch available assets for filter
  const { data: assets = [] } = useQuery({
    queryKey: ['/api/assets'],
    queryFn: async () => {
      const response = await fetch('/api/assets');
      if (!response.ok) throw new Error('Failed to fetch assets');
      return response.json();
    },
  });

  const downloadJson = () => {
    const params = new URLSearchParams();
    if (selectedAsset !== "all") params.set('assetId', selectedAsset);
    
    const link = document.createElement('a');
    link.href = `/api/ai-logs/export/json?${params}`;
    link.download = `ai-decisions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCsv = () => {
    const params = new URLSearchParams();
    if (selectedAsset !== "all") params.set('assetId', selectedAsset);
    
    const link = document.createElement('a');
    link.href = `/api/ai-logs/export/csv?${params}`;
    link.download = `ai-decisions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY': return 'bg-green-500';
      case 'SELL': return 'bg-red-500';
      case 'HOLD': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            AI Decision Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assets</SelectItem>
                {assets.map((asset: any) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={downloadJson} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button onClick={downloadCsv} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">Loading AI decision logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No AI decision logs found. Start trading to see logged decisions here.
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className={getRecommendationColor(log.recommendation)}>
                        {log.recommendation}
                      </Badge>
                      <span className="font-medium">{log.symbol}</span>
                      <span className="text-sm text-muted-foreground">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown time'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {log.responseTimeMs && (
                        <span>{log.responseTimeMs}ms</span>
                      )}
                      {log.totalTokens && (
                        <span>{log.totalTokens} tokens</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm">
                    <strong>Reasoning:</strong>
                    <p className="mt-1 text-muted-foreground">{log.reasoning}</p>
                  </div>
                  
                  {(log.positionSizing || log.stopLoss || log.takeProfit) && (
                    <div className="flex gap-4 text-sm">
                      {log.positionSizing && (
                        <span>
                          <strong>Position:</strong> {log.positionSizing}%
                        </span>
                      )}
                      {log.stopLoss && (
                        <span>
                          <strong>Stop Loss:</strong> {log.stopLoss}%
                        </span>
                      )}
                      {log.takeProfit && (
                        <span>
                          <strong>Take Profit:</strong> {log.takeProfit}%
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Model: {log.modelUsed} | 
                    Prompt: {log.promptTokens || 0} | 
                    Completion: {log.completionTokens || 0} | 
                    Total: {log.totalTokens || 0} tokens
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}