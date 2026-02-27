import type { EventBus as IEventBus, GridEventMap } from '../types';

type Handler<T> = (event: T) => void;

/**
 * EventBus
 *
 * Typed pub/sub bus for all internal grid communication.
 * Plugins and models communicate exclusively through here — nothing calls
 * another module's methods directly.
 *
 * - `on`  → subscribe, returns an unsubscribe function
 * - `off` → unsubscribe by reference
 * - `emit` → synchronous dispatch to all registered handlers
 *
 * Handlers are called in subscription order.
 * Errors in one handler do not prevent others from running.
 */
export class EventBus implements IEventBus {
  private readonly _handlers = new Map<string, Set<Handler<unknown>>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function for convenient
   * cleanup in useEffect / onUnmounted / ngOnDestroy style patterns.
   */
  on<K extends keyof GridEventMap>(
    event: K,
    handler: Handler<GridEventMap[K]>,
  ): () => void {
    let bucket = this._handlers.get(event as string);
    if (!bucket) {
      bucket = new Set();
      this._handlers.set(event as string, bucket);
    }
    bucket.add(handler as Handler<unknown>);
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe a previously registered handler.
   * No-op if the handler was never registered.
   */
  off<K extends keyof GridEventMap>(
    event: K,
    handler: Handler<GridEventMap[K]>,
  ): void {
    this._handlers.get(event as string)?.delete(handler as Handler<unknown>);
  }

  /**
   * Emit an event synchronously.
   * All handlers receive the payload before this call returns.
   * Handler errors are caught and re-thrown after all handlers have run,
   * so one bad plugin cannot silently swallow others.
   */
  emit<K extends keyof GridEventMap>(event: K, payload: GridEventMap[K]): void {
    const bucket = this._handlers.get(event as string);
    if (!bucket || bucket.size === 0) return;

    const errors: unknown[] = [];
    for (const handler of bucket) {
      try {
        handler(payload);
      } catch (err) {
        errors.push(err);
      }
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) {
      const multi = new Error(
        `EventBus: ${errors.length} handler(s) threw on event "${String(event)}"`,
      );
      (multi as Error & { errors: unknown[] }).errors = errors;
      throw multi;
    }
  }

  /**
   * Remove all handlers for a specific event, or all handlers if no event
   * is specified. Useful in tests and on grid destroy.
   */
  clear(event?: keyof GridEventMap): void {
    if (event !== undefined) {
      this._handlers.delete(event as string);
    } else {
      this._handlers.clear();
    }
  }

  /**
   * Returns the number of handlers registered for a given event.
   * Primarily useful for testing.
   */
  listenerCount(event: keyof GridEventMap): number {
    return this._handlers.get(event as string)?.size ?? 0;
  }
}
