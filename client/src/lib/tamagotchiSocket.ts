export function connectTamagotchi(onEvent: (event: any) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  console.log('🔌 Connecting to WebSocket:', wsUrl);
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('🔌 WebSocket connected, subscribing to tamagotchi events');
    ws.send(JSON.stringify({ action: 'subscribe_tamagotchi' }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      console.log('🔌 WebSocket message received:', msg);
      if (msg.type === 'tamagotchi_event') {
        console.log('🔌 Tamagotchi event detected:', msg.event);
        onEvent(msg.event);
      }
    } catch (err) {
      console.error('🔌 Tamagotchi socket parse error', err);
    }
  };
  
  ws.onerror = (error) => {
    console.error('🔌 WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('🔌 WebSocket connection closed');
  };

  return () => {
    console.log('🔌 Closing WebSocket connection');
    ws.close();
  };
}
