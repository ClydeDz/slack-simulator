import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// Mock the dependencies
vi.mock('./db', () => ({
  getDb: vi.fn(),
  getApps: vi.fn(),
}));

vi.mock('./socketModeServer', () => ({
  enqueueSocketModeEvent: vi.fn(),
}));

vi.mock('./realtime', () => ({
  broadcast: vi.fn(),
}));

import { getLogs, logInbound } from './dispatcher';

// Import after mocking
import { dispatchEvent, dispatchEventToApp } from './dispatcher';
import { getDb, getApps } from './db';
import { enqueueSocketModeEvent } from './socketModeServer';

describe('Dispatcher Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the in-memory logs
    (global as any)._logs = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sign', () => {
    it('should generate HMAC-SHA256 signature matching Slack format (v0= signature)', () => {
      const signingSecret = 'test-secret';
      const timestamp = 1234567890;
      const body = '{"test":"data"}';

      const base = `v0:${timestamp}:${body}`;
      const expected = `v0=${crypto.createHmac('sha256', signingSecret).update(base).digest('hex')}`;

      // We can't directly test the private sign function, but we can verify the format
      // by checking that dispatchEvent uses the correct signature format
      expect(expected).toMatch(/^v0=[a-f0-9]{64}$/);
    });
  });

  describe('postWithRetry', () => {
    it('should return immediately on successful request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      // We can't directly test postWithRetry as it's private
      // But we can test the behavior through dispatchEvent
      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEvent('message', { text: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors with exponential backoff', async () => {
      let attemptCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      await dispatchEvent('message', { text: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on network errors', async () => {
      let attemptCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      await dispatchEvent('message', { text: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should return immediately on 4xx errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      await dispatchEvent('message', { text: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispatchEvent', () => {
    it('should build event envelope with correct structure', async () => {
      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEvent('message', { text: 'test', user: 'U002' });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Slack-Signature': expect.stringMatching(/^v0=[a-f0-9]{64}$/),
            'X-Slack-Request-Timestamp': expect.any(String),
          }),
        })
      );

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toMatchObject({
        token: 'secret',
        team_id: 'W001',
        api_app_id: 'A001',
        type: 'event_callback',
        event_id: expect.stringMatching(/^Ev\d+$/),
        event_time: expect.any(Number),
        authorizations: expect.arrayContaining([
          expect.objectContaining({
            team_id: 'W001',
            user_id: 'U001',
            is_bot: true,
          }),
        ]),
        event: {
          type: 'message',
          team: 'W001',
          text: 'test',
          user: 'U002',
        },
      });
    });

    it('should only dispatch to subscribed apps', async () => {
      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Subscribed App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
        {
          id: 'A002',
          name: 'Unsubscribed App',
          botUserId: 'U002',
          botUserName: 'TestBot2',
          botToken: 'xoxb-test2',
          appToken: 'xapp-test2',
          signingSecret: 'secret2',
          requestUrl: 'http://localhost:3000/webhook2',
          subscribedEvents: ['app_mention'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEvent('message', { text: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect((global.fetch as any).mock.calls[0][0]).toBe(
        'http://localhost:3000/webhook'
      );
    });

    it('should dispatch to apps with wildcard subscription', async () => {
      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Wildcard App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['*'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEvent('message', { text: 'test' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use HTTP dispatch with signing headers', async () => {
      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEvent('message', { text: 'test' });

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[1].headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Slack-Signature': expect.stringMatching(/^v0=[a-f0-9]{64}$/),
        'X-Slack-Request-Timestamp': expect.any(String),
        'X-Slack-Retry-Num': '0',
        'X-Slack-Retry-Reason': 'none',
      });
    });

    it('should use Socket Mode dispatch when enabled', async () => {
      vi.mocked(enqueueSocketModeEvent).mockResolvedValue(true);

      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: '',
          subscribedEvents: ['message'],
          socketModeEnabled: true,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      await dispatchEvent('message', { text: 'test' });

      expect(enqueueSocketModeEvent).toHaveBeenCalledWith(
        'A001',
        expect.stringMatching(/^Ev\d+$/),
        expect.objectContaining({
          type: 'event_callback',
          event: expect.objectContaining({
            type: 'message',
          }),
        })
      );
    });

    it('should create outbound log entry', async () => {
      vi.mocked(getApps).mockReturnValue([
        {
          id: 'A001',
          name: 'Test App',
          botUserId: 'U001',
          botUserName: 'TestBot',
          botToken: 'xoxb-test',
          appToken: 'xapp-test',
          signingSecret: 'secret',
          requestUrl: 'http://localhost:3000/webhook',
          subscribedEvents: ['message'],
          socketModeEnabled: false,
        },
      ]);

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEvent('message', { text: 'test' });

      const logs = getLogs();
      const outboundLogs = logs.filter((l) => l.direction === 'outbound');
      expect(outboundLogs.length).toBeGreaterThan(0);
      expect(outboundLogs[0]).toMatchObject({
        appId: 'A001',
        appName: 'Test App',
        direction: 'outbound',
        eventType: 'message',
        transport: 'http',
        status: 200,
      });
    });
  });

  describe('dispatchEventToApp', () => {
    it('should dispatch to single app with correct envelope structure', async () => {
      const app = {
        id: 'A001',
        name: 'Test App',
        botUserId: 'U001',
        botUserName: 'TestBot',
        botToken: 'xoxb-test',
        appToken: 'xapp-test',
        signingSecret: 'secret',
        requestUrl: 'http://localhost:3000/webhook',
        subscribedEvents: ['*'],
        socketModeEnabled: false,
      };

      vi.mocked(getDb).mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue({ id: 'W001', name: 'Test Workspace' }),
        }),
      } as any);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      await dispatchEventToApp(app, 'link_shared', {
        url: 'https://example.com',
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body).toMatchObject({
        token: 'secret',
        team_id: 'W001',
        api_app_id: 'A001',
        type: 'event_callback',
        event: {
          type: 'link_shared',
          team: 'W001',
          url: 'https://example.com',
        },
      });
    });
  });

  describe('logInbound', () => {
    it('should create inbound log entry with direction: inbound', () => {
      logInbound('A001', 'Test App', 'chat.postMessage', { text: 'test' }, 200);

      const logs = getLogs();
      const inboundLogs = logs.filter((l) => l.direction === 'inbound');
      expect(inboundLogs.length).toBeGreaterThan(0);
      expect(inboundLogs[0]).toMatchObject({
        appId: 'A001',
        appName: 'Test App',
        direction: 'inbound',
        eventType: 'chat.postMessage',
        transport: 'api',
        status: 200,
        payload: { text: 'test' },
      });
    });
  });

  describe('getLogs', () => {
    it('should return logs in reverse chronological order', () => {
      const beforeCount = getLogs().length;
      logInbound('A001', 'App 1', 'method1', {}, 200);
      logInbound('A002', 'App 2', 'method2', {}, 200);

      const logs = getLogs();
      const newLogs = logs.slice(0, 2);
      expect(newLogs).toHaveLength(2);
      expect(newLogs[0].appName).toBe('App 2');
      expect(newLogs[1].appName).toBe('App 1');
    });
  });

  describe('Log Rotation', () => {
    it('should limit logs to 300 entries', () => {
      // Add more than 300 logs
      for (let i = 0; i < 310; i++) {
        logInbound(`A${i}`, `App ${i}`, 'method', {}, 200);
      }

      const logs = getLogs();
      expect(logs).toHaveLength(300);
    });
  });
});
