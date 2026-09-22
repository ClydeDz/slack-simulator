import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  issueTrigger,
  redeemTrigger,
  storeModal,
  getModal,
  deleteModal,
  dispatchBlockActions,
  dispatchViewSubmission,
  dispatchViewClosed,
  openModal,
  updateModal,
  pushModal,
} from './interactivity';
import type { App, ModalView } from '../shared/types';
import { broadcast } from './realtime';

// Mock dependencies
vi.mock('./realtime', () => ({
  broadcast: vi.fn(),
}));

vi.mock('./socketModeServer', () => ({
  enqueueSocketModeInteractive: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('Interactivity Tests', () => {
  let mockApp: App;
  let mockView: ModalView;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockApp = {
      id: 'A001',
      name: 'Test App',
      botUserId: 'U003',
      botUserName: 'testbot',
      botToken: 'xoxb-test-token',
      appToken: 'xapp-test-token',
      signingSecret: 'test-secret',
      requestUrl: 'https://example.com/webhook',
      subscribedEvents: ['message'],
      socketModeEnabled: false,
    };

    mockView = {
      id: 'V001',
      type: 'modal',
      title: { type: 'plain_text', text: 'Test Modal' },
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Close' },
      blocks: [
        {
          type: 'section',
          text: { type: 'plain_text', text: 'Section text' },
        },
      ],
      callback_id: 'test_callback',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Trigger ID Management', () => {
    it('should issue a trigger ID', () => {
      const triggerId = issueTrigger('A001');

      expect(triggerId).toBeDefined();
      expect(typeof triggerId).toBe('string');
      expect(triggerId).toContain('A001');
    });

    it('should redeem a valid trigger ID', () => {
      const triggerId = issueTrigger('A001');
      const appId = redeemTrigger(triggerId);

      expect(appId).toBe('A001');
    });

    it('should return null for invalid trigger ID', () => {
      const appId = redeemTrigger('invalid-trigger-id');

      expect(appId).toBeNull();
    });

    it('should return null for expired trigger ID', () => {
      vi.useFakeTimers();
      const triggerId = issueTrigger('A001');

      // Advance time past TTL (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

      const appId = redeemTrigger(triggerId);

      expect(appId).toBeNull();
      vi.useRealTimers();
    });

    it('should consume trigger ID on redemption', () => {
      const triggerId = issueTrigger('A001');

      redeemTrigger(triggerId);
      const appId = redeemTrigger(triggerId);

      expect(appId).toBeNull();
    });
  });

  describe('Modal Store', () => {
    it('should store a modal', () => {
      storeModal(mockView, 'A001');

      const entry = getModal('V001');

      expect(entry).toBeDefined();
      expect(entry?.view).toEqual(mockView);
      expect(entry?.appId).toBe('A001');
    });

    it('should retrieve a stored modal', () => {
      storeModal(mockView, 'A001');

      const entry = getModal('V001');

      expect(entry?.view.id).toBe('V001');
    });

    it('should return undefined for non-existent modal', () => {
      const entry = getModal('non-existent');

      expect(entry).toBeUndefined();
    });

    it('should delete a modal', () => {
      storeModal(mockView, 'A001');
      deleteModal('V001');

      const entry = getModal('V001');

      expect(entry).toBeUndefined();
    });
  });

  describe('openModal', () => {
    it('should open a new modal', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'New Modal' },
        blocks: [],
      };

      const view = openModal(rawView, 'A001');

      expect(view.id).toBeDefined();
      expect(view.type).toBe('modal');
      expect(view.title).toEqual(rawView.title);
    });

    it('should store the modal in the modal store', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'New Modal' },
        blocks: [],
      };

      const view = openModal(rawView, 'A001');

      const entry = getModal(view.id);

      expect(entry).toBeDefined();
      expect(entry?.appId).toBe('A001');
    });

    it('should broadcast modal_open event', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'New Modal' },
        blocks: [],
      };

      openModal(rawView, 'A001');

      expect(vi.mocked(broadcast)).toHaveBeenCalledWith({
        type: 'modal_open',
        view: expect.any(Object),
        appId: 'A001',
      });
    });
  });

  describe('updateModal', () => {
    it('should update an existing modal', () => {
      storeModal(mockView, 'A001');

      const rawView = {
        title: { type: 'plain_text', text: 'Updated Modal' },
        blocks: [],
      };

      const updatedView = updateModal('V001', rawView);

      expect(updatedView).toBeDefined();
      expect(updatedView?.title.text).toBe('Updated Modal');
    });

    it('should return null for non-existent modal', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'Updated Modal' },
        blocks: [],
      };

      const result = updateModal('non-existent', rawView);

      expect(result).toBeNull();
    });

    it('should broadcast modal_update event', () => {
      storeModal(mockView, 'A001');

      const rawView = {
        title: { type: 'plain_text', text: 'Updated Modal' },
        blocks: [],
      };

      updateModal('V001', rawView);

      expect(vi.mocked(broadcast)).toHaveBeenCalledWith({
        type: 'modal_update',
        view: expect.any(Object),
      });
    });
  });

  describe('pushModal', () => {
    it('should push a new modal', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'Pushed Modal' },
        blocks: [],
      };

      const view = pushModal(rawView, 'A001');

      expect(view.id).toBeDefined();
      expect(view.type).toBe('modal');
    });

    it('should store the pushed modal', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'Pushed Modal' },
        blocks: [],
      };

      const view = pushModal(rawView, 'A001');

      const entry = getModal(view.id);

      expect(entry).toBeDefined();
      expect(entry?.appId).toBe('A001');
    });

    it('should broadcast modal_push event', () => {
      const rawView = {
        title: { type: 'plain_text', text: 'Pushed Modal' },
        blocks: [],
      };

      pushModal(rawView, 'A001');

      expect(vi.mocked(broadcast)).toHaveBeenCalledWith({
        type: 'modal_push',
        view: expect.any(Object),
        appId: 'A001',
      });
    });
  });

  describe('dispatchBlockActions', () => {
    it('should dispatch block action via HTTP when socket mode disabled', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      } as unknown as Response);

      await dispatchBlockActions({
        app: mockApp,
        channelId: 'C001',
        messageTs: '1234567890.123456',
        blockId: 'B001',
        actionId: 'action1',
        value: 'test-value',
        userId: 'U001',
        teamId: 'T001',
      });

      expect(fetch).toHaveBeenCalled();
    });

    it('should include button action in payload', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      } as unknown as Response);

      await dispatchBlockActions({
        app: mockApp,
        channelId: 'C001',
        messageTs: '1234567890.123456',
        blockId: 'B001',
        actionId: 'action1',
        value: 'test-value',
        userId: 'U001',
        teamId: 'T001',
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;
      const payload = JSON.parse(JSON.parse(body).payload);

      expect(payload.actions[0].type).toBe('button');
      expect(payload.actions[0].value).toBe('test-value');
    });

    it('should include static_select action in payload', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      } as unknown as Response);

      await dispatchBlockActions({
        app: mockApp,
        channelId: 'C001',
        messageTs: '1234567890.123456',
        blockId: 'B001',
        actionId: 'action1',
        selectedOption: {
          text: { type: 'plain_text', text: 'Option 1' },
          value: 'opt1',
        },
        userId: 'U001',
        teamId: 'T001',
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;
      const payload = JSON.parse(JSON.parse(body).payload);

      expect(payload.actions[0].type).toBe('static_select');
      expect(payload.actions[0].selected_option).toBeDefined();
    });

    it('should handle bot offline gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await dispatchBlockActions({
        app: mockApp,
        channelId: 'C001',
        messageTs: '1234567890.123456',
        blockId: 'B001',
        actionId: 'action1',
        userId: 'U001',
        teamId: 'T001',
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('dispatchViewSubmission', () => {
    it('should dispatch view submission via HTTP', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ response_action: 'clear' }),
      } as unknown as Response);

      const result = await dispatchViewSubmission({
        app: mockApp,
        view: mockView,
        userId: 'U001',
        teamId: 'T001',
        values: {},
      });

      expect(result).toEqual({ response_action: 'clear' });
    });

    it('should include view state in payload', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      } as unknown as Response);

      await dispatchViewSubmission({
        app: mockApp,
        view: mockView,
        userId: 'U001',
        teamId: 'T001',
        values: {},
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;
      const payload = JSON.parse(JSON.parse(body).payload);

      expect(payload.view.state).toEqual({ values: {} });
    });
  });

  describe('dispatchViewClosed', () => {
    it('should dispatch view closed event via HTTP', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      } as unknown as Response);

      await dispatchViewClosed({
        app: mockApp,
        view: mockView,
        userId: 'U001',
        teamId: 'T001',
      });

      expect(fetch).toHaveBeenCalled();
    });

    it('should include is_cleared flag in payload', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      } as unknown as Response);

      await dispatchViewClosed({
        app: mockApp,
        view: mockView,
        userId: 'U001',
        teamId: 'T001',
      });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      const body = fetchCall[1]?.body as string;
      const payload = JSON.parse(JSON.parse(body).payload);

      expect(payload.is_cleared).toBe(false);
    });
  });
});
