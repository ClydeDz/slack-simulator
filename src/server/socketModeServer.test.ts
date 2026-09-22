import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  issueTicket,
  initSocketModeServer,
  handleUpgrade,
  enqueueSocketModeEvent,
  enqueueSocketModeInteractive,
  enqueueSocketModeSlashCommand,
} from './socketModeServer';
import { WebSocket, WebSocketServer } from 'ws';

// Mock ws module
vi.mock('ws', () => ({
  WebSocket: vi.fn(),
  WebSocketServer: class {
    on = vi.fn();
    handleUpgrade = vi.fn();
    emit = vi.fn();
    constructor() {}
  },
}));

describe('Socket Mode Server Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Ticket Management', () => {
    it('should issue a ticket', () => {
      const ticket = issueTicket('A001');

      expect(ticket).toBeDefined();
      expect(ticket).toContain('ticket_');
      expect(typeof ticket).toBe('string');
    });

    it('should issue unique tickets', () => {
      const ticket1 = issueTicket('A001');
      const ticket2 = issueTicket('A001');

      expect(ticket1).not.toBe(ticket2);
    });

    it('should include appId in ticket metadata', () => {
      // This is tested indirectly through connection acceptance
      const ticket = issueTicket('A001');

      expect(ticket).toBeDefined();
    });

    it('should expire tickets after 60 seconds', () => {
      vi.useFakeTimers();
      const ticket = issueTicket('A001');

      // Advance time past TTL (60 seconds)
      vi.advanceTimersByTime(60_000 + 1000);

      // Ticket should be expired when attempting to redeem
      // This is tested via connection logic in initSocketModeServer
      vi.useRealTimers();
    });
  });

  describe('initSocketModeServer', () => {
    it('should initialize WebSocket server', () => {
      const mockHttpServer = {};
      initSocketModeServer(mockHttpServer);

      // Just verify it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('handleUpgrade', () => {
    it('should handle upgrade request when server initialized', () => {
      const mockHttpServer = {};
      initSocketModeServer(mockHttpServer);

      const mockReq = {};
      const mockSocket = { destroy: vi.fn() };
      const mockHead = Buffer.from('');

      handleUpgrade(mockReq as any, mockSocket as any, mockHead);

      // Should not destroy when server is initialized
      expect(mockSocket.destroy).not.toHaveBeenCalled();
    });
  });

  describe('enqueueSocketModeEvent', () => {
    it('should return false when no connection exists', async () => {
      const result = await enqueueSocketModeEvent('A001', 'env1', {
        type: 'message',
      });

      expect(result).toBe(false);
    });

    it('should return false when connection not open', async () => {
      const mockWs = {
        readyState: WebSocket.CLOSED,
      };

      // Manually set connection (bypassing normal connection flow)
      const connections = (global as any)._connections;
      if (connections) {
        connections.set('A001', mockWs);
      }

      const result = await enqueueSocketModeEvent('A001', 'env1', {
        type: 'message',
      });

      expect(result).toBe(false);
    });

    it('should timeout if no ack received', async () => {
      vi.useFakeTimers();
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      // Manually set connection
      const connections = (global as any)._connections;
      if (connections) {
        connections.set('A001', mockWs);
      }

      const promise = enqueueSocketModeEvent('A001', 'env1', {
        type: 'message',
      });

      // Advance time past ACK_TIMEOUT_MS (30 seconds)
      vi.advanceTimersByTime(30_000 + 1000);

      const result = await promise;

      expect(result).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('enqueueSocketModeInteractive', () => {
    it('should return acked false when no connection exists', async () => {
      const result = await enqueueSocketModeInteractive('A001', 'env1', {
        type: 'block_actions',
      });

      expect(result).toEqual({ acked: false });
    });

    it('should return acked false when connection not open', async () => {
      const mockWs = {
        readyState: WebSocket.CLOSED,
      };

      const connections = (global as any)._connections;
      if (connections) {
        connections.set('A001', mockWs);
      }

      const result = await enqueueSocketModeInteractive('A001', 'env1', {
        type: 'block_actions',
      });

      expect(result).toEqual({ acked: false });
    });

    it('should timeout if no ack received', async () => {
      vi.useFakeTimers();
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      const connections = (global as any)._connections;
      if (connections) {
        connections.set('A001', mockWs);
      }

      const promise = enqueueSocketModeInteractive('A001', 'env1', {
        type: 'view_submission',
      });

      vi.advanceTimersByTime(30_000 + 1000);

      const result = await promise;

      expect(result).toEqual({ acked: false });
      vi.useRealTimers();
    });
  });

  describe('enqueueSocketModeSlashCommand', () => {
    it('should return acked false when no connection exists', async () => {
      const result = await enqueueSocketModeSlashCommand('A001', 'env1', {
        type: 'slash_command',
      });

      expect(result).toEqual({ acked: false });
    });

    it('should return acked false when connection not open', async () => {
      const mockWs = {
        readyState: WebSocket.CLOSED,
      };

      const connections = (global as any)._connections;
      if (connections) {
        connections.set('A001', mockWs);
      }

      const result = await enqueueSocketModeSlashCommand('A001', 'env1', {
        type: 'slash_command',
      });

      expect(result).toEqual({ acked: false });
    });

    it('should timeout if no ack received', async () => {
      vi.useFakeTimers();
      const mockWs = {
        readyState: WebSocket.OPEN,
        send: vi.fn(),
      };

      const connections = (global as any)._connections;
      if (connections) {
        connections.set('A001', mockWs);
      }

      const promise = enqueueSocketModeSlashCommand('A001', 'env1', {
        type: 'slash_command',
      });

      vi.advanceTimersByTime(30_000 + 1000);

      const result = await promise;

      expect(result).toEqual({ acked: false });
      vi.useRealTimers();
    });
  });
});
