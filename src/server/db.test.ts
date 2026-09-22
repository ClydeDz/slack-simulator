import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Import the db module functions directly, but we'll need to mock the getDb function
// We'll create test helpers that use a test database instance

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

// Re-implement the functions with dependency injection for testing
function getAllUsers(db: Database.Database) {
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

function getChannel(db: Database.Database, id: string) {
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
    type: row.type as any,
    archived: row.archived === 1,
    members,
  };
}

function getReactionsForMessage(db: Database.Database, messageId: string) {
  const rows = db
    .prepare(
      'SELECT name, user_id FROM reactions WHERE message_id = ? ORDER BY name'
    )
    .all(messageId) as Array<{ name: string; user_id: string }>;

  const map: Record<string, string[]> = {};
  for (const r of rows) {
    if (!map[r.name]) map[r.name] = [];
    map[r.name].push(r.user_id);
  }

  return Object.entries(map).map(([name, users]) => ({ name, users }));
}

function rowToMessage(db: Database.Database, row: any) {
  const reactions = getReactionsForMessage(db, row.id);

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

  let blocks: any;
  if (row.blocks) {
    try {
      blocks = JSON.parse(row.blocks);
    } catch (_) {}
  }

  let unfurls: any;
  if (row.unfurls) {
    try {
      unfurls = JSON.parse(row.unfurls);
    } catch {
      unfurls = undefined;
    }
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
    unfurls,
    replyCount,
    replyUsers,
    latestReplyTs,
  };
}

function getChannelMessages(
  db: Database.Database,
  channelId: string,
  limit = 100,
  cursor?: string
) {
  let rows: any[];

  if (cursor) {
    rows = db
      .prepare(
        'SELECT * FROM messages WHERE channel_id = ? AND thread_ts IS NULL AND ts < ? ORDER BY ts DESC LIMIT ?'
      )
      .all(channelId, cursor, limit + 1);
  } else {
    rows = db
      .prepare(
        'SELECT * FROM messages WHERE channel_id = ? AND thread_ts IS NULL ORDER BY ts DESC LIMIT ?'
      )
      .all(channelId, limit + 1);
  }

  let nextCursor: string | undefined;
  if (rows.length > limit) {
    rows = rows.slice(0, limit);
    nextCursor = rows[rows.length - 1].ts;
  }

  const messages = rows.reverse().map((r) => rowToMessage(db, r));
  return { messages, nextCursor };
}

function getThreadMessages(
  db: Database.Database,
  channelId: string,
  threadTs: string
) {
  const parent = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, threadTs);

  const replies = db
    .prepare(
      'SELECT * FROM messages WHERE channel_id = ? AND thread_ts = ? ORDER BY ts ASC'
    )
    .all(channelId, threadTs);

  const all = parent ? [parent, ...replies] : replies;
  return all.map((r) => rowToMessage(db, r));
}

function insertMessage(db: Database.Database, msg: any) {
  const blocksJson = msg.blocks?.length ? JSON.stringify(msg.blocks) : null;
  db.prepare(
    'INSERT INTO messages (id, channel_id, user_id, text, ts, thread_ts, blocks, subtype, ephemeral_recipient, app_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
    blocks: msg.blocks,
    subtype: msg.subtype,
    appId: msg.appId,
    ephemeralRecipient: msg.ephemeralRecipient,
  };
}

function updateMessage(
  db: Database.Database,
  channelId: string,
  ts: string,
  text: string,
  blocks?: any[]
) {
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
    .get(channelId, ts);
  if (!row) return null;
  return rowToMessage(db, row);
}

function deleteMessage(db: Database.Database, channelId: string, ts: string) {
  const result = db
    .prepare('DELETE FROM messages WHERE channel_id = ? AND ts = ?')
    .run(channelId, ts);
  return result.changes > 0;
}

function getMessageByTs(db: Database.Database, channelId: string, ts: string) {
  const row = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, ts);
  if (!row) return null;
  return rowToMessage(db, row);
}

function toggleReaction(
  db: Database.Database,
  messageId: string,
  reactionName: string,
  userId: string
) {
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

function setPinned(db: Database.Database, messageId: string, pinned: boolean) {
  db.prepare('UPDATE messages SET pinned = ? WHERE id = ?').run(
    pinned ? 1 : 0,
    messageId
  );
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!row) return null;
  return rowToMessage(db, row);
}

function setMessageUnfurls(
  db: Database.Database,
  channelId: string,
  ts: string,
  unfurls: Record<string, unknown>
) {
  db.prepare(
    'UPDATE messages SET unfurls = ? WHERE channel_id = ? AND ts = ?'
  ).run(JSON.stringify(unfurls), channelId, ts);
  const row = db
    .prepare('SELECT * FROM messages WHERE channel_id = ? AND ts = ?')
    .get(channelId, ts);
  if (!row) return null;
  return rowToMessage(db, row);
}

function rowToApp(r: any) {
  return {
    id: r.id,
    name: r.name,
    botUserId: r.bot_user_id,
    botUserName: r.bot_user_name,
    botToken: r.bot_token,
    appToken: r.app_token,
    signingSecret: r.signing_secret,
    requestUrl: r.request_url ?? undefined,
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

function getApps(db: Database.Database) {
  const rows = db.prepare('SELECT * FROM apps').all();
  return rows.map(rowToApp);
}

function getAppByToken(db: Database.Database, token: string) {
  const row = db
    .prepare('SELECT * FROM apps WHERE bot_token = ? OR app_token = ?')
    .get(token, token);
  if (!row) return null;
  return rowToApp(row);
}

function getAppByWebhookToken(db: Database.Database, token: string) {
  const rows = db
    .prepare('SELECT * FROM apps WHERE incoming_webhooks IS NOT NULL')
    .all() as any[];
  for (const row of rows) {
    const webhooks: Array<{ channelId: string; token: string }> =
      row.incoming_webhooks ? JSON.parse(row.incoming_webhooks) : [];
    const match = webhooks.find((w) => w.token === token);
    if (match) return { app: rowToApp(row), channelId: match.channelId };
  }
  return null;
}

function updateApp(db: Database.Database, id: string, fields: any) {
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

let _msgCounter = 0;
function generateTs() {
  _msgCounter = (_msgCounter + 1) % 1000000;
  return `${Math.floor(Date.now() / 1000)}.${String(_msgCounter).padStart(6, '0')}`;
}

function generateId(prefix: string) {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

describe('Database Operations', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for each test
    db = new Database(':memory:');

    try {
      db.pragma('journal_mode = WAL');
    } catch {
      // WAL mode note supported e.g. on Windows with some configurations
      // Fall back to default journal mode
    }

    runMigrations(db);
    _msgCounter = 0;
  });

  afterEach(() => {
    db.close();
  });

  describe('getAllUsers', () => {
    it('should return empty array when no users exist', () => {
      const users = getAllUsers(db);
      expect(users).toEqual([]);
    });

    it('should return users with correct field mapping', () => {
      db.prepare(
        'INSERT INTO users (id, username, full_name, email, avatar_seed) VALUES (?, ?, ?, ?, ?)'
      ).run('U001', 'alice', 'Alice Smith', 'alice@example.com', 'alice123');
      db.prepare(
        'INSERT INTO users (id, username, full_name, email, avatar_seed) VALUES (?, ?, ?, ?, ?)'
      ).run('U002', 'bob', 'Bob Jones', 'bob@example.com', 'bob456');

      const users = getAllUsers(db);
      expect(users).toHaveLength(2);
      expect(users[0]).toEqual({
        id: 'U001',
        username: 'alice',
        fullName: 'Alice Smith',
        email: 'alice@example.com',
        avatarSeed: 'alice123',
        avatarUrl: undefined,
      });
    });

    it('should include avatar_url when present', () => {
      db.prepare(
        'INSERT INTO users (id, username, full_name, email, avatar_seed, avatar_url) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        'U001',
        'alice',
        'Alice Smith',
        'alice@example.com',
        'alice123',
        'http://example.com/avatar.png'
      );

      const users = getAllUsers(db);
      expect(users[0].avatarUrl).toBe('http://example.com/avatar.png');
    });
  });

  describe('getChannel', () => {
    it('should return null for non-existent channel', () => {
      const channel = getChannel(db, 'C999');
      expect(channel).toBeNull();
    });

    it('should return channel with members', () => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)'
      ).run('C001', 'U001');
      db.prepare(
        'INSERT INTO channel_members (channel_id, user_id) VALUES (?, ?)'
      ).run('C001', 'U002');

      const channel = getChannel(db, 'C001');
      expect(channel).toEqual({
        id: 'C001',
        name: 'general',
        type: 'public',
        archived: false,
        members: ['U001', 'U002'],
      });
    });

    it('should handle archived flag', () => {
      db.prepare(
        'INSERT INTO channels (id, name, type, archived) VALUES (?, ?, ?, ?)'
      ).run('C001', 'general', 'public', 1);

      const channel = getChannel(db, 'C001');
      expect(channel?.archived).toBe(true);
    });

    it('should handle null name', () => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        null,
        'im'
      );

      const channel = getChannel(db, 'C001');
      expect(channel?.name).toBe('');
    });
  });

  describe('getChannelMessages', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Hello', '1234567890.000001');
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M002', 'C001', 'U002', 'Hi there', '1234567890.000002');
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts, thread_ts) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        'M003',
        'C001',
        'U001',
        'Reply',
        '1234567890.000003',
        '1234567890.000001'
      );
    });

    it('should return messages in ascending order', () => {
      const { messages } = getChannelMessages(db, 'C001');
      expect(messages).toHaveLength(2);
      expect(messages[0].ts).toBe('1234567890.000001');
      expect(messages[1].ts).toBe('1234567890.000002');
    });

    it('should exclude thread messages', () => {
      const { messages } = getChannelMessages(db, 'C001');
      expect(messages.every((m) => !m.threadTs)).toBe(true);
    });

    it('should handle pagination with limit', () => {
      const { messages } = getChannelMessages(db, 'C001', 1);
      expect(messages).toHaveLength(1);
    });

    it('should handle cursor-based pagination', () => {
      const { messages, nextCursor } = getChannelMessages(
        db,
        'C001',
        1,
        '1234567890.000002'
      );
      expect(messages).toHaveLength(1);
      expect(messages[0].ts).toBe('1234567890.000001');
      // When we get exactly the limit number of results with a cursor, we don't know if there are more
      expect(nextCursor).toBeUndefined();
    });

    it('should return nextCursor when more messages exist', () => {
      const { nextCursor } = getChannelMessages(db, 'C001', 1);
      expect(nextCursor).toBeDefined();
    });

    it('should not return nextCursor when no more messages', () => {
      const { nextCursor } = getChannelMessages(db, 'C001', 10);
      expect(nextCursor).toBeUndefined();
    });
  });

  describe('getThreadMessages', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Thread start', '1234567890.000001');
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts, thread_ts) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        'M002',
        'C001',
        'U002',
        'Reply 1',
        '1234567890.000002',
        '1234567890.000001'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts, thread_ts) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        'M003',
        'C001',
        'U001',
        'Reply 2',
        '1234567890.000003',
        '1234567890.000001'
      );
    });

    it('should return parent and replies', () => {
      const messages = getThreadMessages(db, 'C001', '1234567890.000001');
      expect(messages).toHaveLength(3);
      expect(messages[0].ts).toBe('1234567890.000001');
      expect(messages[1].ts).toBe('1234567890.000002');
      expect(messages[2].ts).toBe('1234567890.000003');
    });

    it('should return replies in correct order', () => {
      const messages = getThreadMessages(db, 'C001', '1234567890.000001');
      expect(messages[1].ts).toBe('1234567890.000002');
      expect(messages[2].ts).toBe('1234567890.000003');
    });
  });

  describe('insertMessage', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
    });

    it('should insert message with all fields', () => {
      const blocks = [
        { type: 'section', text: { type: 'plain_text', text: 'Test' } },
      ];
      const message = insertMessage(db, {
        id: 'M001',
        channelId: 'C001',
        userId: 'U001',
        text: 'Hello',
        ts: '1234567890.000001',
        threadTs: '1234567890.000000',
        blocks,
        subtype: 'bot_message',
        ephemeralRecipient: 'U002',
        appId: 'A001',
      });

      expect(message).toEqual({
        id: 'M001',
        channel: 'C001',
        user: 'U001',
        text: 'Hello',
        ts: '1234567890.000001',
        threadTs: '1234567890.000000',
        reactions: [],
        blocks,
        subtype: 'bot_message',
        appId: 'A001',
        ephemeralRecipient: 'U002',
      });

      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get('M001');
      expect(row).toBeDefined();
    });

    it('should serialize blocks to JSON', () => {
      const blocks = [
        { type: 'section', text: { type: 'plain_text', text: 'Test' } },
      ];
      insertMessage(db, {
        id: 'M001',
        channelId: 'C001',
        userId: 'U001',
        text: 'Hello',
        ts: '1234567890.000001',
        blocks,
      });

      const row = db
        .prepare('SELECT blocks FROM messages WHERE id = ?')
        .get('M001') as { blocks: string };
      expect(JSON.parse(row.blocks)).toEqual(blocks);
    });

    it('should handle threadTs', () => {
      insertMessage(db, {
        id: 'M001',
        channelId: 'C001',
        userId: 'U001',
        text: 'Reply',
        ts: '1234567890.000001',
        threadTs: '1234567890.000000',
      });

      const row = db
        .prepare('SELECT thread_ts FROM messages WHERE id = ?')
        .get('M001') as { thread_ts: string };
      expect(row.thread_ts).toBe('1234567890.000000');
    });
  });

  describe('updateMessage', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Original', '1234567890.000001');
    });

    it('should update text', () => {
      const updated = updateMessage(db, 'C001', '1234567890.000001', 'Updated');
      expect(updated?.text).toBe('Updated');
    });

    it('should update text and blocks', () => {
      const blocks = [
        { type: 'section', text: { type: 'plain_text', text: 'Test' } },
      ];
      const updated = updateMessage(
        db,
        'C001',
        '1234567890.000001',
        'Updated',
        blocks
      );
      expect(updated?.text).toBe('Updated');
      expect(updated?.blocks).toEqual(blocks);
    });

    it('should return null for non-existent message', () => {
      const updated = updateMessage(db, 'C001', '9999999999.999999', 'Updated');
      expect(updated).toBeNull();
    });
  });

  describe('deleteMessage', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Hello', '1234567890.000001');
    });

    it('should delete message and return true', () => {
      const result = deleteMessage(db, 'C001', '1234567890.000001');
      expect(result).toBe(true);

      const row = db.prepare('SELECT * FROM messages WHERE id = ?').get('M001');
      expect(row).toBeUndefined();
    });

    it('should return false for non-existent message', () => {
      const result = deleteMessage(db, 'C001', '9999999999.999999');
      expect(result).toBe(false);
    });
  });

  describe('getMessageByTs', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Hello', '1234567890.000001');
    });

    it('should retrieve message by channelId and ts', () => {
      const message = getMessageByTs(db, 'C001', '1234567890.000001');
      expect(message?.id).toBe('M001');
      expect(message?.text).toBe('Hello');
    });

    it('should return null for non-existent message', () => {
      const message = getMessageByTs(db, 'C001', '9999999999.999999');
      expect(message).toBeNull();
    });
  });

  describe('toggleReaction', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Hello', '1234567890.000001');
    });

    it('should add new reaction', () => {
      const result = toggleReaction(db, 'M001', 'thumbsup', 'U002');
      expect(result).toBe('added');

      const row = db
        .prepare('SELECT * FROM reactions WHERE message_id = ?')
        .get('M001');
      expect(row).toBeDefined();
    });

    it('should remove existing reaction', () => {
      db.prepare(
        'INSERT INTO reactions (message_id, name, user_id) VALUES (?, ?, ?)'
      ).run('M001', 'thumbsup', 'U002');

      const result = toggleReaction(db, 'M001', 'thumbsup', 'U002');
      expect(result).toBe('removed');

      const row = db
        .prepare('SELECT * FROM reactions WHERE message_id = ?')
        .get('M001');
      expect(row).toBeUndefined();
    });

    it('should handle multiple users with same reaction', () => {
      toggleReaction(db, 'M001', 'thumbsup', 'U002');
      toggleReaction(db, 'M001', 'thumbsup', 'U003');

      const rows = db
        .prepare('SELECT * FROM reactions WHERE message_id = ? AND name = ?')
        .all('M001', 'thumbsup');
      expect(rows).toHaveLength(2);
    });
  });

  describe('setPinned', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Hello', '1234567890.000001');
    });

    it('should set pinned to true', () => {
      const message = setPinned(db, 'M001', true);
      expect(message?.pinned).toBe(true);
    });

    it('should set pinned to false', () => {
      setPinned(db, 'M001', true);
      const message = setPinned(db, 'M001', false);
      expect(message?.pinned).toBeUndefined();
    });

    it('should return null for non-existent message', () => {
      const message = setPinned(db, 'M999', true);
      expect(message).toBeNull();
    });
  });

  describe('setMessageUnfurls', () => {
    beforeEach(() => {
      db.prepare('INSERT INTO channels (id, name, type) VALUES (?, ?, ?)').run(
        'C001',
        'general',
        'public'
      );
      db.prepare(
        'INSERT INTO messages (id, channel_id, user_id, text, ts) VALUES (?, ?, ?, ?, ?)'
      ).run('M001', 'C001', 'U001', 'Hello', '1234567890.000001');
    });

    it('should set unfurls', () => {
      const unfurls = { 'https://example.com': { title: 'Example' } };
      const message = setMessageUnfurls(
        db,
        'C001',
        '1234567890.000001',
        unfurls
      );
      expect(message?.unfurls).toEqual(unfurls);
    });

    it('should serialize unfurls to JSON', () => {
      const unfurls = { 'https://example.com': { title: 'Example' } };
      setMessageUnfurls(db, 'C001', '1234567890.000001', unfurls);

      const row = db
        .prepare('SELECT unfurls FROM messages WHERE id = ?')
        .get('M001') as { unfurls: string };
      expect(JSON.parse(row.unfurls)).toEqual(unfurls);
    });

    it('should return null for non-existent message', () => {
      const message = setMessageUnfurls(db, 'C001', '9999999999.999999', {});
      expect(message).toBeNull();
    });
  });

  describe('getApps', () => {
    beforeEach(() => {
      db.prepare(
        'INSERT INTO apps (id, name, bot_user_id, bot_user_name, bot_token, app_token, signing_secret, subscribed_events) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'A001',
        'Test App',
        'U001',
        'TestBot',
        'xoxb-test',
        'xapp-test',
        'secret',
        '[]'
      );
    });

    it('should return apps with correct field mapping', () => {
      const apps = getApps(db);
      expect(apps).toHaveLength(1);
      expect(apps[0]).toEqual({
        id: 'A001',
        name: 'Test App',
        botUserId: 'U001',
        botUserName: 'TestBot',
        botToken: 'xoxb-test',
        appToken: 'xapp-test',
        signingSecret: 'secret',
        requestUrl: undefined,
        subscribedEvents: [],
        socketModeEnabled: false,
        description: undefined,
        avatarUrl: undefined,
        slashCommands: [],
        incomingWebhooks: [],
        unfurlDomains: [],
      });
    });

    it('should parse JSON fields', () => {
      db.prepare(
        'UPDATE apps SET subscribed_events = ?, slash_commands = ?, incoming_webhooks = ?, unfurl_domains = ? WHERE id = ?'
      ).run(
        JSON.stringify(['message']),
        JSON.stringify([{ name: 'test' }]),
        JSON.stringify([{ channelId: 'C001', token: 'webhook-token' }]),
        JSON.stringify(['example.com']),
        'A001'
      );

      const apps = getApps(db);
      expect(apps[0].subscribedEvents).toEqual(['message']);
      expect(apps[0].slashCommands).toEqual([{ name: 'test' }]);
      expect(apps[0].incomingWebhooks).toEqual([
        { channelId: 'C001', token: 'webhook-token' },
      ]);
      expect(apps[0].unfurlDomains).toEqual(['example.com']);
    });
  });

  describe('getAppByToken', () => {
    beforeEach(() => {
      db.prepare(
        'INSERT INTO apps (id, name, bot_user_id, bot_user_name, bot_token, app_token, signing_secret, subscribed_events) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'A001',
        'Test App',
        'U001',
        'TestBot',
        'xoxb-test',
        'xapp-test',
        'secret',
        '[]'
      );
    });

    it('should lookup by bot_token', () => {
      const app = getAppByToken(db, 'xoxb-test');
      expect(app?.id).toBe('A001');
    });

    it('should lookup by app_token', () => {
      const app = getAppByToken(db, 'xapp-test');
      expect(app?.id).toBe('A001');
    });

    it('should return null for invalid token', () => {
      const app = getAppByToken(db, 'invalid');
      expect(app).toBeNull();
    });
  });

  describe('getAppByWebhookToken', () => {
    beforeEach(() => {
      db.prepare(
        'INSERT INTO apps (id, name, bot_user_id, bot_user_name, bot_token, app_token, signing_secret, subscribed_events, incoming_webhooks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'A001',
        'Test App',
        'U001',
        'TestBot',
        'xoxb-test',
        'xapp-test',
        'secret',
        '[]',
        JSON.stringify([{ channelId: 'C001', token: 'webhook-token' }])
      );
    });

    it('should return app and channelId for valid webhook token', () => {
      const result = getAppByWebhookToken(db, 'webhook-token');
      expect(result).toEqual({
        app: expect.objectContaining({ id: 'A001' }),
        channelId: 'C001',
      });
    });

    it('should return null for invalid webhook token', () => {
      const result = getAppByWebhookToken(db, 'invalid');
      expect(result).toBeNull();
    });
  });

  describe('updateApp', () => {
    beforeEach(() => {
      db.prepare(
        'INSERT INTO apps (id, name, bot_user_id, bot_user_name, bot_token, app_token, signing_secret, subscribed_events) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        'A001',
        'Test App',
        'U001',
        'TestBot',
        'xoxb-test',
        'xapp-test',
        'secret',
        '[]'
      );
    });

    it('should update requestUrl', () => {
      updateApp(db, 'A001', { requestUrl: 'http://example.com' });
      const row = db
        .prepare('SELECT request_url FROM apps WHERE id = ?')
        .get('A001') as { request_url: string };
      expect(row.request_url).toBe('http://example.com');
    });

    it('should update socketModeEnabled', () => {
      updateApp(db, 'A001', { socketModeEnabled: true });
      const row = db
        .prepare('SELECT socket_mode_enabled FROM apps WHERE id = ?')
        .get('A001') as { socket_mode_enabled: number };
      expect(row.socket_mode_enabled).toBe(1);
    });

    it('should update subscribedEvents', () => {
      updateApp(db, 'A001', { subscribedEvents: ['message', 'app_mention'] });
      const row = db
        .prepare('SELECT subscribed_events FROM apps WHERE id = ?')
        .get('A001') as { subscribed_events: string };
      expect(JSON.parse(row.subscribed_events)).toEqual([
        'message',
        'app_mention',
      ]);
    });

    it('should update multiple fields', () => {
      updateApp(db, 'A001', {
        requestUrl: 'http://example.com',
        socketModeEnabled: true,
        subscribedEvents: ['message'],
      });

      const row = db
        .prepare('SELECT * FROM apps WHERE id = ?')
        .get('A001') as any;
      expect(row.request_url).toBe('http://example.com');
      expect(row.socket_mode_enabled).toBe(1);
      expect(JSON.parse(row.subscribed_events)).toEqual(['message']);
    });
  });

  describe('generateTs', () => {
    it('should generate timestamp in correct format', () => {
      const ts = generateTs();
      const parts = ts.split('.');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^\d{10}$/); // Unix timestamp
      expect(parts[1]).toMatch(/^\d{6}$/); // Counter
    });

    it('should increment counter', () => {
      const ts1 = generateTs();
      const ts2 = generateTs();
      const counter1 = parseInt(ts1.split('.')[1]);
      const counter2 = parseInt(ts2.split('.')[1]);
      expect(counter2).toBe(counter1 + 1);
    });
  });

  describe('generateId', () => {
    it('should generate ID with prefix', () => {
      const id = generateId('U');
      expect(id.startsWith('U')).toBe(true);
    });

    it('should include timestamp', () => {
      const id = generateId('U');
      const timestamp = Date.now().toString();
      expect(id).toContain(timestamp);
    });

    it('should include random suffix', () => {
      const id1 = generateId('U');
      const id2 = generateId('U');
      expect(id1).not.toBe(id2);
    });
  });
});
