export function connectTamagotchi(onEvent: (event: any) => void) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ action: 'subscribe_tamagotchi' }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'tamagotchi_event') {
        onEvent(msg.event);
      }
    } catch (err) {
      console.error('Tamagotchi socket error', err);
    }
  };

  return () => ws.close();
}
