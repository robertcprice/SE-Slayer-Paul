import { useEffect, useRef, useState } from "react";

interface UseWebSocketReturn {
  sendMessage: (message: string) => void;
  lastMessage: MessageEvent | null;
  isConnected: boolean;
}

export function useWebSocket(assetSymbol: string): UseWebSocketReturn {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const assetRef = useRef(assetSymbol);
  
  // Update the asset reference when it changes
  assetRef.current = assetSymbol;

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log(`WebSocket connected for asset: ${assetRef.current}`);
        setIsConnected(true);
        
        // Send asset subscription message
        if (ws.current && assetRef.current) {
          ws.current.send(JSON.stringify({ 
            action: 'subscribe', 
            asset: assetRef.current 
          }));
        }
        
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
      };

      ws.current.onmessage = (event) => {
        setLastMessage(event);
      };

      ws.current.onclose = () => {
        console.log(`WebSocket disconnected for asset: ${assetRef.current}`);
        setIsConnected(false);
        
        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => {
            console.log(`Attempting to reconnect for asset: ${assetRef.current}`);
            connect();
          }, 3000);
        }
      };

      ws.current.onerror = (error) => {
        console.error(`WebSocket error for asset ${assetRef.current}:`, error);
        setIsConnected(false);
      };
    } catch (error) {
      console.error(`Failed to create WebSocket connection for asset ${assetRef.current}:`, error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [assetSymbol]);

  const sendMessage = (message: string) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(message);
    } else {
      console.warn(`WebSocket not connected, cannot send message: ${message}`);
    }
  };

  return {
    sendMessage,
    lastMessage,
    isConnected,
  };
}
