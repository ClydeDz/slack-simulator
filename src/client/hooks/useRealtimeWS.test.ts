import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { useRealtimeWS } from './useRealtimeWS';
import { useStore } from '../store';

// Mock the store at the top level
vi.mock('../store');

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onopen: (() => void) | null = null;
  readyState: number = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }

  send(data: string) {
    // Mock send
  }

  static reset() {
    MockWebSocket.instances = [];
  }
}

describe('useRealtimeWS', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    MockWebSocket.reset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('should establish WebSocket connection on mount', () => {
    const mockApplyWsEvent = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockApplyWsEvent);

    renderHook(() => useRealtimeWS());

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:3000/_ws');
  });

  it('should call applyWsEvent when message received', () => {
    const mockApplyWsEvent = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockApplyWsEvent);

    renderHook(() => useRealtimeWS());

    const ws = MockWebSocket.instances[0];
    const testEvent = {
      type: 'message_new',
      message: { id: 'M001', text: 'test' },
    };

    if (ws.onmessage) {
      ws.onmessage({ data: JSON.stringify(testEvent) } as MessageEvent);
    }

    expect(mockApplyWsEvent).toHaveBeenCalledWith(testEvent);
  });

  it('should ignore malformed messages', () => {
    const mockApplyWsEvent = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockApplyWsEvent);

    renderHook(() => useRealtimeWS());

    const ws = MockWebSocket.instances[0];

    if (ws.onmessage) {
      ws.onmessage({ data: 'invalid json' } as MessageEvent);
    }

    expect(mockApplyWsEvent).not.toHaveBeenCalled();
  });

  it('should reconnect on connection close', () => {
    const mockApplyWsEvent = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockApplyWsEvent);
    vi.useFakeTimers();

    renderHook(() => useRealtimeWS());

    const ws = MockWebSocket.instances[0];
    MockWebSocket.reset(); // Clear the first instance

    if (ws.onclose) {
      ws.onclose();
    }

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);

    expect(MockWebSocket.instances).toHaveLength(1);
    vi.useRealTimers();
  });

  it('should not reconnect after unmount', () => {
    const mockApplyWsEvent = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockApplyWsEvent);
    vi.useFakeTimers();

    const { unmount } = renderHook(() => useRealtimeWS());

    const ws = MockWebSocket.instances[0];
    MockWebSocket.reset();

    unmount();

    if (ws.onclose) {
      ws.onclose();
    }

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);

    expect(MockWebSocket.instances).toHaveLength(0);
    vi.useRealTimers();
  });

  it('should close WebSocket on unmount', () => {
    const mockApplyWsEvent = vi.fn();
    vi.mocked(useStore).mockReturnValue(mockApplyWsEvent);

    const { unmount } = renderHook(() => useRealtimeWS());

    const ws = MockWebSocket.instances[0];
    expect(ws.readyState).not.toBe(3); // Not CLOSED

    unmount();

    expect(ws.readyState).toBe(3); // CLOSED
  });
});
