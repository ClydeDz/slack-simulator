import { useEffect } from 'react';
import { useStore } from '../store';
import type { WsEvent } from '@shared/types';

export function useRealtimeWS() {
  const applyWsEvent = useStore((s) => s.applyWsEvent);

  useEffect(() => {
    const wsUrl = `ws://${window.location.host}/_ws`;
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let stopped = false;

    function connect() {
      if (stopped) return;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const event: WsEvent = JSON.parse(e.data);
          applyWsEvent(event);
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        if (!stopped) reconnectTimer = setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [applyWsEvent]);
}
