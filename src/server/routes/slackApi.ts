import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SIMULATOR_BASE_URL } from '../index';
import {
  getDb,
  getAllUsers,
  getChannel,
  getChannelMessages,
  getThreadMessages,
  insertMessage,
  updateMessage,
  deleteMessage,
  getMessageByTs,
  toggleReaction,
  getApps,
  getAppByToken,
  generateTs,
  generateId,
  setMessageUnfurls,
} from '../db';
import { broadcast } from '../realtime';
import { logInbound, dispatchEvent } from '../dispatcher';
import { issueTicket } from '../socketModeServer';
import {
  redeemTrigger,
  openModal,
  updateModal,
  pushModal,
} from '../interactivity';
import type { App, Message } from '../../shared/types';

function extractToken(req: FastifyRequest): string | null {
  const auth = req.headers['authorization'];
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function authError(reply: FastifyReply) {
  return reply.status(200).send({ ok: false, error: 'invalid_auth' });
}

function getBody(req: FastifyRequest): Record<string, unknown> {
  return (req.body as Record<string, unknown>) ?? {};
}

/** @slack/web-api sends form-encoded bodies where arrays/objects are JSON-stringified. */
function parseBlocks(raw: unknown): unknown[] | undefined {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return undefined;
}

export async function registerSlackApi(app: FastifyInstance): Promise<void> {
  // Generic handler for all POST /api/:method
  app.post('/api/:method', async (req: FastifyRequest, reply: FastifyReply) => {
    const { method } = req.params as { method: string };
    const token = extractToken(req);
    const body = getBody(req);

    // auth.test doesn't need token validation but we still check
    const authApp = token ? getAppByToken(token) : null;

    if (!authApp) {
      return authError(reply);
    }

    const result = await handleSlackMethod(method, body, authApp, reply);
    // Log inbound API call
    logInbound(authApp.id, authApp.name, method, body, reply.statusCode || 200);
    return result;
  });
}

async function handleSlackMethod(
  method: string,
  body: Record<string, unknown>,
  authApp: App,
  reply: FastifyReply
): Promise<unknown> {
  const db = getDb();

  switch (method) {
    case 'auth.test': {
      const ws = db.prepare('SELECT * FROM workspace LIMIT 1').get() as
        | { id: string; name: string; domain: string }
        | undefined;
      return reply.send({
        ok: true,
        url: SIMULATOR_BASE_URL,
        team: ws?.name ?? 'Slack Simulator Test',
        user: authApp.botUserName,
        team_id: ws?.id ?? 'W001',
        user_id: authApp.botUserId,
        bot_id: authApp.botUserId,
      });
    }

    case 'users.list': {
      const users = getAllUsers();
      const members = users.map((u) => ({
        id: u.id,
        name: u.username,
        real_name: u.fullName,
        profile: {
          email: u.email,
          real_name: u.fullName,
          display_name: u.username,
        },
        is_bot: false,
      }));
      // Add bot user
      members.push({
        id: authApp.botUserId,
        name: authApp.botUserName,
        real_name: authApp.name,
        profile: {
          email: '',
          real_name: authApp.name,
          display_name: authApp.botUserName,
        },
        is_bot: true,
      });
      return reply.send({
        ok: true,
        members,
        response_metadata: { next_cursor: '' },
      });
    }

    case 'users.info': {
      const userId = body.user as string;
      if (!userId) return reply.send({ ok: false, error: 'invalid_arguments' });
      const users = getAllUsers();
      const u = users.find((u) => u.id === userId);
      if (!u) return reply.send({ ok: false, error: 'user_not_found' });
      return reply.send({
        ok: true,
        user: {
          id: u.id,
          name: u.username,
          real_name: u.fullName,
          profile: {
            email: u.email,
            real_name: u.fullName,
            display_name: u.username,
          },
          is_bot: false,
        },
      });
    }

    case 'conversations.list': {
      const channels = db.prepare('SELECT * FROM channels').all() as Array<{
        id: string;
        name: string | null;
        type: string;
      }>;
      const result = channels.map((c) => {
        const members = db
          .prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
          .all(c.id) as Array<{ user_id: string }>;
        return {
          id: c.id,
          name: c.name ?? '',
          is_channel: c.type === 'public' || c.type === 'private',
          is_private: c.type === 'private',
          is_im: c.type === 'im',
          num_members: members.length,
        };
      });
      return reply.send({
        ok: true,
        channels: result,
        response_metadata: { next_cursor: '' },
      });
    }

    case 'conversations.history': {
      const channelId = body.channel as string;
      const limit = body.limit ? parseInt(body.limit as string, 10) : 100;
      const cursor = body.cursor as string | undefined;

      if (!channelId)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const { messages, nextCursor } = getChannelMessages(
        channelId,
        limit,
        cursor
      );
      const slackMessages = messages.map((m) => ({
        type: 'message',
        text: m.text,
        user: m.user,
        ts: m.ts,
        reactions: m.reactions.map((r) => ({
          name: r.name,
          count: r.users.length,
          users: r.users,
        })),
        thread_ts: m.threadTs,
      }));

      return reply.send({
        ok: true,
        messages: slackMessages,
        has_more: !!nextCursor,
        response_metadata: { next_cursor: nextCursor ?? '' },
      });
    }

    case 'conversations.replies': {
      const channelId = body.channel as string;
      const ts = body.ts as string;
      if (!channelId || !ts)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const messages = getThreadMessages(channelId, ts);
      const slackMessages = messages.map((m) => ({
        type: 'message',
        text: m.text,
        user: m.user,
        ts: m.ts,
        thread_ts: m.threadTs ?? ts,
        reactions: m.reactions.map((r) => ({
          name: r.name,
          count: r.users.length,
          users: r.users,
        })),
      }));

      return reply.send({ ok: true, messages: slackMessages, has_more: false });
    }

    case 'conversations.create': {
      const name = (body.name as string)?.toLowerCase().replace(/\s+/g, '-');
      const isPrivate = body.is_private === true || body.is_private === 'true';
      if (!name) return reply.send({ ok: false, error: 'invalid_arguments' });

      const id = generateId('C');
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        id,
        name,
        isPrivate ? 'private' : 'public'
      );

      const channel = getChannel(id)!;
      broadcast({ type: 'channel_created', channel });

      return reply.send({
        ok: true,
        channel: {
          id,
          name,
          is_channel: true,
          is_private: isPrivate,
          is_im: false,
          num_members: 0,
        },
      });
    }

    case 'conversations.members': {
      const channelId = body.channel as string;
      if (!channelId)
        return reply.send({ ok: false, error: 'invalid_arguments' });
      const rows = db
        .prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
        .all(channelId) as Array<{ user_id: string }>;
      return reply.send({
        ok: true,
        members: rows.map((r) => r.user_id),
        response_metadata: { next_cursor: '' },
      });
    }

    case 'conversations.open': {
      let userIds: string[] = [];
      if (typeof body.users === 'string') {
        userIds = body.users.split(',').map((s) => s.trim());
      } else if (Array.isArray(body.users)) {
        userIds = body.users as string[];
      }

      if (!userIds.length)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      // Always include the calling bot's own user ID — real Slack does this automatically
      const allMemberIds = [...new Set([...userIds, authApp.botUserId])];

      // Find existing IM with exactly these members
      const allIms = db
        .prepare('SELECT id FROM channels WHERE type = ?')
        .all('im') as Array<{ id: string }>;

      for (const im of allIms) {
        const members = (
          db
            .prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
            .all(im.id) as Array<{ user_id: string }>
        ).map((r) => r.user_id);
        const sorted1 = [...members].sort().join(',');
        const sorted2 = [...allMemberIds].sort().join(',');
        if (sorted1 === sorted2) {
          return reply.send({ ok: true, channel: { id: im.id, is_im: true } });
        }
      }

      // Create new IM and broadcast so the sidebar picks it up immediately
      const id = generateId('D');
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        id,
        null,
        'im'
      );
      for (const uid of allMemberIds) {
        db.prepare(
          'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
        ).run(id, uid);
      }

      const newChannel = getChannel(id)!;
      broadcast({ type: 'channel_created', channel: newChannel });

      return reply.send({ ok: true, channel: { id, is_im: true } });
    }

    case 'conversations.info': {
      const channelId = body.channel as string;
      if (!channelId)
        return reply.send({ ok: false, error: 'invalid_arguments' });
      const channel = getChannel(channelId);
      if (!channel)
        return reply.send({ ok: false, error: 'channel_not_found' });
      return reply.send({
        ok: true,
        channel: {
          id: channel.id,
          name: channel.name,
          is_channel: channel.type === 'public' || channel.type === 'private',
          is_private: channel.type === 'private',
          is_im: channel.type === 'im',
          num_members: channel.members.length,
        },
      });
    }

    case 'users.conversations': {
      const userId = (body.user as string) || authApp.botUserId;
      const rows = db
        .prepare(
          `
        SELECT c.* FROM channels c
        JOIN channel_members cm ON c.id = cm.channel_id
        WHERE cm.user_id = ?
      `
        )
        .all(userId) as Array<{
        id: string;
        name: string | null;
        type: string;
      }>;

      return reply.send({
        ok: true,
        channels: rows.map((c) => ({
          id: c.id,
          name: c.name ?? '',
          is_channel: c.type === 'public' || c.type === 'private',
          is_private: c.type === 'private',
          is_im: c.type === 'im',
        })),
        response_metadata: { next_cursor: '' },
      });
    }

    case 'chat.postMessage': {
      let channelId = body.channel as string;
      const text = (body.text as string) ?? '';
      const threadTs = body.thread_ts as string | undefined;
      const blocks = parseBlocks(body.blocks);

      if (!channelId)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      // If channel is a user ID, auto-open a DM (real Slack supports this)
      if (/^U\w+$/.test(channelId)) {
        const targetUserId = channelId;
        const allMemberIds = [...new Set([targetUserId, authApp.botUserId])];
        const allIms = db
          .prepare('SELECT id FROM channels WHERE type = ?')
          .all('im') as Array<{ id: string }>;
        let dmId: string | null = null;
        for (const im of allIms) {
          const members = (
            db
              .prepare(
                'SELECT user_id FROM channel_members WHERE channel_id = ?'
              )
              .all(im.id) as Array<{ user_id: string }>
          ).map((r) => r.user_id);
          if (
            [...members].sort().join(',') === [...allMemberIds].sort().join(',')
          ) {
            dmId = im.id;
            break;
          }
        }
        if (!dmId) {
          dmId = generateId('D');
          db.prepare(
            'INSERT INTO channels (id, name, type) VALUES (?, ?, ?)'
          ).run(dmId, null, 'im');
          for (const uid of allMemberIds) {
            db.prepare(
              'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
            ).run(dmId, uid);
          }
          broadcast({ type: 'channel_created', channel: getChannel(dmId)! });
        }
        channelId = dmId;
      }

      // Reject posts to archived channels, matching real Slack behaviour
      const targetChannel = getChannel(channelId);
      if (targetChannel?.archived)
        return reply.send({ ok: false, error: 'is_archived' });

      const ts = generateTs();
      const id = generateId('M');
      const message = insertMessage({
        id,
        channelId,
        userId: authApp.botUserId,
        text,
        ts,
        threadTs,
        blocks,
        appId: authApp.id,
      });

      broadcast({ type: 'message_new', message });

      const postChannel = targetChannel;
      const postChannelType = !postChannel
        ? 'channel'
        : postChannel.type === 'im'
          ? 'im'
          : postChannel.type === 'private'
            ? 'group'
            : 'channel';
      let postParentUserId: string | undefined;
      if (threadTs) {
        const parentRow = db
          .prepare(
            'SELECT user_id FROM messages WHERE channel_id = ? AND ts = ?'
          )
          .get(channelId, threadTs) as { user_id: string } | undefined;
        postParentUserId = parentRow?.user_id;
      }
      const botMsgPayload: Record<string, unknown> = {
        subtype: 'bot_message',
        bot_id: authApp.botUserId,
        username: authApp.botUserName,
        channel: channelId,
        text,
        ts,
        event_ts: ts,
        channel_type: postChannelType,
        ...(threadTs ? { thread_ts: threadTs } : {}),
        ...(postParentUserId ? { parent_user_id: postParentUserId } : {}),
        ...(blocks?.length ? { blocks } : {}),
      };
      dispatchEvent('message', botMsgPayload).catch(() => {});

      // app_mention: fire if any bot is @mentioned in the bot's message
      const allApps = getApps();
      for (const a of allApps) {
        if (
          text.includes(`@${a.botUserName}`) ||
          text.includes(`<@${a.botUserId}>`)
        ) {
          dispatchEvent('app_mention', botMsgPayload).catch(() => {});
          break;
        }
      }

      return reply.send({
        ok: true,
        channel: channelId,
        ts,
        message: { text, ts, user: authApp.botUserId },
      });
    }

    case 'chat.update': {
      const channelId = body.channel as string;
      const ts = body.ts as string;
      const text = (body.text as string) ?? '';
      const blocks = parseBlocks(body.blocks);

      if (!channelId || !ts)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const message = updateMessage(channelId, ts, text, blocks);
      if (!message)
        return reply.send({ ok: false, error: 'message_not_found' });

      broadcast({ type: 'message_updated', message });

      return reply.send({ ok: true, channel: channelId, ts, text });
    }

    case 'chat.delete': {
      const channelId = body.channel as string;
      const ts = body.ts as string;

      if (!channelId || !ts)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const deleted = deleteMessage(channelId, ts);
      if (!deleted)
        return reply.send({ ok: false, error: 'message_not_found' });

      broadcast({ type: 'message_deleted', channelId, ts });

      return reply.send({ ok: true, channel: channelId, ts });
    }

    case 'chat.postEphemeral': {
      const channelId = body.channel as string;
      const text = (body.text as string) ?? '';
      const threadTs = body.thread_ts as string | undefined;
      const blocks = parseBlocks(body.blocks);
      const ephemeralRecipient = body.user as string | undefined;

      if (!channelId)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const ts = generateTs();
      const id = generateId('ME');
      const message = insertMessage({
        id,
        channelId,
        userId: authApp.botUserId,
        text,
        ts,
        threadTs,
        blocks,
        subtype: 'ephemeral',
        ephemeralRecipient,
        appId: authApp.id,
      });
      broadcast({ type: 'message_new', message });

      return reply.send({ ok: true, message_ts: ts });
    }

    case 'chat.unfurl': {
      const channelId = body.channel as string;
      const ts = body.ts as string;
      // @slack/web-api sends unfurls as a JSON-encoded string inside a form body
      const rawUnfurls = body.unfurls;
      let unfurls: Record<string, unknown> | undefined;
      if (typeof rawUnfurls === 'string') {
        try {
          unfurls = JSON.parse(rawUnfurls);
        } catch {
          /* invalid */
        }
      } else if (rawUnfurls && typeof rawUnfurls === 'object') {
        unfurls = rawUnfurls as Record<string, unknown>;
      }

      if (!channelId || !ts || !unfurls)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const updated = setMessageUnfurls(channelId, ts, unfurls);
      if (!updated)
        return reply.send({ ok: false, error: 'message_not_found' });

      broadcast({ type: 'message_updated', message: updated });
      return reply.send({ ok: true });
    }

    case 'chat.getPermalink': {
      const channelId = body.channel as string;
      const messageTs = body.message_ts as string;
      if (!channelId || !messageTs)
        return reply.send({ ok: false, error: 'invalid_arguments' });
      const permalink = `${SIMULATOR_BASE_URL}/archives/${channelId}/p${messageTs.replace('.', '')}`;
      return reply.send({ ok: true, channel: channelId, permalink });
    }

    case 'reactions.add': {
      const channelId = body.channel as string;
      const name = body.name as string;
      const timestamp = body.timestamp as string;

      if (!channelId || !name || !timestamp)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const msg = getMessageByTs(channelId, timestamp);
      if (!msg) return reply.send({ ok: false, error: 'message_not_found' });

      toggleReaction(msg.id, name, authApp.botUserId);
      const updatedMsg = getMessageByTs(channelId, timestamp)!;

      broadcast({
        type: 'reaction_updated',
        ts: timestamp,
        channelId,
        reactions: updatedMsg.reactions,
      });

      return reply.send({ ok: true });
    }

    case 'reactions.remove': {
      const channelId = body.channel as string;
      const name = body.name as string;
      const timestamp = body.timestamp as string;

      if (!channelId || !name || !timestamp)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const msg = getMessageByTs(channelId, timestamp);
      if (!msg) return reply.send({ ok: false, error: 'message_not_found' });

      db.prepare(
        'DELETE FROM reactions WHERE message_id = ? AND name = ? AND user_id = ?'
      ).run(msg.id, name, authApp.botUserId);

      const updatedMsg = getMessageByTs(channelId, timestamp)!;
      broadcast({
        type: 'reaction_updated',
        ts: timestamp,
        channelId,
        reactions: updatedMsg.reactions,
      });

      return reply.send({ ok: true });
    }

    case 'reactions.get': {
      const channelId = body.channel as string;
      const timestamp = body.timestamp as string;

      if (!channelId || !timestamp)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      const msg = getMessageByTs(channelId, timestamp);
      if (!msg) return reply.send({ ok: false, error: 'message_not_found' });

      return reply.send({
        ok: true,
        type: 'message',
        channel: channelId,
        message: {
          text: msg.text,
          ts: msg.ts,
          reactions: msg.reactions.map((r) => ({
            name: r.name,
            count: r.users.length,
            users: r.users,
          })),
        },
      });
    }

    case 'apps.connections.open': {
      // Socket Mode handshake — bot sends its appToken to get a WS URL
      const ticket = issueTicket(authApp.id);
      const host = SIMULATOR_BASE_URL.replace(/^https?:\/\//, '');
      return reply.send({
        ok: true,
        url: `ws://${host}/_ws/socket-mode?ticket=${ticket}`,
      });
    }

    case 'views.open': {
      const triggerId = body.trigger_id as string;
      const rawView = body.view as Record<string, unknown> | string | undefined;
      if (!triggerId || !rawView)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      // Parse view if it came as a JSON string (from form-encoded SDK requests)
      let viewObj: Record<string, unknown>;
      if (typeof rawView === 'string') {
        try {
          viewObj = JSON.parse(rawView);
        } catch {
          return reply.send({ ok: false, error: 'invalid_arguments' });
        }
      } else {
        viewObj = rawView;
      }

      const appIdFromTrigger = redeemTrigger(triggerId);
      if (!appIdFromTrigger)
        return reply.send({ ok: false, error: 'expired_trigger_id' });

      const view = openModal(viewObj, authApp.id);
      return reply.send({ ok: true, view: { id: view.id, type: view.type } });
    }

    case 'views.update': {
      const viewId = body.view_id as string;
      const rawView = body.view as Record<string, unknown> | string | undefined;
      if (!viewId || !rawView)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      let viewObj: Record<string, unknown>;
      if (typeof rawView === 'string') {
        try {
          viewObj = JSON.parse(rawView);
        } catch {
          return reply.send({ ok: false, error: 'invalid_arguments' });
        }
      } else {
        viewObj = rawView;
      }

      const view = updateModal(viewId, viewObj);
      if (!view) return reply.send({ ok: false, error: 'not_found' });
      return reply.send({ ok: true, view: { id: view.id, type: view.type } });
    }

    case 'views.push': {
      const triggerId = body.trigger_id as string;
      const rawView = body.view as Record<string, unknown> | string | undefined;
      if (!triggerId || !rawView)
        return reply.send({ ok: false, error: 'invalid_arguments' });

      let viewObj: Record<string, unknown>;
      if (typeof rawView === 'string') {
        try {
          viewObj = JSON.parse(rawView);
        } catch {
          return reply.send({ ok: false, error: 'invalid_arguments' });
        }
      } else {
        viewObj = rawView;
      }

      const appIdFromTrigger = redeemTrigger(triggerId);
      if (!appIdFromTrigger)
        return reply.send({ ok: false, error: 'expired_trigger_id' });

      const view = pushModal(viewObj, authApp.id);
      return reply.send({ ok: true, view: { id: view.id, type: view.type } });
    }

    default:
      return reply.status(404).send({ ok: false, error: 'unknown_method' });
  }
}
