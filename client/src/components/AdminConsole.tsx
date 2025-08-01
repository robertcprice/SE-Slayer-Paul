import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Terminal, Trash2, Download, Play, Pause } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'debug' | 'request';
  message: string;
  details?: any;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
}

export function AdminConsole() {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logs, isAutoScroll]);

  // WebSocket connection for real-time logs
  useEffect(() => {
    if (isEnabled) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isEnabled]);

  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        // Subscribe to console logs
        wsRef.current?.send(JSON.stringify({ 
          action: 'subscribe_console'
        }));
        console.log('Connected to console log stream');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'console_log') {
            setLogs(prev => [...prev, data.log]);
          } else if (data.type === 'console_logs_batch') {
            setLogs(data.logs);
          }
        } catch (error) {
          console.error('Error parsing console log message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('Console log WebSocket disconnected');
        // Attempt to reconnect after 3 seconds if still enabled
        if (isEnabled) {
          setTimeout(connectWebSocket, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Console log WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect to console log stream:', error);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const clearLogs = async () => {
    try {
      await apiRequest("/api/admin/console/clear", {
        method: "POST"
      });
      setLogs([]);
      toast({ title: "Console logs cleared" });
    } catch (error) {
      toast({ 
        title: "Failed to clear logs",
        variant: "destructive"
      });
    }
  };

  const exportLogs = () => {
    const logData = logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      ...(log.endpoint && { endpoint: log.endpoint }),
      ...(log.method && { method: log.method }),
      ...(log.statusCode && { statusCode: log.statusCode }),
      ...(log.duration && { duration: log.duration }),
      ...(log.details && { details: log.details })
    }));

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: "Console logs exported" });
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'warn': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'info': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'debug': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      case 'request': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getStatusCodeColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-400';
    if (statusCode >= 300 && statusCode < 400) return 'text-yellow-400';
    if (statusCode >= 400 && statusCode < 500) return 'text-orange-400';
    if (statusCode >= 500) return 'text-red-400';
    return 'text-gray-400';
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-slate-400" />
            <CardTitle className="text-xl text-slate-100">System Console</CardTitle>
            <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
              {isEnabled ? 'ACTIVE' : 'DISABLED'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Enable Console</span>
            <Switch 
              checked={isEnabled} 
              onCheckedChange={setIsEnabled}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-700 border-slate-600 text-slate-200 rounded px-2 py-1 text-sm"
            >
              <option value="all">All Logs</option>
              <option value="info">Info</option>
              <option value="warn">Warnings</option>
              <option value="error">Errors</option>
              <option value="debug">Debug</option>
              <option value="request">Requests</option>
            </select>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-slate-400">Auto-scroll</span>
              <Switch 
                checked={isAutoScroll} 
                onCheckedChange={setIsAutoScroll}
                size="sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={exportLogs}
              size="sm"
              variant="outline"
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              onClick={clearLogs}
              size="sm"
              variant="outline"
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
              disabled={logs.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        {/* Log Display */}
        <div className="bg-black/50 rounded-lg border border-slate-700 h-96">
          {!isEnabled ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Enable console to view real-time logs</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full p-3" ref={scrollAreaRef}>
              {filteredLogs.length === 0 ? (
                <div className="text-slate-400 text-center py-8">
                  No logs to display
                </div>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {filteredLogs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2 text-slate-300">
                      <span className="text-slate-500 shrink-0">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`shrink-0 text-xs ${getLevelColor(log.level)}`}
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      {log.method && (
                        <Badge variant="outline" className="shrink-0 text-xs bg-purple-500/20 text-purple-300 border-purple-500/30">
                          {log.method}
                        </Badge>
                      )}
                      {log.statusCode && (
                        <span className={`shrink-0 text-xs ${getStatusCodeColor(log.statusCode)}`}>
                          {log.statusCode}
                        </span>
                      )}
                      {log.duration && (
                        <span className="shrink-0 text-xs text-slate-400">
                          {log.duration}ms
                        </span>
                      )}
                      <span className="flex-1 break-words">
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* Stats */}
        {isEnabled && (
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>{filteredLogs.length} logs displayed</span>
            <span>
              {logs.filter(l => l.level === 'error').length} errors, 
              {logs.filter(l => l.level === 'warn').length} warnings
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}