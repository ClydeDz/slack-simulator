import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerHooks } from './hooks';

// Mock dependencies
vi.mock('../../db', () => ({
  getAppByWebhookToken: vi.fn(),
  insertMessage: vi.fn(),
  generateId: vi.fn(),
  generateTs: vi.fn(),
  getChannel: vi.fn(),
  getApps: vi.fn(),
}));

vi.mock('../../realtime', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../../dispatcher', () => ({
  dispatchEvent: vi.fn(),
}));

describe('Webhook Routes Tests', () => {
  describe('registerHooks', () => {
    it('should export registerHooks function', () => {
      expect(typeof registerHooks).toBe('function');
    });
  });
});
