import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { User, Channel, Message, Reaction, App } from '../shared/types';

const DB_DIR = path.join(process.cwd(), '.slack-simulator');
const DB_PATH = path.join(DB_DIR, 'simulator.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = process.env.TEST_DB_PATH || DB_PATH;

  if (!process.env.TEST_DB_PATH && !fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(dbPath);

  try {
    _db.pragma('journal_mode = WAL');
  } catch {
    // WAL mode note supported e.g. on Windows with some configurations
    // Fall back to default journal mode
  }
  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspace (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL, full_name TEXT NOT NULL,
      email TEXT NOT NULL, avatar_seed TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY, name TEXT, type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channel_members (
      channel_id TEXT NOT NULL, user_id TEXT NOT NULL,
      PRIMARY KEY (channel_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, channel_id TEXT NOT NULL, user_id TEXT NOT NULL,
      text TEXT NOT NULL, ts TEXT NOT NULL, thread_ts TEXT, blocks TEXT, subtype TEXT
    );
    CREATE TABLE IF NOT EXISTS reactions (
      message_id TEXT NOT NULL, name TEXT NOT NULL, user_id TEXT NOT NULL,
      PRIMARY KEY (message_id, name, user_id)
    );
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, bot_user_id TEXT NOT NULL,
      bot_user_name TEXT NOT NULL, bot_token TEXT NOT NULL, app_token TEXT NOT NULL,
      signing_secret TEXT NOT NULL, request_url TEXT,
      subscribed_events TEXT NOT NULL, socket_mode_enabled INTEGER NOT NULL DEFAULT 0,
      description TEXT, slash_commands TEXT
    );
  `);

  // Column-level migrations — safe to run repeatedly (errors mean column already exists)
  try {
    db.exec('ALTER TABLE apps ADD COLUMN description TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE apps ADD COLUMN slash_commands TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE apps ADD COLUMN avatar_url TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE messages ADD COLUMN blocks TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE messages ADD COLUMN subtype TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE workspace ADD COLUMN avatar_url TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE workspace ADD COLUMN emoji_set TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE apps ADD COLUMN incoming_webhooks TEXT');
  } catch (_) {}
  try {
    db.exec(
      'ALTER TABLE messages ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0'
    );
  } catch (_) {}
  try {
    db.exec(
      'ALTER TABLE channels ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'
    );
  } catch (_) {}
  try {
    db.exec('ALTER TABLE messages ADD COLUMN ephemeral_recipient TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE messages ADD COLUMN unfurls TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE apps ADD COLUMN unfurl_domains TEXT');
  } catch (_) {}
  try {
    db.exec('ALTER TABLE messages ADD COLUMN app_id TEXT');
  } catch (_) {}
}

export function getAllUsers(): User[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM users').all() as Array<{
    id: string;
    username: string;
    full_name: string;
    email: string;
    avatar_seed: string;
    avatar_url: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.full_name,
    email: r.email,
    avatarSeed: r.avatar_seed,
    avatarUrl: r.avatar_url ?? undefined,
  }));
}

export function getChannel(id: string): Channel | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as
    | { id: string; name: string | null; type: string; archived: number }
    | undefined;
  if (!row) return null;

  const memberRows = db
    .prepare('SELECT user_id FROM channel_members WHERE channel_id = ?')
    .all(id) as Array<{ user_id: string }>;
  const members = memberRows.map((r) => r.user_id);

  return {
    id: row.id,
    name: row.name ?? '',
    type: row.type as Channel['type'],
    archived: row.archived === 1,
    members,
  };
}

function getReactionsForMessage(
  db: Database.Database,
  messageId: string
): Reaction[] {
  const rows = db
    .prepare(
      `
    SELECT name, user_id FROM reactions WHERE message_id = ? ORDER BY name
  `
    )
    .all(messageId) as Array<{ name: string; user_id: string }>;

  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.name]) map[r.name] = [];
    map[r.name].push(r.user_id);
  }

  return Object.entries(map).map(([name, users]) => ({ name, users }));
}

function rowToMessage(
  db: Database.Database,
  row: {
    id: string;
    channel_id: string;
    user_id: string;
    text: string;
    ts: string;
    thread_ts: string | null;
    blocks?: string | null;
    subtype?: string | null;
    pinned?: number | null;
    ephemeral_recipient?: string | null;
    unfurls?: string | null;
    app_id?: string | null;
  }
): Message {
  const reactions = getReactionsForMessage(db, row.id);

  // Only fetch thread metadata for root messages (not replies themselves)
  let replyCount: number | undefined;
  let replyUsers: string[] | undefined;
  let latestReplyTs: string | undefined;

  if (!row.thread_ts) {
    const countRow = db
      .prepare(
        'SELECT COUNT(*) as cnt FROM messages WHERE channel_id = ? AND thread_ts = ?'
      )
      .get(row.channel_id, row.ts) as { cnt: number };
    if (countRow.cnt > 0) {
      replyCount = countRow.cnt;
      const userRows = db
        .prepare(
          'SELECT DISTINCT user_id FROM messages WHERE channel_id = ? AND thread_ts = ? ORDER BY ts ASC LIMIT 4'
        )
        .all(row.channel_id, row.ts) as Array<{ user_id: string }>;
      replyUsers = userRows.map((r) => r.user_id);
      const latestRow = db
        .prepare(
          'SELECT ts FROM messages WHERE channel_id = ? AND thread_ts = ? ORDER BY ts DESC LIMIT 1'
        )
        .get(row.channel_id, row.ts) as { ts: string };
      latestReplyTs = latestRow.ts;
    }
  }

  let blocks: Message['blocks'];
  if (row.blocks) {
    try {
      blocks = JSON.parse(row.blocks);
    } catch (_) {}
  }

  return {
    id: row.id,
    channel: row.channel_id,
    user: row.user_id,
    text: row.text,
    ts: row.ts,
    threadTs: row.thread_ts ?? undefined,
    reactions,
    blocks,
    subtype: row.subtype ?? undefined,
    pinned: row.pinned ? true : undefined,
    appId: row.app_id ?? undefined,
    ephemeralRecipient: row.ephemeral_recipient ?? undefined,
    unfurls: row.unfurls
      ? (() => {
          try {
            return JSON.parse(row.unfurls!);
          } catch {
            return undefined;
          }
        })()
      : undefined,
    replyCount,
    replyUsers,
    latestReplyTs,
  };
}

export function getChannelMessages(
  channelId: string,
  limit = 100,
  cursor?: string
): { messages: Message[]; nextCursor?: string } {
  const db = getDb();

  let rows: Array<{
    id: string;
    channel_id: string;
    user_id: string;
    text: string;
    ts: string;
    thread_ts: string | null;
  }>;

  if (cursor) {
    rows = db
      .prepare(
        `
      SELECT * FROM messages
      WHERE channel_id = ? AND thread_ts IS NULL AND ts < ?
      ORDER BY ts DESC LIMIT ?
    `
      )
      .all(channelId, cursor, limit + 1) as typeof rows;
  } else {
    rows = db
      .prepare(
        `
      SELECT * FROM messages
      WHERE channel_id = ? AND thread_ts IS NULL
      ORDER BY ts DESC LIMIT ?
    `
      )
      .all(channelId, limit + 1) as typeof rows;
  }

  let nextCursor: string | undefined;
  if (rows.length > limit) {
    rows = rows.slice(0, limit);
    nextCursor = rows[rows.length - 1].ts;
  }

  // Return in ascending order for display
  const messages = rows.reverse().map((r) => rowToMessage(db, r));
  return { messages, nextCursor };
}

export function getThreadMessages(
  channelId: string,
  threadTs: string
): Message[] {
  const db = getDb();
  // Get parent
  const parent = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, threadTs) as
    | {
        id: string;
        channel_id: string;
        user_id: string;
        text: string;
        ts: string;
        thread_ts: string | null;
      }
    | undefined;

  const replies = db
    .prepare(
      `
    SELECT * FROM messages
    WHERE channel_id = ? AND thread_ts = ?
    ORDER BY ts ASC
  `
    )
    .all(channelId, threadTs) as Array<{
    id: string;
    channel_id: string;
    user_id: string;
    text: string;
    ts: string;
    thread_ts: string | null;
  }>;

  const all = parent ? [parent, ...replies] : replies;
  return all.map((r) => rowToMessage(db, r));
}

let _msgCounter = 0;
export function insertMessage(msg: {
  id: string;
  channelId: string;
  userId: string;
  text: string;
  ts: string;
  threadTs?: string;
  blocks?: unknown[];
  subtype?: string;
  ephemeralRecipient?: string;
  appId?: string;
}): Message {
  const db = getDb();
  const blocksJson = msg.blocks?.length ? JSON.stringify(msg.blocks) : null;
  db.prepare(
    `
    INSERT INTO messages (id, channel_id, user_id, text, ts, thread_ts, blocks, subtype, ephemeral_recipient, app_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    msg.id,
    msg.channelId,
    msg.userId,
    msg.text,
    msg.ts,
    msg.threadTs ?? null,
    blocksJson,
    msg.subtype ?? null,
    msg.ephemeralRecipient ?? null,
    msg.appId ?? null
  );

  return {
    id: msg.id,
    channel: msg.channelId,
    user: msg.userId,
    text: msg.text,
    ts: msg.ts,
    threadTs: msg.threadTs,
    reactions: [],
    blocks: msg.blocks as Message['blocks'],
    subtype: msg.subtype,
    appId: msg.appId,
    ephemeralRecipient: msg.ephemeralRecipient,
  };
}

export function updateMessage(
  channelId: string,
  ts: string,
  text: string,
  blocks?: unknown[]
): Message | null {
  const db = getDb();
  if (blocks !== undefined) {
    db.prepare(
      'UPDATE messages SET text = ?, blocks = ? WHERE channel_id = ? AND ts = ?'
    ).run(text, JSON.stringify(blocks), channelId, ts);
  } else {
    db.prepare(
      'UPDATE messages SET text = ? WHERE channel_id = ? AND ts = ?'
    ).run(text, channelId, ts);
  }
  const row = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, ts) as
    | {
        id: string;
        channel_id: string;
        user_id: string;
        text: string;
        ts: string;
        thread_ts: string | null;
      }
    | undefined;
  if (!row) return null;
  return rowToMessage(db, row);
}

export function deleteMessage(channelId: string, ts: string): boolean {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM messages WHERE channel_id = ? AND ts = ?')
    .run(channelId, ts);
  return result.changes > 0;
}

export function getMessageByTs(channelId: string, ts: string): Message | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, ts) as
    | {
        id: string;
        channel_id: string;
        user_id: string;
        text: string;
        ts: string;
        thread_ts: string | null;
      }
    | undefined;
  if (!row) return null;
  return rowToMessage(db, row);
}

export function toggleReaction(
  messageId: string,
  reactionName: string,
  userId: string
): 'added' | 'removed' {
  const db = getDb();
  const existing = db
    .prepare(
      'SELECT 1 FROM reactions WHERE message_id = ? AND name = ? AND user_id = ?'
    )
    .get(messageId, reactionName, userId);

  if (existing) {
    db.prepare(
      'DELETE FROM reactions WHERE message_id = ? AND name = ? AND user_id = ?'
    ).run(messageId, reactionName, userId);
    return 'removed';
  } else {
    db.prepare(
      'INSERT OR IGNORE INTO reactions (message_id, name, user_id) VALUES (?, ?, ?)'
    ).run(messageId, reactionName, userId);
    return 'added';
  }
}

type AppRow = {
  id: string;
  name: string;
  bot_user_id: string;
  bot_user_name: string;
  bot_token: string;
  app_token: string;
  signing_secret: string;
  request_url: string;
  subscribed_events: string;
  socket_mode_enabled: number;
  description: string | null;
  slash_commands: string | null;
  avatar_url: string | null;
  incoming_webhooks: string | null;
  unfurl_domains: string | null;
};

function rowToApp(r: AppRow): App {
  return {
    id: r.id,
    name: r.name,
    botUserId: r.bot_user_id,
    botUserName: r.bot_user_name,
    botToken: r.bot_token,
    appToken: r.app_token,
    signingSecret: r.signing_secret,
    requestUrl: r.request_url,
    subscribedEvents: r.subscribed_events
      ? JSON.parse(r.subscribed_events)
      : [],
    socketModeEnabled: r.socket_mode_enabled === 1,
    description: r.description ?? undefined,
    avatarUrl: r.avatar_url ?? undefined,
    slashCommands: r.slash_commands ? JSON.parse(r.slash_commands) : [],
    incomingWebhooks: r.incoming_webhooks
      ? JSON.parse(r.incoming_webhooks)
      : [],
    unfurlDomains: r.unfurl_domains ? JSON.parse(r.unfurl_domains) : [],
  };
}

export function setPinned(messageId: string, pinned: boolean): Message | null {
  const db = getDb();
  db.prepare('UPDATE messages SET pinned = ? WHERE id = ?').run(
    pinned ? 1 : 0,
    messageId
  );
  const row = db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(messageId) as
    | {
        id: string;
        channel_id: string;
        user_id: string;
        text: string;
        ts: string;
        thread_ts: string | null;
        blocks: string | null;
        subtype: string | null;
        pinned: number;
      }
    | undefined;
  if (!row) return null;
  return rowToMessage(db, row);
}

export function setMessageUnfurls(
  channelId: string,
  ts: string,
  unfurls: Record<string, unknown>
): Message | null {
  const db = getDb();
  db.prepare(
    'UPDATE messages SET unfurls = ? WHERE channel_id = ? AND ts = ?'
  ).run(JSON.stringify(unfurls), channelId, ts);
  const row = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, ts) as
    | {
        id: string;
        channel_id: string;
        user_id: string;
        text: string;
        ts: string;
        thread_ts: string | null;
      }
    | undefined;
  if (!row) return null;
  return rowToMessage(db, row);
}

export function getApps(): App[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM apps').all() as AppRow[];
  return rows.map(rowToApp);
}

export function getAppByToken(token: string): App | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM apps WHERE bot_token = ? OR app_token = ?')
    .get(token, token) as AppRow | undefined;
  if (!row) return null;
  return rowToApp(row);
}

export function getAppByWebhookToken(
  token: string
): { app: App; channelId: string } | null {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM apps WHERE incoming_webhooks IS NOT NULL')
    .all() as AppRow[];
  for (const row of rows) {
    const webhooks: Array<{ channelId: string; token: string }> =
      row.incoming_webhooks ? JSON.parse(row.incoming_webhooks) : [];
    const match = webhooks.find((w) => w.token === token);
    if (match) return { app: rowToApp(row), channelId: match.channelId };
  }
  return null;
}

export function updateApp(
  id: string,
  fields: {
    requestUrl?: string;
    socketModeEnabled?: boolean;
    subscribedEvents?: string[];
  }
): void {
  const db = getDb();
  if (fields.requestUrl !== undefined) {
    db.prepare('UPDATE apps SET request_url = ? WHERE id = ?').run(
      fields.requestUrl,
      id
    );
  }
  if (fields.socketModeEnabled !== undefined) {
    db.prepare('UPDATE apps SET socket_mode_enabled = ? WHERE id = ?').run(
      fields.socketModeEnabled ? 1 : 0,
      id
    );
  }
  if (fields.subscribedEvents !== undefined) {
    db.prepare('UPDATE apps SET subscribed_events = ? WHERE id = ?').run(
      JSON.stringify(fields.subscribedEvents),
      id
    );
  }
}

export function generateTs(): string {
  _msgCounter = (_msgCounter + 1) % 1000000;
  return `${Math.floor(Date.now() / 1000)}.${String(_msgCounter).padStart(6, '0')}`;
}

export function generateId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
