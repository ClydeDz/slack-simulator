import crypto from 'crypto';
import { getApps, getDb } from './db';
import type { App, LogEntry } from '../shared/types';

// ── In-memory log store ───────────────────────────────────────────────────────
const MAX_LOGS = 300;
const _logs: LogEntry[] = [];

export function getLogs(): LogEntry[] {
  return [..._logs].reverse();
}

function addLog(entry: LogEntry) {
  _logs.push(entry);
  if (_logs.length > MAX_LOGS) _logs.shift();
  // Lazy import to avoid circular dep with realtime.ts
  import('./realtime')
    .then(({ broadcast }) => {
      broadcast({ type: 'log_entry', entry });
    })
    .catch(() => {});
}

// ── Signing ───────────────────────────────────────────────────────────────────
function sign(signingSecret: string, timestamp: number, body: string): string {
  const base = `v0:${timestamp}:${body}`;
  return (
    'v0=' +
    crypto.createHmac('sha256', signingSecret).update(base).digest('hex')
  );
}

// ── HTTP dispatch with 3× exponential backoff ─────────────────────────────────
async function postWithRetry(
  url: string,
  body: string,
  headers: Record<string, string>,
  maxRetries = 3
): Promise<{ status: number; ok: boolean }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body });
      if (res.ok || res.status < 500) return { status: res.status, ok: res.ok };
    } catch (_) {
      /* network error — will retry */
    }
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return { status: 0, ok: false };
}

// ── Event ID generator ────────────────────────────────────────────────────────
let _evCounter = 0;
function makeEventId() {
  _evCounter = (_evCounter + 1) % 1000000;
  return `Ev${Date.now()}${String(_evCounter).padStart(6, '0')}`;
}

// ── Main dispatch entry point ─────────────────────────────────────────────────
/**
 * Build an Events API event_callback envelope and send it to all subscribed
 * apps via HTTP or Socket Mode depending on their configuration.
 */
export async function dispatchEvent(
  eventType: string,
  eventBody: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const ws = db.prepare('SELECT * FROM workspace LIMIT 1').get() as
    | { id: string; name: string }
    | undefined;
  const teamId = ws?.id ?? 'W001';

  const apps = getApps();

  const subscribedApps = apps.filter(
    (app) =>
      app.subscribedEvents?.includes(eventType) ||
      app.subscribedEvents?.includes('*')
  );

  await Promise.all(
    subscribedApps.map(async (app) => {
      const eventId = makeEventId();
      const eventTime = Math.floor(Date.now() / 1000);

      const envelope = {
        token: app.signingSecret,
        team_id: teamId,
        api_app_id: app.id,
        event: {
          ...eventBody,
          type: eventType,
          team: teamId,
          event_ts: String(eventBody.event_ts ?? eventBody.ts ?? eventTime),
        },
        type: 'event_callback',
        event_id: eventId,
        event_time: eventTime,
        authorizations: [
          {
            enterprise_id: null,
            team_id: teamId,
            user_id: app.botUserId,
            is_bot: true,
            is_enterprise_install: false,
          },
        ],
      };

      const logBase: Omit<
        LogEntry,
        'transport' | 'status' | 'durationMs' | 'error'
      > = {
        id: eventId,
        ts: Date.now(),
        appId: app.id,
        appName: app.name,
        direction: 'outbound',
        eventType,
        payload: envelope,
      };

      if (app.socketModeEnabled) {
        const { enqueueSocketModeEvent } = await import('./socketModeServer');
        const acked = await enqueueSocketModeEvent(app.id, eventId, envelope);
        addLog({
          ...logBase,
          transport: 'socket_mode',
          status: acked ? 200 : 0,
          error: acked ? undefined : 'no_ack',
        });
      } else if (app.requestUrl) {
        const timestamp = Math.floor(Date.now() / 1000);
        const body = JSON.stringify(envelope);
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Slack-Signature': sign(app.signingSecret, timestamp, body),
          'X-Slack-Request-Timestamp': String(timestamp),
          'X-Slack-Retry-Num': '0',
          'X-Slack-Retry-Reason': 'none',
        };
        const start = Date.now();
        const { status, ok } = await postWithRetry(
          app.requestUrl,
          body,
          headers
        );
        addLog({
          ...logBase,
          transport: 'http',
          status,
          durationMs: Date.now() - start,
          error: ok ? undefined : `HTTP ${status || 'network_error'}`,
        });
      }
    })
  );
}

/**
 * Dispatch an event to a single specific app (used for link_shared where each
 * app only receives links for its own registered domains).
 */
export async function dispatchEventToApp(
  app: App,
  eventType: string,
  eventBody: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const ws = db.prepare('SELECT * FROM workspace LIMIT 1').get() as
    | { id: string; name: string }
    | undefined;
  const teamId = ws?.id ?? 'W001';

  const eventId = makeEventId();
  const eventTime = Math.floor(Date.now() / 1000);

  const envelope = {
    token: app.signingSecret,
    team_id: teamId,
    api_app_id: app.id,
    event: {
      ...eventBody,
      type: eventType,
      team: teamId,
      event_ts: String(eventBody.event_ts ?? eventBody.ts ?? eventTime),
    },
    type: 'event_callback',
    event_id: eventId,
    event_time: eventTime,
    authorizations: [
      {
        enterprise_id: null,
        team_id: teamId,
        user_id: app.botUserId,
        is_bot: true,
        is_enterprise_install: false,
      },
    ],
  };

  const logBase: Omit<
    LogEntry,
    'transport' | 'status' | 'durationMs' | 'error'
  > = {
    id: eventId,
    ts: Date.now(),
    appId: app.id,
    appName: app.name,
    direction: 'outbound',
    eventType,
    payload: envelope,
  };

  if (app.socketModeEnabled) {
    const { enqueueSocketModeEvent } = await import('./socketModeServer');
    const acked = await enqueueSocketModeEvent(app.id, eventId, envelope);
    addLog({
      ...logBase,
      transport: 'socket_mode',
      status: acked ? 200 : 0,
      error: acked ? undefined : 'no_ack',
    });
  } else if (app.requestUrl) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(envelope);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Slack-Signature': sign(app.signingSecret, timestamp, body),
      'X-Slack-Request-Timestamp': String(timestamp),
      'X-Slack-Retry-Num': '0',
      'X-Slack-Retry-Reason': 'none',
    };
    const start = Date.now();
    const { status, ok } = await postWithRetry(app.requestUrl, body, headers);
    addLog({
      ...logBase,
      transport: 'http',
      status,
      durationMs: Date.now() - start,
      error: ok ? undefined : `HTTP ${status || 'network_error'}`,
    });
  }
}

// ── Inbound API call logging (bot → simulator) ────────────────────────────────
export function logInbound(
  appId: string,
  appName: string,
  method: string,
  payload: unknown,
  status: number
) {
  addLog({
    id: `in_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    appId,
    appName,
    direction: 'inbound',
    eventType: method,
    transport: 'api',
    status,
    payload,
  });
}
