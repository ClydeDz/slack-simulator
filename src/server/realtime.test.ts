import { describe, it, expect, beforeEach, vi } from 'vitest';
import { broadcast, initRealtimeServer } from './realtime';

describe('Realtime Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('broadcast', () => {
    it('should export broadcast function', () => {
      expect(typeof broadcast).toBe('function');
    });

    it('should do nothing when WSS is not initialized', () => {
      expect(() =>
        broadcast({ type: 'message_new', message: {} as any })
      ).not.toThrow();
    });
  });

  describe('initRealtimeServer', () => {
    it('should export initRealtimeServer function', () => {
      expect(typeof initRealtimeServer).toBe('function');
    });

    it('should initialize WebSocket server and set up upgrade handler', () => {
      const mockHttpServer = {
        on: vi.fn(),
      };

      expect(() => initRealtimeServer(mockHttpServer)).not.toThrow();
      expect(mockHttpServer.on).toHaveBeenCalledWith(
        'upgrade',
        expect.any(Function)
      );
    });
  });
});
