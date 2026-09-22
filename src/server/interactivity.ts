import crypto from 'crypto';
import type { App, ModalView } from '../shared/types';
import { broadcast } from './realtime';

// ── trigger_id store (5-minute TTL) ──────────────────────────────────────────
const TRIGGER_TTL = 5 * 60 * 1000;

interface TriggerEntry {
  appId: string;
  expiresAt: number;
}
const _triggers = new Map<string, TriggerEntry>();

export function issueTrigger(appId: string): string {
  const triggerId = `${Date.now()}.${appId}.${crypto.randomBytes(8).toString('hex')}`;
  _triggers.set(triggerId, { appId, expiresAt: Date.now() + TRIGGER_TTL });
  return triggerId;
}

export function redeemTrigger(triggerId: string): string | null {
  const entry = _triggers.get(triggerId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _triggers.delete(triggerId);
    return null;
  }
  _triggers.delete(triggerId);
  return entry.appId;
}

// ── Modal store (viewId → { view, appId }) ────────────────────────────────────
interface ModalEntry {
  view: ModalView;
  appId: string;
}
const _modals = new Map<string, ModalEntry>();

export function storeModal(view: ModalView, appId: string): void {
  _modals.set(view.id, { view, appId });
}

export function getModal(viewId: string): ModalEntry | undefined {
  return _modals.get(viewId);
}

export function deleteModal(viewId: string): void {
  _modals.delete(viewId);
}

// ── Signing ───────────────────────────────────────────────────────────────────
function sign(signingSecret: string, timestamp: number, body: string): string {
  const base = `v0:${timestamp}:${body}`;
  return (
    'v0=' +
    crypto.createHmac('sha256', signingSecret).update(base).digest('hex')
  );
}

// ── HTTP dispatch helper ──────────────────────────────────────────────────────
async function postToApp(app: App, payload: unknown): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ payload: JSON.stringify(payload) });
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Slack-Signature': sign(app.signingSecret, timestamp, body),
    'X-Slack-Request-Timestamp': String(timestamp),
  };
  try {
    const res = await fetch(app.requestUrl, { method: 'POST', headers, body });
    if (res.ok) {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) return res.json();
    }
  } catch (_) {
    /* bot offline */
  }
  return null;
}

// ── block_actions dispatch ────────────────────────────────────────────────────
export async function dispatchBlockActions(params: {
  app: App;
  // message context (mutually exclusive with view context)
  channelId?: string;
  messageTs?: string;
  messageBlocks?: unknown[]; // blocks from the source message — included in the payload for the bot
  // view/modal context (mutually exclusive with message context)
  viewId?: string;
  viewCallbackId?: string;
  // common
  blockId: string;
  actionId: string;
  value?: string;
  userId: string;
  username?: string; // display name of the acting user
  teamId: string;
  selectedOption?: { text: { type: string; text: string }; value: string };
}): Promise<void> {
  const triggerId = issueTrigger(params.app.id);

  const action: Record<string, unknown> = {
    block_id: params.blockId,
    action_id: params.actionId,
    action_ts: String(Date.now() / 1000),
  };

  if (params.selectedOption) {
    action.type = 'static_select';
    action.selected_option = params.selectedOption;
  } else {
    action.type = 'button';
    action.value = params.value ?? '';
  }

  // Build context fields: modal view OR message channel
  const contextFields: Record<string, unknown> = params.viewId
    ? {
        view: {
          id: params.viewId,
          type: 'modal',
          callback_id: params.viewCallbackId ?? '',
        },
      }
    : {
        container: {
          type: 'message',
          message_ts: params.messageTs,
          channel_id: params.channelId,
        },
        channel: { id: params.channelId },
        message: {
          ts: params.messageTs,
          ...(params.messageBlocks ? { blocks: params.messageBlocks } : {}),
        },
      };

  const payload = {
    type: 'block_actions',
    trigger_id: triggerId,
    team: { id: params.teamId, domain: 'slacksim' },
    user: { id: params.userId, name: params.username ?? params.userId },
    api_app_id: params.app.id,
    token: params.app.signingSecret,
    ...contextFields,
    actions: [action],
  };

  if (params.app.socketModeEnabled) {
    const { enqueueSocketModeInteractive } = await import('./socketModeServer');
    const envelopeId = `Ev${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    await enqueueSocketModeInteractive(params.app.id, envelopeId, payload);
  } else if (params.app.requestUrl) {
    await postToApp(params.app, payload);
  }
}

// ── view_submission dispatch ──────────────────────────────────────────────────
export async function dispatchViewSubmission(params: {
  app: App;
  view: ModalView;
  userId: string;
  teamId: string;
  values: Record<string, Record<string, { type: string; value: string }>>;
}): Promise<{ response_action?: string; view?: unknown } | null> {
  const payload = {
    type: 'view_submission',
    team: { id: params.teamId, domain: 'slacksim' },
    user: { id: params.userId },
    api_app_id: params.app.id,
    token: params.app.signingSecret,
    view: {
      id: params.view.id,
      type: 'modal',
      callback_id: params.view.callback_id ?? '',
      private_metadata: params.view.private_metadata ?? '',
      title: params.view.title,
      submit: params.view.submit,
      close: params.view.close,
      blocks: params.view.blocks,
      state: { values: params.values },
    },
  };

  if (params.app.socketModeEnabled) {
    const { enqueueSocketModeInteractive } = await import('./socketModeServer');
    const envelopeId = `Ev${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const result = await enqueueSocketModeInteractive(
      params.app.id,
      envelopeId,
      payload
    );
    return result.responsePayload as {
      response_action?: string;
      view?: unknown;
    } | null;
  } else if (params.app.requestUrl) {
    const res = await postToApp(params.app, payload);
    return res as { response_action?: string; view?: unknown } | null;
  }
  return null;
}

// ── view_closed dispatch ──────────────────────────────────────────────────────
export async function dispatchViewClosed(params: {
  app: App;
  view: ModalView;
  userId: string;
  teamId: string;
}): Promise<void> {
  const payload = {
    type: 'view_closed',
    team: { id: params.teamId, domain: 'slacksim' },
    user: { id: params.userId },
    api_app_id: params.app.id,
    token: params.app.signingSecret,
    view: {
      id: params.view.id,
      type: 'modal',
      callback_id: params.view.callback_id ?? '',
      private_metadata: params.view.private_metadata ?? '',
      title: params.view.title,
      blocks: params.view.blocks,
    },
    is_cleared: false,
  };

  if (params.app.socketModeEnabled) {
    const { enqueueSocketModeInteractive } = await import('./socketModeServer');
    const envelopeId = `Ev${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    await enqueueSocketModeInteractive(params.app.id, envelopeId, payload);
  } else if (params.app.requestUrl) {
    await postToApp(params.app, payload);
  }
}

// ── views.open ────────────────────────────────────────────────────────────────
export function openModal(
  rawView: Record<string, unknown>,
  appId: string
): ModalView {
  const viewId = `V${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const view: ModalView = {
    id: viewId,
    type: 'modal',
    title: rawView.title as ModalView['title'],
    submit: rawView.submit as ModalView['submit'] | undefined,
    close: rawView.close as ModalView['close'] | undefined,
    blocks: (rawView.blocks as ModalView['blocks']) ?? [],
    callback_id: rawView.callback_id as string | undefined,
    private_metadata: rawView.private_metadata as string | undefined,
    notify_on_close: rawView.notify_on_close as boolean | undefined,
  };
  storeModal(view, appId);
  broadcast({ type: 'modal_open', view, appId });
  return view;
}

// ── views.update ──────────────────────────────────────────────────────────────
export function updateModal(
  viewId: string,
  rawView: Record<string, unknown>
): ModalView | null {
  const entry = _modals.get(viewId);
  if (!entry) return null;
  const view: ModalView = {
    id: viewId,
    type: 'modal',
    title: rawView.title as ModalView['title'],
    submit: rawView.submit as ModalView['submit'] | undefined,
    close: rawView.close as ModalView['close'] | undefined,
    blocks: (rawView.blocks as ModalView['blocks']) ?? [],
    callback_id: rawView.callback_id as string | undefined,
    private_metadata: rawView.private_metadata as string | undefined,
    notify_on_close: rawView.notify_on_close as boolean | undefined,
  };
  _modals.set(viewId, { view, appId: entry.appId });
  broadcast({ type: 'modal_update', view });
  return view;
}

// ── views.push ────────────────────────────────────────────────────────────────
export function pushModal(
  rawView: Record<string, unknown>,
  appId: string
): ModalView {
  const viewId = `V${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const view: ModalView = {
    id: viewId,
    type: 'modal',
    title: rawView.title as ModalView['title'],
    submit: rawView.submit as ModalView['submit'] | undefined,
    close: rawView.close as ModalView['close'] | undefined,
    blocks: (rawView.blocks as ModalView['blocks']) ?? [],
    callback_id: rawView.callback_id as string | undefined,
    private_metadata: rawView.private_metadata as string | undefined,
    notify_on_close: rawView.notify_on_close as boolean | undefined,
  };
  storeModal(view, appId);
  broadcast({ type: 'modal_push', view, appId });
  return view;
}
