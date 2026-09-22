import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { WsEvent } from '../shared/types';

let _wss: WebSocketServer | null = null;

export function initRealtimeServer(httpServer: any): void {
  _wss = new WebSocketServer({ noServer: true });

  _wss.on('connection', (ws) => {
    ws.on('error', (err) => console.error('SPA WS client error:', err));
  });

  // Route upgrades: /_ws → SPA realtime, /_ws/socket-mode → Socket Mode
  httpServer.on(
    'upgrade',
    (req: IncomingMessage, socket: any, head: Buffer) => {
      const pathname = req.url?.split('?')[0] ?? '';

      if (pathname === '/_ws/socket-mode') {
        import('./socketModeServer')
          .then(({ handleUpgrade }) => {
            handleUpgrade(req, socket, head);
          })
          .catch(() => socket.destroy());
        return;
      }

      if (pathname === '/_ws') {
        _wss!.handleUpgrade(req, socket, head, (ws) => {
          _wss!.emit('connection', ws, req);
        });
        return;
      }

      socket.destroy();
    }
  );

  console.log('WebSocket server initialized on /_ws');
}

export function broadcast(event: WsEvent): void {
  if (!_wss) return;
  const data = JSON.stringify(event);
  _wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });
}
