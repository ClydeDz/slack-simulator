import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb } from './db';

interface SeedUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatarSeed: string;
  avatarUrl?: string;
}
interface SeedChannel {
  id: string;
  name: string;
  type: string;
  members: string[];
}
interface SeedDm {
  id: string;
  members: string[];
  type?: string;
}
interface SeedReaction {
  name: string;
  users: string[];
}
interface SeedThreadReply {
  user: string;
  text: string;
  ts_offset: number;
}
interface SeedMessage {
  id: string;
  channel: string;
  user: string;
  text: string;
  ts_offset: number;
  reactions?: SeedReaction[];
  thread_reply?: SeedThreadReply;
}
interface SeedApp {
  id: string;
  name: string;
  botUserId: string;
  botUserName: string;
  botToken: string;
  appToken?: string;
  signingSecret?: string;
  requestUrl?: string;
  subscribedEvents?: string[];
  socketModeEnabled: boolean;
  description?: string;
  avatarUrl?: string;
  slashCommands?: Array<{
    command: string;
    description: string;
    usage?: string;
  }>;
  incomingWebhooks?: string[];
  unfurlDomains?: string[];
}
interface SeedData {
  workspace: {
    id: string;
    name: string;
    domain: string;
    avatarUrl?: string;
    supportedEmojis?: Array<{ name: string; emoji: string }>;
  };
  users: SeedUser[];
  channels: SeedChannel[];
  dms: SeedDm[];
  messages: SeedMessage[];
}

export async function seedDatabase(): Promise<void> {
  const seedPath = path.join(process.cwd(), 'config/seed.json');
  const appsPath = path.join(process.cwd(), 'config/apps.json');

  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const appsData: { apps: SeedApp[] } = JSON.parse(
    fs.readFileSync(appsPath, 'utf8')
  );

  const db = getDb();

  // Use a transaction for atomicity
  const seed = db.transaction(() => {
    // Workspace
    const emojiSet = seedData.workspace.supportedEmojis?.length
      ? JSON.stringify(
          Object.fromEntries(
            seedData.workspace.supportedEmojis.map((e) => [e.name, e.emoji])
          )
        )
      : null;
    db.prepare(
      'INSERT OR REPLACE INTO workspace (id, name, domain, avatar_url, emoji_set) VALUES (?, ?, ?, ?, ?)'
    ).run(
      seedData.workspace.id,
      seedData.workspace.name,
      seedData.workspace.domain,
      seedData.workspace.avatarUrl ?? null,
      emojiSet
    );

    // Users
    for (const u of seedData.users) {
      db.prepare(
        'INSERT OR REPLACE INTO users (id, username, full_name, email, avatar_seed, avatar_url) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        u.id,
        u.username,
        u.fullName,
        u.email,
        u.avatarSeed,
        u.avatarUrl ?? null
      );
    }

    // Channels (public/private)
    for (const c of seedData.channels) {
      db.prepare(
        'INSERT OR REPLACE INTO channels (id, name, type) VALUES (?, ?, ?)'
      ).run(c.id, c.name, c.type);
      for (const memberId of c.members) {
        db.prepare(
          'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
        ).run(c.id, memberId);
      }
    }

    // DMs
    for (const dm of seedData.dms) {
      db.prepare(
        'INSERT OR REPLACE INTO channels (id, name, type) VALUES (?, ?, ?)'
      ).run(dm.id, null, dm.type ?? 'im');
      for (const memberId of dm.members) {
        db.prepare(
          'INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)'
        ).run(dm.id, memberId);
      }
    }

    // Messages
    const totalMessages = seedData.messages.length;
    const baseTs = Math.floor(Date.now() / 1000) - totalMessages * 60;

    const tsByMsgId: Record<string, string> = {};

    for (let i = 0; i < seedData.messages.length; i++) {
      const m = seedData.messages[i];
      const ts = `${baseTs - (totalMessages - i) * 60 + m.ts_offset}.${String(i + 1).padStart(6, '0')}`;
      tsByMsgId[m.id] = ts;

      db.prepare(
        'INSERT OR REPLACE INTO messages (id, channel_id, user_id, text, ts, thread_ts) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(m.id, m.channel, m.user, m.text, ts, null);

      // Reactions
      if (m.reactions) {
        for (const reaction of m.reactions) {
          for (const userId of reaction.users) {
            db.prepare(
              'INSERT OR IGNORE INTO reactions (message_id, name, user_id) VALUES (?, ?, ?)'
            ).run(m.id, reaction.name, userId);
          }
        }
      }

      // Thread reply
      if (m.thread_reply) {
        const replyTs = `${baseTs - (totalMessages - i) * 60 + m.thread_reply.ts_offset}.${String(i + 1000).padStart(6, '0')}`;
        const replyId = `${m.id}_reply`;
        db.prepare(
          'INSERT OR REPLACE INTO messages (id, channel_id, user_id, text, ts, thread_ts) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          replyId,
          m.channel,
          m.thread_reply.user,
          m.thread_reply.text,
          replyTs,
          ts
        );
      }
    }

    // Apps
    for (const app of appsData.apps) {
      // Derive deterministic webhook tokens from appId + channelId + signingSecret
      const webhooks = (app.incomingWebhooks ?? []).map((channelId) => ({
        channelId,
        token: crypto
          .createHash('sha256')
          .update(`${app.id}:${channelId}:${app.signingSecret}`)
          .digest('hex')
          .slice(0, 32),
      }));

      db.prepare(
        `
        INSERT OR REPLACE INTO apps (id, name, bot_user_id, bot_user_name, bot_token, app_token, signing_secret, request_url, subscribed_events, socket_mode_enabled, description, slash_commands, avatar_url, incoming_webhooks, unfurl_domains)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        app.id,
        app.name,
        app.botUserId,
        app.botUserName,
        app.botToken,
        app.appToken ?? '',
        app.signingSecret ?? '',
        app.requestUrl ?? null,
        JSON.stringify(app.subscribedEvents ?? []),
        app.socketModeEnabled ? 1 : 0,
        app.description ?? null,
        JSON.stringify(app.slashCommands ?? []),
        app.avatarUrl ?? null,
        webhooks.length > 0 ? JSON.stringify(webhooks) : null,
        app.unfurlDomains?.length ? JSON.stringify(app.unfurlDomains) : null
      );
    }
  });

  seed();

  // Write credentials file — one entry per app
  const dir = path.join(process.cwd(), '.slack-simulator');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const creds: Record<string, unknown> = {
    SLACK_API_URL: 'http://localhost:4500/api/',
    apps: appsData.apps.map((app) => ({
      id: app.id,
      name: app.name,
      SLACK_BOT_TOKEN: app.botToken,
      SLACK_SIGNING_SECRET: app.signingSecret,
      SLACK_APP_TOKEN: app.appToken,
    })),
  };
  fs.writeFileSync(
    path.join(dir, 'credentials.json'),
    JSON.stringify(creds, null, 2)
  );

  console.log('Database seeded successfully');
}

export async function resetDatabase(): Promise<void> {
  const db = getDb();

  // Clear all data
  db.transaction(() => {
    db.prepare('DELETE FROM reactions').run();
    db.prepare('DELETE FROM messages').run();
    db.prepare('DELETE FROM channel_members').run();
    db.prepare('DELETE FROM channels').run();
    db.prepare('DELETE FROM users').run();
    db.prepare('DELETE FROM apps').run();
    db.prepare('DELETE FROM workspace').run();
  })();

  await seedDatabase();
}
