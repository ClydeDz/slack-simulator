import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

// ── Ticket store (one-time use, 60s TTL) ──────────────────────────────────────
const _tickets = new Map<string, { appId: string; expiresAt: number }>();

export function issueTicket(appId: string): string {
  const ticket = `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  _tickets.set(ticket, { appId, expiresAt: Date.now() + 60_000 });
  return ticket;
}

function redeemTicket(ticket: string): string | null {
  const entry = _tickets.get(ticket);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _tickets.delete(ticket);
    return null;
  }
  _tickets.delete(ticket);
  return entry.appId;
}

// ── Active connections: appId → WebSocket ─────────────────────────────────────
// Real Slack supports multiple connections; we keep the latest one per app.
const _connections = new Map<string, WebSocket>();

// ── Pending ack tracking ──────────────────────────────────────────────────────
type AckResolve = (result: {
  acked: boolean;
  responsePayload?: unknown;
}) => void;
const _pendingAcks = new Map<string, AckResolve>();
const ACK_TIMEOUT_MS = 30_000;

// ── WS server ─────────────────────────────────────────────────────────────────
let _wss: WebSocketServer | null = null;

export function initSocketModeServer(httpServer: any): void {
  _wss = new WebSocketServer({ noServer: true });

  _wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const ticket = url.searchParams.get('ticket') ?? '';
    const appId = redeemTicket(ticket);

    if (!appId) {
      ws.close(4001, 'invalid_ticket');
      return;
    }

    // Evict previous connection for this app — close silently, no disconnect
    // message. Sending a disconnect frame causes @slack/socket-mode to enter
    // 'connecting' state; if another event then arrives the state machine
    // throws "Unhandled event 'server explicit disconnect' in state 'connecting'".
    const prev = _connections.get(appId);
    if (prev && prev.readyState === WebSocket.OPEN) {
      prev.close();
    }
    _connections.set(appId, ws);

    // Send hello
    ws.send(
      JSON.stringify({
        type: 'hello',
        num_connections: 1,
        debug_info: {
          host: 'slack-simulator',
          started: new Date().toISOString(),
          build_number: 1,
        },
      })
    );

    // Handle acks from the bot
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.envelope_id) {
          const resolve = _pendingAcks.get(msg.envelope_id);
          if (resolve) {
            _pendingAcks.delete(msg.envelope_id);
            resolve({ acked: true, responsePayload: msg.payload ?? undefined });
          }
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      if (_connections.get(appId) === ws) _connections.delete(appId);
    });

    ws.on('error', () => {
      if (_connections.get(appId) === ws) _connections.delete(appId);
    });
  });

  console.log('Socket Mode WS server ready at /_ws/socket-mode');
}

/** Called by the HTTP upgrade router — hands off the connection to this server */
export function handleUpgrade(
  req: IncomingMessage,
  socket: any,
  head: Buffer
): void {
  if (!_wss) {
    socket.destroy();
    return;
  }
  _wss.handleUpgrade(req, socket, head, (ws) => {
    _wss!.emit('connection', ws, req);
  });
}

/**
 * Send an event envelope to the app over Socket Mode.
 * Returns true if the bot acked within 30 s, false otherwise.
 */
export async function enqueueSocketModeEvent(
  appId: string,
  envelopeId: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const ws = _connections.get(appId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;

  const envelope = {
    envelope_id: envelopeId,
    type: 'events_api',
    payload,
    accepts_response_payload: false,
  };

  ws.send(JSON.stringify(envelope));

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      _pendingAcks.delete(envelopeId);
      resolve(false);
    }, ACK_TIMEOUT_MS);

    _pendingAcks.set(envelopeId, ({ acked }) => {
      clearTimeout(timer);
      resolve(acked);
    });
  });
}

/**
 * Send an `interactive` envelope (block_actions, view_submission, view_closed)
 * and return the ack + optional response payload.
 */
export async function enqueueSocketModeInteractive(
  appId: string,
  envelopeId: string,
  payload: Record<string, unknown>
): Promise<{ acked: boolean; responsePayload?: unknown }> {
  const ws = _connections.get(appId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return { acked: false };

  const envelope = {
    envelope_id: envelopeId,
    type: 'interactive',
    payload,
    accepts_response_payload: true,
  };

  ws.send(JSON.stringify(envelope));

  return new Promise<{ acked: boolean; responsePayload?: unknown }>(
    (resolve) => {
      const timer = setTimeout(() => {
        _pendingAcks.delete(envelopeId);
        resolve({ acked: false });
      }, ACK_TIMEOUT_MS);

      _pendingAcks.set(envelopeId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
    }
  );
}

/**
 * Send a slash_commands envelope and return both the ack status and any
 * response payload the bot sends back (for immediate in-ack responses).
 */
export async function enqueueSocketModeSlashCommand(
  appId: string,
  envelopeId: string,
  payload: Record<string, unknown>
): Promise<{ acked: boolean; responsePayload?: unknown }> {
  const ws = _connections.get(appId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return { acked: false };

  const envelope = {
    envelope_id: envelopeId,
    type: 'slash_commands',
    payload,
    accepts_response_payload: true,
  };

  ws.send(JSON.stringify(envelope));

  return new Promise<{ acked: boolean; responsePayload?: unknown }>(
    (resolve) => {
      const timer = setTimeout(() => {
        _pendingAcks.delete(envelopeId);
        resolve({ acked: false });
      }, ACK_TIMEOUT_MS);

      _pendingAcks.set(envelopeId, (result) => {
        clearTimeout(timer);
        resolve(result);
      });
    }
  );
}
