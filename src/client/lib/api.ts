// All control-plane calls include the acting user header.
// actingUserId is read from the store at call time.

import { useStore } from '../store'

function getActingUserId(): string {
  return useStore.getState().actingUserId
}

export async function controlFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-Slacksim-Acting-User': getActingUserId(),
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) errMsg = body.error
    } catch { /* ignore parse errors */ }
    throw new Error(errMsg)
  }
  return res.json()
}

export const controlApi = {
  getChannelMessages: (channelId: string) =>
    controlFetch(`/_control/channels/${channelId}/messages`),

  postMessage: (channelId: string, text: string, threadTs?: string) =>
    controlFetch('/_control/messages', {
      method: 'POST',
      body: JSON.stringify({ channelId, text, threadTs }),
    }),

  toggleReaction: (messageId: string, name: string) =>
    controlFetch(`/_control/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  pinMessage: (messageId: string, pinned: boolean) =>
    controlFetch(`/_control/messages/${messageId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pinned }),
    }),

  createChannel: (name: string, memberIds: string[], isPrivate: boolean) =>
    controlFetch('/_control/channels', {
      method: 'POST',
      body: JSON.stringify({ name, type: isPrivate ? 'private' : 'public', memberIds }),
    }),

  addAppToChannel: (channelId: string, appId: string) =>
    controlFetch(`/_control/channels/${channelId}/apps`, {
      method: 'POST',
      body: JSON.stringify({ appId }),
    }),

  joinChannel: (channelId: string) =>
    controlFetch(`/_control/channels/${channelId}/join`, { method: 'POST', body: '{}' }),

  leaveChannel: (channelId: string) =>
    controlFetch(`/_control/channels/${channelId}/leave`, { method: 'POST', body: '{}' }),

  archiveChannel: (channelId: string) =>
    controlFetch(`/_control/channels/${channelId}/archive`, { method: 'POST', body: '{}' }),

  resetWorkspace: () =>
    controlFetch('/_control/workspace/reset', { method: 'POST', body: JSON.stringify({}) }),

  getLogs: () =>
    controlFetch('/_control/logs'),

  postSlashCommand: (channelId: string, command: string, text: string) =>
    controlFetch('/_control/slash_command', {
      method: 'POST',
      body: JSON.stringify({ channelId, command, text }),
    }),

  postModalBlockAction: (
    viewId: string,
    blockId: string,
    actionId: string,
    value: string | undefined,
    appId: string,
    selectedOption?: { text: { type: string; text: string }; value: string },
  ) =>
    controlFetch('/_control/modal_block_action', {
      method: 'POST',
      body: JSON.stringify({ viewId, blockId, actionId, value, appId, selectedOption }),
    }),

  postBlockAction: (
    channelId: string,
    messageTs: string,
    blockId: string,
    actionId: string,
    value: string | undefined,
    appId: string,
    selectedOption?: { text: { type: string; text: string }; value: string },
  ) =>
    controlFetch('/_control/block_action', {
      method: 'POST',
      body: JSON.stringify({ channelId, messageTs, blockId, actionId, value, appId, selectedOption }),
    }),

  submitView: (
    viewId: string,
    values: Record<string, Record<string, { type: string; value: string }>>,
  ) =>
    controlFetch('/_control/view_submit', {
      method: 'POST',
      body: JSON.stringify({ viewId, values }),
    }),

  closeView: (viewId: string) =>
    controlFetch('/_control/view_close', {
      method: 'POST',
      body: JSON.stringify({ viewId }),
    }),

  openDm: (botUserId: string) =>
    controlFetch('/_control/dm', {
      method: 'POST',
      body: JSON.stringify({ botUserId }),
    }),

  updateApp: (id: string, fields: { requestUrl?: string; socketModeEnabled?: boolean; subscribedEvents?: string[] }) =>
    controlFetch(`/_control/apps/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),

  getDbTables: () =>
    controlFetch('/_control/db/tables'),

  getDbTableRows: (name: string, params: { limit?: number; offset?: number; orderBy?: string; order?: 'asc' | 'desc' }) => {
    const q = new URLSearchParams()
    if (params.limit !== undefined) q.set('limit', String(params.limit))
    if (params.offset !== undefined) q.set('offset', String(params.offset))
    if (params.orderBy) q.set('orderBy', params.orderBy)
    if (params.order) q.set('order', params.order)
    return controlFetch(`/_control/db/tables/${encodeURIComponent(name)}?${q}`)
  },
}
