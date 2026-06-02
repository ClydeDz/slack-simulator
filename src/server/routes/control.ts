import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import {
  getDb, getAllUsers, getChannel, getChannelMessages, getThreadMessages,
  insertMessage, toggleReaction, getApps, getMessageByTs,
  generateTs, generateId, updateApp, setPinned, setMessageUnfurls,
} from '../db'
import { broadcast } from '../realtime'
import { resetDatabase } from '../seed'
import { dispatchEvent, dispatchEventToApp, getLogs } from '../dispatcher'
import { dispatchSlashCommand } from '../slashCommands'
import { dispatchBlockActions, dispatchViewSubmission, dispatchViewClosed, getModal, deleteModal, pushModal, updateModal } from '../interactivity'
import type { Channel, Message } from '../../shared/types'
import { SIMULATOR_BASE_URL } from '../index'

function getActingUserId(req: FastifyRequest): string {
  return (req.headers['x-slacksim-acting-user'] as string) || 'U001'
}

// ── Link unfurling helpers ────────────────────────────────────────────────────

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"]+/g) ?? []
  return [...new Set(matches)]
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

async function scrapeOgPreview(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SlackSimulator/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const get = (prop: string) =>
      html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, 'i'))?.[1] ??
      html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`, 'i'))?.[1]
    const title = get('og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
    const description = get('og:description') ??
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] ??
      html.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i)?.[1]
    const image = get('og:image')
    if (!title && !description) return null
    return { title, title_link: url, text: description, image_url: image }
  } catch {
    return null
  }
}

async function processUnfurls(
  channelId: string,
  ts: string,
  messageId: string,
  userId: string,
  text: string
): Promise<void> {
  const urls = extractUrls(text)
  if (urls.length === 0) return

  const apps = getApps()
  const unclaimedUrls: string[] = []

  // Group URLs by owning app (first app whose unfurlDomains matches wins)
  const appLinks: Map<string, { domain: string; url: string }[]> = new Map()

  for (const url of urls) {
    const domain = extractDomain(url)
    const owningApp = apps.find(a =>
      a.subscribedEvents.includes('link_shared') &&
      a.unfurlDomains.some(d => domain === d || domain.endsWith('.' + d))
    )
    if (owningApp) {
      if (!appLinks.has(owningApp.id)) appLinks.set(owningApp.id, [])
      appLinks.get(owningApp.id)!.push({ domain, url })
    } else {
      unclaimedUrls.push(url)
    }
  }

  // Dispatch link_shared per owning app
  for (const [appId, links] of appLinks) {
    const owningApp = apps.find(a => a.id === appId)!
    dispatchEventToApp(owningApp, 'link_shared', {
      channel: channelId,
      user: userId,
      message_ts: ts,
      event_ts: ts,
      links,
    }).catch(() => {})
  }

  // OG scrape unclaimed URLs
  if (unclaimedUrls.length > 0) {
    const unfurls: Record<string, unknown> = {}
    await Promise.all(unclaimedUrls.map(async url => {
      const preview = await scrapeOgPreview(url)
      if (preview) unfurls[url] = preview
    }))
    if (Object.keys(unfurls).length > 0) {
      const updated = setMessageUnfurls(channelId, ts, unfurls)
      if (updated) broadcast({ type: 'message_updated', message: updated })
    }
  }
}

export async function registerControl(app: FastifyInstance): Promise<void> {
  // GET /_control/workspace
  app.get('/_control/workspace', async (_req, reply) => {
    const db = getDb()
    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as
      { id: string; name: string; domain: string; avatar_url: string | null; emoji_set: string | null } | undefined

    const workspace = wsRow
      ? { id: wsRow.id, name: wsRow.name, domain: wsRow.domain, avatarUrl: wsRow.avatar_url ?? undefined, emojiMap: wsRow.emoji_set ? JSON.parse(wsRow.emoji_set) : {} }
      : { id: 'W001', name: 'Slack Simulator', domain: 'slacksim', emojiMap: {} }
    const users = getAllUsers()

    const channelRows = db.prepare('SELECT * FROM channels').all() as
      Array<{ id: string; name: string | null; type: string; archived: number }>
    const channels: Channel[] = channelRows.map(c => {
      const members = (db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?').all(c.id) as
        Array<{ user_id: string }>).map(r => r.user_id)
      return {
        id: c.id,
        name: c.name ?? '',
        type: c.type as Channel['type'],
        archived: c.archived === 1,
        members,
      }
    })

    const apps = getApps()

    return reply.send({ workspace, users, channels, apps })
  })

  // POST /_control/workspace/reset
  app.post('/_control/workspace/reset', async (_req, reply) => {
    await resetDatabase()
    broadcast({ type: 'workspace_reset' })
    return reply.send({ ok: true })
  })

  // GET /_control/channels
  app.get('/_control/channels', async (_req, reply) => {
    const db = getDb()
    const channelRows = db.prepare('SELECT * FROM channels').all() as
      Array<{ id: string; name: string | null; type: string; archived: number }>
    const channels: Channel[] = channelRows.map(c => {
      const members = (db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?').all(c.id) as
        Array<{ user_id: string }>).map(r => r.user_id)
      return {
        id: c.id,
        name: c.name ?? '',
        type: c.type as Channel['type'],
        archived: c.archived === 1,
        members,
      }
    })
    return reply.send(channels)
  })

  // POST /_control/channels/:id/archive
  app.post('/_control/channels/:id/archive', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { id } = req.params as { id: string }
    const db = getDb()
    const current = getChannel(id)
    const isArchiving = !current?.archived
    const newState = isArchiving ? 1 : 0
    db.prepare('UPDATE channels SET archived = ? WHERE id = ?').run(newState, id)
    const channel = getChannel(id)
    if (channel) broadcast({ type: 'channel_updated', channel })

    // Post a system message
    const subtype = isArchiving ? 'channel_archive' : 'channel_unarchive'
    const text = isArchiving ? 'archived this channel' : 'unarchived this channel'
    const ts = generateTs()
    const msgId = generateId('M')
    const message = insertMessage({ id: msgId, channelId: id, userId: actingUserId, text, ts, subtype })
    broadcast({ type: 'message_new', message })

    // Dispatch Slack event
    dispatchEvent(isArchiving ? 'channel_archive' : 'channel_unarchive', {
      channel: id,
      user: actingUserId,
      event_ts: ts,
      ...(isArchiving ? {} : { is_moved: 0 }),
    }).catch(() => {})

    return reply.send({ ok: true })
  })

  // POST /_control/dm — find or create a DM between the acting user and a bot
  app.post('/_control/dm', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { botUserId } = req.body as { botUserId: string }
    if (!botUserId) return reply.status(400).send({ error: 'botUserId required' })

    const db = getDb()
    const memberSet = [actingUserId, botUserId].sort()

    // Find existing DM with exactly these two members
    const existingIms = db.prepare('SELECT id FROM channels WHERE type = ?').all('im') as Array<{ id: string }>
    for (const im of existingIms) {
      const members = (db.prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
        .all(im.id) as Array<{ user_id: string }>).map(r => r.user_id).sort()
      if (members.join(',') === memberSet.join(',')) {
        return reply.send(getChannel(im.id))
      }
    }

    // Create new DM
    const id = generateId('D')
    db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(id, null, 'im')
    for (const uid of memberSet) {
      db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(id, uid)
    }
    const channel = getChannel(id)!
    broadcast({ type: 'channel_created', channel })
    return reply.send(channel)
  })

  // GET /_control/channels/:id/messages
  app.get('/_control/channels/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { messages } = getChannelMessages(id, 100)
    return reply.send(messages)
  })

  // POST /_control/channels
  app.post('/_control/channels', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const db = getDb()
    const { name, type, memberIds } = req.body as {
      name: string; type?: string; memberIds?: string[]
    }

    if (!name) return reply.status(400).send({ error: 'name required' })

    const cleanName = name.toLowerCase().replace(/\s+/g, '-')
    const id = generateId('C')
    const channelType = type ?? 'public'

    db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(id, cleanName, channelType)

    const members = memberIds ?? []
    for (const uid of members) {
      db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(id, uid)
    }

    const channel = getChannel(id)!
    broadcast({ type: 'channel_created', channel })

    dispatchEvent('channel_created', {
      channel: {
        id,
        name: cleanName,
        created: Math.floor(Date.now() / 1000),
        creator: actingUserId,
      },
    }).catch(() => {})

    return reply.status(201).send(channel)
  })

  // POST /_control/channels/:id/join
  app.post('/_control/channels/:id/join', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { id } = req.params as { id: string }
    const db = getDb()

    db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(id, actingUserId)
    const channel = getChannel(id)
    if (!channel) return reply.status(404).send({ error: 'channel not found' })

    broadcast({ type: 'channel_updated', channel })

    // Post a system message
    const ts = generateTs()
    const msgId = generateId('M')
    const message = insertMessage({ id: msgId, channelId: id, userId: actingUserId, text: `joined #${channel.name}`, ts, subtype: 'channel_join' })
    broadcast({ type: 'message_new', message })

    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'

    const channelTypeCode = channel.type === 'im' ? 'D' : channel.type === 'private' ? 'G' : 'C'
    dispatchEvent('member_joined_channel', {
      user: actingUserId,
      channel: id,
      channel_type: channelTypeCode,
      team: teamId,
      inviter: actingUserId,
    }).catch(() => {})

    return reply.send({ ok: true, channel })
  })

  // POST /_control/channels/:id/leave
  app.post('/_control/channels/:id/leave', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { id } = req.params as { id: string }
    const db = getDb()

    db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(id, actingUserId)
    const channel = getChannel(id)
    if (!channel) return reply.status(404).send({ error: 'channel not found' })

    broadcast({ type: 'channel_updated', channel })

    // Post a system message
    const ts = generateTs()
    const msgId = generateId('M')
    const message = insertMessage({ id: msgId, channelId: id, userId: actingUserId, text: `left #${channel.name}`, ts, subtype: 'channel_leave' })
    broadcast({ type: 'message_new', message })

    return reply.send({ ok: true, channel })
  })

  // POST /_control/channels/:id/apps
  app.post('/_control/channels/:id/apps', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { appId } = req.body as { appId: string }

    // For now just acknowledge — app membership is conceptual
    return reply.send({ ok: true, channelId: id, appId })
  })

  // POST /_control/messages
  app.post('/_control/messages', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { channelId, text, threadTs } = req.body as {
      channelId: string; text: string; threadTs?: string
    }

    if (!channelId || !text) return reply.status(400).send({ error: 'channelId and text required' })

    const ts = generateTs()
    const id = generateId('M')
    const message = insertMessage({ id, channelId, userId: actingUserId, text, ts, threadTs })

    broadcast({ type: 'message_new', message })

    // Dispatch Events API
    const apps = getApps()
    const msgChannel = getChannel(channelId)
    const channelTypeCode = !msgChannel ? 'channel' : msgChannel.type === 'im' ? 'im' : msgChannel.type === 'private' ? 'group' : 'channel'

    // Resolve parent_user_id for thread replies
    let parentUserId: string | undefined
    if (threadTs) {
      const parentRow = getDb().prepare('SELECT user_id FROM messages WHERE channel_id = ? AND ts = ?').get(channelId, threadTs) as { user_id: string } | undefined
      parentUserId = parentRow?.user_id
    }

    const msgPayload: Record<string, unknown> = {
      channel: channelId,
      user: actingUserId,
      text,
      ts,
      event_ts: ts,
      channel_type: channelTypeCode,
      ...(threadTs ? { thread_ts: threadTs } : {}),
      ...(parentUserId ? { parent_user_id: parentUserId } : {}),
      ...(message.blocks?.length ? { blocks: message.blocks } : {}),
    }

    dispatchEvent('message', msgPayload).catch(() => {})

    // app_mention: if any bot's @handle appears in the text
    for (const app of apps) {
      if (text.includes(`@${app.botUserName}`) || text.includes(`<@${app.botUserId}>`)) {
        dispatchEvent('app_mention', {
          ...msgPayload,
          type: undefined, // dispatcher sets type
        }).catch(() => {})
        break
      }
    }

    // ── Link unfurling ────────────────────────────────────────────
    processUnfurls(channelId, ts, message.id, actingUserId, text).catch(() => {})

    return reply.status(201).send(message)
  })

  // POST /_control/messages/:id/reactions
  app.post('/_control/messages/:id/reactions', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { id: messageId } = req.params as { id: string }
    const { name } = req.body as { name: string }

    if (!name) return reply.status(400).send({ error: 'name required' })

    // Find the message by ID
    const db = getDb()
    const msgRow = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as
      { id: string; channel_id: string; user_id: string; text: string; ts: string; thread_ts: string | null } | undefined

    if (!msgRow) return reply.status(404).send({ error: 'message not found' })

    const reactionAction = toggleReaction(messageId, name, actingUserId)

    // Fetch updated reactions
    const updatedMsg = getMessageByTs(msgRow.channel_id, msgRow.ts)!
    broadcast({
      type: 'reaction_updated',
      ts: msgRow.ts,
      channelId: msgRow.channel_id,
      reactions: updatedMsg.reactions,
    })

    // Dispatch reaction event
    const eventType = reactionAction === 'added' ? 'reaction_added' : 'reaction_removed'
    const reactionEventTs = generateTs()
    dispatchEvent(eventType, {
      user: actingUserId,
      reaction: name,
      item_user: msgRow.user_id,
      item: { type: 'message', channel: msgRow.channel_id, ts: msgRow.ts },
      event_ts: reactionEventTs,
    }).catch(() => {})

    return reply.send({ ok: true, reactions: updatedMsg.reactions })
  })

  // POST /_control/messages/:id/pin — toggle pin state
  app.post('/_control/messages/:id/pin', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { id: messageId } = req.params as { id: string }
    const { pinned } = req.body as { pinned: boolean }

    const db = getDb()
    const msgRow = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as
      { id: string; channel_id: string; user_id: string; text: string; ts: string } | undefined
    if (!msgRow) return reply.status(404).send({ error: 'message not found' })

    const updated = setPinned(messageId, pinned)
    if (!updated) return reply.status(500).send({ error: 'update failed' })

    broadcast({ type: 'message_updated', message: updated })

    const wsRow = db.prepare('SELECT id FROM workspace LIMIT 1').get() as { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'
    const pinTs = Math.floor(Date.now() / 1000)
    const pinCount = (db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE channel_id = ? AND pinned = 1').get(msgRow.channel_id) as { cnt: number }).cnt
    const permalink = `${SIMULATOR_BASE_URL}/archives/${msgRow.channel_id}/p${msgRow.ts.replace('.', '')}`

    const sharedPinPayload = {
      user: actingUserId,
      channel_id: msgRow.channel_id,
      item: {
        type: 'message',
        channel: msgRow.channel_id,
        message: {
          type: 'message',
          user: msgRow.user_id,
          text: msgRow.text,
          ts: msgRow.ts,
          team: teamId,
          permalink,
        },
        created: pinTs,
        created_by: actingUserId,
      },
      pin_count: pinCount,
      event_ts: String(pinTs),
    }

    const eventType = pinned ? 'pin_added' : 'pin_removed'
    dispatchEvent(eventType, pinned
      ? {
          ...sharedPinPayload,
          pinned_info: {
            channel: msgRow.channel_id,
            pinned_by: actingUserId,
            pinned_ts: pinTs,
          },
        }
      : {
          ...sharedPinPayload,
          has_pins: pinCount > 0,
        }
    ).catch(() => {})

    return reply.send({ ok: true, pinned })
  })

  // GET /_control/apps
  app.get('/_control/apps', async (_req, reply) => {
    const apps = getApps()
    return reply.send(apps)
  })

  // PATCH /_control/apps/:id — update app config
  app.patch('/_control/apps/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { requestUrl, socketModeEnabled, subscribedEvents } = req.body as {
      requestUrl?: string
      socketModeEnabled?: boolean
      subscribedEvents?: string[]
    }
    updateApp(id, { requestUrl, socketModeEnabled, subscribedEvents })
    const apps = getApps()
    const updated = apps.find(a => a.id === id)
    if (!updated) return reply.status(404).send({ error: 'app not found' })
    return reply.send(updated)
  })

  // ── Resolve @username → <@userId> in slash command text ─────────
  function resolveMentionsInText(raw: string): string {
    const db = getDb()
    // Resolve @username → <@userId>
    let resolved = raw.replace(/@(\w+)/g, (match, username) => {
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined
      if (user) return `<@${user.id}>`
      const bot = db.prepare('SELECT bot_user_id FROM apps WHERE bot_user_name = ?').get(username) as { bot_user_id: string } | undefined
      if (bot) return `<@${bot.bot_user_id}>`
      return match
    })
    // Resolve #channelname → <#channelId>
    resolved = resolved.replace(/#([\w-]+)/g, (match, name) => {
      const channel = db.prepare('SELECT id FROM channels WHERE name = ?').get(name) as { id: string } | undefined
      if (channel) return `<#${channel.id}>`
      return match
    })
    return resolved
  }

  // POST /_control/slash_command
  app.post('/_control/slash_command', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { channelId, command, text } = req.body as { channelId: string; command: string; text?: string }

    if (!channelId || !command) return reply.status(400).send({ error: 'channelId and command required' })

    const apps = getApps()
    const owningApp = apps.find(a => a.slashCommands.some(sc => sc.command === command))
    if (!owningApp) return reply.status(404).send({ error: 'no app registered for this command' })

    const channel = getChannel(channelId)
    const channelName = channel?.name ?? 'unknown'

    const db = getDb()
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(actingUserId) as
      { id: string; username: string; full_name: string } | undefined
    const username = userRow?.username ?? actingUserId

    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as
      { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'

    await dispatchSlashCommand({
      app: owningApp,
      command,
      text: resolveMentionsInText(text ?? ''),
      channelId,
      channelName,
      userId: actingUserId,
      username,
      teamId,
    })

    return reply.send({ ok: true })
  })

  // POST /_control/block_action
  app.post('/_control/block_action', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { channelId, messageTs, blockId, actionId, value, appId: bodyAppId, selectedOption } = req.body as {
      channelId: string; messageTs: string; blockId: string; actionId: string; value?: string; appId?: string
      selectedOption?: { text: { type: string; text: string }; value: string }
    }

    if (!channelId || !messageTs || !actionId) {
      return reply.status(400).send({ error: 'missing required fields' })
    }

    const db = getDb()

    // Resolve appId: prefer the value stored on the message (set when the bot called chat.postMessage),
    // fall back to whatever the frontend supplied for backward-compat,
    // final fallback: look up app by the message author's bot user ID.
    const msgRecord = getMessageByTs(channelId, messageTs)

    console.log('[block_action] lookup:', { channelId, messageTs, msgAppId: msgRecord?.appId ?? null, bodyAppId: bodyAppId ?? null, msgUser: msgRecord?.user ?? null })

    let resolvedAppId = msgRecord?.appId || bodyAppId

    // Final fallback: derive app from the message author (works for any bot message)
    if (!resolvedAppId && msgRecord) {
      const apps2 = getApps()
      const appByAuthor = apps2.find(a => a.botUserId === msgRecord.user)
      resolvedAppId = appByAuthor?.id
      if (resolvedAppId) console.log('[block_action] resolved appId from message author:', resolvedAppId)
    }

    if (!resolvedAppId) return reply.status(400).send({ error: `cannot determine app — msg ${msgRecord ? `found (user=${msgRecord.user}, no app_id)` : 'not found'}, bodyAppId=${bodyAppId || '(empty)'}` })

    const apps = getApps()
    const blockApp = apps.find(a => a.id === resolvedAppId)
    if (!blockApp) return reply.status(404).send({ error: 'app not found' })

    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'

    const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(actingUserId) as { username: string } | undefined
    const username = userRow?.username ?? actingUserId

    await dispatchBlockActions({
      app: blockApp,
      channelId,
      messageTs,
      messageBlocks: msgRecord?.blocks,
      blockId,
      actionId,
      value,
      userId: actingUserId,
      username,
      teamId,
      selectedOption,
    })

    return reply.send({ ok: true })
  })

  // POST /_control/modal_block_action — block_actions fired from inside a modal
  app.post('/_control/modal_block_action', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { viewId, blockId, actionId, value, appId, selectedOption } = req.body as {
      viewId: string; blockId: string; actionId: string; value?: string; appId: string
      selectedOption?: { text: { type: string; text: string }; value: string }
    }

    if (!viewId || !blockId || !actionId || !appId) {
      return reply.status(400).send({ error: 'missing required fields' })
    }

    const apps = getApps()
    const app = apps.find(a => a.id === appId)
    if (!app) return reply.status(404).send({ error: 'app not found' })

    // Look up the view's callback_id from the modal store
    const entry = getModal(viewId)
    const viewCallbackId = entry?.view.callback_id ?? ''

    const db = getDb()
    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'

    await dispatchBlockActions({
      app, viewId, viewCallbackId, blockId, actionId, value,
      userId: actingUserId, teamId, selectedOption,
    })

    return reply.send({ ok: true })
  })

  // POST /_control/view_submit
  app.post('/_control/view_submit', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { viewId, values } = req.body as {
      viewId: string
      values: Record<string, Record<string, { type: string; value: string }>>
    }

    if (!viewId) return reply.status(400).send({ error: 'viewId required' })

    const entry = getModal(viewId)
    if (!entry) return reply.status(404).send({ error: 'modal not found' })

    const apps = getApps()
    const app = apps.find(a => a.id === entry.appId)
    if (!app) return reply.status(404).send({ error: 'app not found' })

    const db = getDb()
    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'

    const result = await dispatchViewSubmission({
      app,
      view: entry.view,
      userId: actingUserId,
      teamId,
      values: values ?? {},
    })

    // Handle response_action from bot
    if (result?.response_action === 'errors') {
      return reply.send({ ok: true, errors: (result as Record<string, unknown>).errors ?? {} })
    }

    if (result?.response_action === 'push' && result.view) {
      const rawPushView = result.view as Record<string, unknown>
      pushModal(rawPushView, entry.appId)
      // Keep current modal open — the client should not close it
      return reply.send({ ok: true, keepOpen: true })
    }

    if (result?.response_action === 'update' && result.view) {
      const rawUpdateView = result.view as Record<string, unknown>
      updateModal(viewId, rawUpdateView)
      // Keep current modal open with updated content
      return reply.send({ ok: true, keepOpen: true })
    }

    deleteModal(viewId)
    return reply.send({ ok: true })
  })

  // POST /_control/view_close
  app.post('/_control/view_close', async (req, reply) => {
    const actingUserId = getActingUserId(req)
    const { viewId } = req.body as { viewId: string }

    if (!viewId) return reply.status(400).send({ error: 'viewId required' })

    const entry = getModal(viewId)
    if (!entry) {
      // Already gone — still OK
      return reply.send({ ok: true })
    }

    const apps = getApps()
    const app = apps.find(a => a.id === entry.appId)

    const db = getDb()
    const wsRow = db.prepare('SELECT * FROM workspace LIMIT 1').get() as { id: string } | undefined
    const teamId = wsRow?.id ?? 'W001'

    if (app) {
      await dispatchViewClosed({ app, view: entry.view, userId: actingUserId, teamId })
    }

    deleteModal(viewId)
    return reply.send({ ok: true })
  })

  // GET /_control/logs
  app.get('/_control/logs', async (_req, reply) => {
    return reply.send(getLogs())
  })

  // ── Database inspector (read-only) ────────────────────────────

  // GET /_control/db/tables
  app.get('/_control/db/tables', async (_req, reply) => {
    const Database = (await import('better-sqlite3')).default
    const path = (await import('path')).default
    const dbPath = path.join(process.cwd(), '.slack-simulator', 'simulator.db')
    const rdb = new Database(dbPath, { readonly: true })
    try {
      const tableRows = rdb.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      ).all() as Array<{ name: string }>

      const tables = tableRows.map(({ name }) => {
        const countRow = rdb.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get() as { cnt: number }
        const columns = (rdb.prepare(`PRAGMA table_info("${name}")`).all() as Array<{
          cid: number; name: string; type: string; notnull: number; pk: number
        }>).map(c => ({ name: c.name, type: c.type, pk: c.pk > 0, notnull: c.notnull > 0 }))
        const fkRows = rdb.prepare(`PRAGMA foreign_key_list("${name}")`).all() as Array<{
          from: string; table: string; to: string
        }>
        const fks: Record<string, { table: string; col: string }> = {}
        for (const fk of fkRows) fks[fk.from] = { table: fk.table, col: fk.to }
        return { name, rowCount: countRow.cnt, columns, fks }
      })
      return reply.send({ tables })
    } finally {
      rdb.close()
    }
  })

  // GET /_control/db/tables/:name?limit=50&offset=0&orderBy=col&order=asc|desc
  app.get('/_control/db/tables/:name', async (req, reply) => {
    const { name } = req.params as { name: string }
    const { limit = '50', offset = '0', orderBy, order = 'asc' } = req.query as {
      limit?: string; offset?: string; orderBy?: string; order?: string
    }

    // Validate table name is alphanumeric/underscore only
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return reply.status(400).send({ error: 'invalid table name' })
    }

    const Database = (await import('better-sqlite3')).default
    const path = (await import('path')).default
    const dbPath = path.join(process.cwd(), '.slack-simulator', 'simulator.db')
    const rdb = new Database(dbPath, { readonly: true })
    try {
      const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200)
      const off = Math.max(parseInt(offset, 10) || 0, 0)
      const dir = order === 'desc' ? 'DESC' : 'ASC'

      // Validate orderBy column exists
      const cols = (rdb.prepare(`PRAGMA table_info("${name}")`).all() as Array<{ name: string }>)
        .map(c => c.name)
      const safeCols = cols.includes(orderBy ?? '') ? orderBy : cols[0]

      const total = (rdb.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get() as { cnt: number }).cnt
      const rows = rdb.prepare(
        `SELECT * FROM "${name}" ORDER BY "${safeCols}" ${dir} LIMIT ? OFFSET ?`
      ).all(lim, off)

      return reply.send({ rows, total, columns: cols })
    } finally {
      rdb.close()
    }
  })
}
