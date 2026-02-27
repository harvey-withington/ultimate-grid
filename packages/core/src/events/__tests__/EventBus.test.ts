import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../EventBus';
import type { ScrollEvent, SortChangedEvent } from '../../types';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ─── on / emit ─────────────────────────────────────────────────────────────

  describe('on / emit', () => {
    it('calls a registered handler when event is emitted', () => {
      const handler = vi.fn();
      bus.on('scroll', handler);
      const payload: ScrollEvent = { type: 'scroll', scrollTop: 100, scrollLeft: 0 };
      bus.emit('scroll', payload);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('calls multiple handlers for the same event in order', () => {
      const calls: number[] = [];
      bus.on('scroll', () => calls.push(1));
      bus.on('scroll', () => calls.push(2));
      bus.on('scroll', () => calls.push(3));
      bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 });
      expect(calls).toEqual([1, 2, 3]);
    });

    it('does not call handlers for a different event', () => {
      const handler = vi.fn();
      bus.on('scroll', handler);
      bus.emit('rowDataChanged', { type: 'rowDataChanged' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('emitting with no handlers is a no-op', () => {
      expect(() =>
        bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 }),
      ).not.toThrow();
    });

    it('passes the exact payload object to the handler', () => {
      let received: SortChangedEvent | null = null;
      bus.on('sortChanged', (e) => { received = e; });
      const payload: SortChangedEvent = {
        type: 'sortChanged',
        sortState: [{ colId: 'name', direction: 'asc', index: 0 }],
      };
      bus.emit('sortChanged', payload);
      expect(received).toBe(payload);
    });

    it('supports custom plugin events via the string index signature', () => {
      const handler = vi.fn();
      const eventKey = 'myPlugin:customEvent';
      // Cast through the index signature — plugins extend GridEventMap with custom keys
      (bus.on as (e: string, h: (ev: unknown) => void) => () => void)(eventKey, handler);
      (bus.emit as (e: string, p: unknown) => void)(eventKey, { type: eventKey });
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ─── off ───────────────────────────────────────────────────────────────────

  describe('off', () => {
    it('removes a registered handler', () => {
      const handler = vi.fn();
      bus.on('scroll', handler);
      bus.off('scroll', handler);
      bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('is a no-op when handler was never registered', () => {
      expect(() => bus.off('scroll', vi.fn())).not.toThrow();
    });

    it('only removes the specified handler, not others', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('scroll', h1);
      bus.on('scroll', h2);
      bus.off('scroll', h1);
      bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 });
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  // ─── unsubscribe function ──────────────────────────────────────────────────

  describe('unsubscribe return value', () => {
    it('calling the returned function unsubscribes the handler', () => {
      const handler = vi.fn();
      const unsub = bus.on('scroll', handler);
      unsub();
      bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 });
      expect(handler).not.toHaveBeenCalled();
    });

    it('calling unsub twice is safe', () => {
      const unsub = bus.on('scroll', vi.fn());
      unsub();
      expect(() => unsub()).not.toThrow();
    });
  });

  // ─── error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('rethrows a single handler error', () => {
      bus.on('scroll', () => { throw new Error('boom'); });
      expect(() =>
        bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 }),
      ).toThrow('boom');
    });

    it('runs all handlers even if one throws, then rethrows', () => {
      const h2 = vi.fn();
      bus.on('scroll', () => { throw new Error('first'); });
      bus.on('scroll', h2);
      expect(() =>
        bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 }),
      ).toThrow();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('wraps multiple handler errors in a single thrown error', () => {
      bus.on('scroll', () => { throw new Error('err1'); });
      bus.on('scroll', () => { throw new Error('err2'); });
      let caught: Error & { errors?: unknown[] } | null = null;
      try {
        bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 });
      } catch (e) {
        caught = e as Error & { errors?: unknown[] };
      }
      expect(caught).not.toBeNull();
      expect(caught!.errors).toHaveLength(2);
    });
  });

  // ─── listenerCount ─────────────────────────────────────────────────────────

  describe('listenerCount', () => {
    it('returns 0 for event with no handlers', () => {
      expect(bus.listenerCount('scroll')).toBe(0);
    });

    it('returns correct count after subscriptions', () => {
      bus.on('scroll', vi.fn());
      bus.on('scroll', vi.fn());
      expect(bus.listenerCount('scroll')).toBe(2);
    });

    it('decrements after off', () => {
      const h = vi.fn();
      bus.on('scroll', h);
      bus.off('scroll', h);
      expect(bus.listenerCount('scroll')).toBe(0);
    });
  });

  // ─── clear ─────────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all handlers for a specific event', () => {
      bus.on('scroll', vi.fn());
      bus.on('scroll', vi.fn());
      bus.clear('scroll');
      expect(bus.listenerCount('scroll')).toBe(0);
    });

    it('does not affect handlers for other events', () => {
      bus.on('scroll', vi.fn());
      bus.on('rowDataChanged', vi.fn());
      bus.clear('scroll');
      expect(bus.listenerCount('rowDataChanged')).toBe(1);
    });

    it('clears all events when called with no argument', () => {
      bus.on('scroll', vi.fn());
      bus.on('rowDataChanged', vi.fn());
      bus.on('sortChanged', vi.fn());
      bus.clear();
      expect(bus.listenerCount('scroll')).toBe(0);
      expect(bus.listenerCount('rowDataChanged')).toBe(0);
      expect(bus.listenerCount('sortChanged')).toBe(0);
    });
  });

  // ─── same handler registered twice ─────────────────────────────────────────

  describe('deduplication', () => {
    it('registering the same handler twice only calls it once (Set behaviour)', () => {
      const handler = vi.fn();
      bus.on('scroll', handler);
      bus.on('scroll', handler);
      bus.emit('scroll', { type: 'scroll', scrollTop: 0, scrollLeft: 0 });
      expect(handler).toHaveBeenCalledOnce();
    });
  });
});
