// history — a pure, bounded undo/redo stack with change coalescing.
//
// Used by ComponentRegistryProvider to give every tree mutation
// (setCurrentPage / updateInstanceProps / deleteNode / duplicateNode /
// pasteNode / addChild — they all funnel through one applyChange) undo/redo
// for free. Kept free of React so the stack semantics are unit-testable.
//
// Coalescing: rapid successive changes carrying the SAME non-null
// `coalesceKey` (e.g. "props:<instanceId>:<fieldKey>" while typing into a
// text input) within `coalesceWindowMs` collapse into ONE undo step — the
// past snapshot of the first change in the burst is kept, later ones only
// replace `present`. Any other change (different key, no key, window
// elapsed, or an undo/redo in between) breaks the burst.

export const DEFAULT_HISTORY_LIMIT = 100;
export const DEFAULT_COALESCE_WINDOW_MS = 500;

export interface HistoryState<T> {
  /** The current value. */
  present: T;
  /** Undo snapshots, oldest first. */
  past: T[];
  /** Redo snapshots, nearest first. */
  future: T[];
  /** Coalesce key of the last applied change (null = not coalescible). */
  lastCoalesceKey: string | null;
  /** Timestamp (ms) of the last applied change. */
  lastChangeTime: number;
}

export interface ApplyHistoryChangeOptions {
  /**
   * Non-null makes the change coalescible: an immediately-following change
   * with the same key (within the window) replaces `present` without
   * pushing another undo snapshot.
   */
  coalesceKey?: string | null;
  /** Coalesce window in ms (default {@link DEFAULT_COALESCE_WINDOW_MS}). */
  coalesceWindowMs?: number;
  /** Max undo-stack depth (default {@link DEFAULT_HISTORY_LIMIT}). */
  limit?: number;
  /** Clock override for tests (default Date.now()). */
  now?: number;
}

export function createHistory<T>(present: T): HistoryState<T> {
  return {
    present,
    past: [],
    future: [],
    lastCoalesceKey: null,
    lastChangeTime: 0,
  };
}

/**
 * Apply a new value as a change. Pushes the previous `present` onto the undo
 * stack (unless coalesced), clears the redo stack, and enforces the depth
 * limit by dropping the oldest snapshots. Returns the input state unchanged
 * (same reference) when `next` is reference-equal to `present`.
 */
export function applyHistoryChange<T>(
  history: HistoryState<T>,
  next: T,
  options: ApplyHistoryChangeOptions = {}
): HistoryState<T> {
  if (next === history.present) return history;

  const {
    coalesceKey = null,
    coalesceWindowMs = DEFAULT_COALESCE_WINDOW_MS,
    limit = DEFAULT_HISTORY_LIMIT,
    now = Date.now(),
  } = options;

  const coalesce =
    coalesceKey !== null &&
    coalesceKey === history.lastCoalesceKey &&
    now - history.lastChangeTime <= coalesceWindowMs;

  let past = coalesce ? history.past : [...history.past, history.present];
  if (past.length > limit) {
    past = past.slice(past.length - limit);
  }

  return {
    present: next,
    past,
    future: [],
    lastCoalesceKey: coalesceKey,
    lastChangeTime: now,
  };
}

/**
 * Step back one change. No-op (same reference) when the undo stack is empty.
 * Breaks any coalescing burst: the next change always gets its own step.
 */
export function undoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0) return history;
  return {
    present: history.past[history.past.length - 1],
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
    lastCoalesceKey: null,
    lastChangeTime: 0,
  };
}

/**
 * Step forward one undone change. No-op (same reference) when the redo stack
 * is empty.
 */
export function redoHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.future.length === 0) return history;
  return {
    present: history.future[0],
    past: [...history.past, history.present],
    future: history.future.slice(1),
    lastCoalesceKey: null,
    lastChangeTime: 0,
  };
}

/**
 * Drop both stacks, keeping `present`. Used on page switches so undo never
 * crosses page boundaries. No-op (same reference) when already empty.
 */
export function clearHistory<T>(history: HistoryState<T>): HistoryState<T> {
  if (history.past.length === 0 && history.future.length === 0) {
    return history;
  }
  return createHistory(history.present);
}
