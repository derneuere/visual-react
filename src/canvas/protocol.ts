// Canvas bridge protocol — the typed API between an editor (parent window)
// and its canvas iframe.
//
// Same-origin DIRECT API, no postMessage: the iframe publishes a bridge
// object on its own `window` under a configurable global key (default
// {@link DEFAULT_CANVAS_BRIDGE_GLOBAL}), the parent polls the iframe's
// `contentWindow` for it after load and calls `connect(callbacks)`. Both
// sides share one process, so plain typed function calls are simpler and
// synchronous than message passing.
//
// Data flow: the PARENT owns the Instance tree, the selection state and
// every mutation; the iframe is a pure renderer + interaction reporter.
// Content is pushed parent -> iframe (never loaded by the canvas route
// itself) because the canvas must always show the unsaved draft.
//
// Instance ids cross the bridge as strings — `String(instanceId)` — because
// ids may be numbers or strings in stored content. The parent resolves them
// back to real ids (see `findInstanceByBridgeId`).

import type { Instance } from "../registry/types";

/** Default window-global key the iframe publishes its bridge under. */
export const DEFAULT_CANVAS_BRIDGE_GLOBAL = "__visualReactCanvasBridge";

/** Viewport-relative rect of a rendered instance (getBoundingClientRect). */
export interface CanvasRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CanvasRectMap {
  /** Keyed by String(instanceId); rects are iframe-viewport-relative. */
  rects: Record<string, CanvasRect>;
  scrollX: number;
  scrollY: number;
}

export type CanvasDropPosition = "above" | "below" | "into";

export interface CanvasDropIndicator {
  /** Bridge id (String(instanceId)) of the indicator's anchor instance. */
  instanceId: string;
  position: CanvasDropPosition;
}

/** Completed bridge-native drag: move `active` relative to `target`. */
export interface CanvasDropEvent {
  activeInstanceId: string;
  targetInstanceId: string;
  position: CanvasDropPosition;
}

/** Callbacks the parent registers; the iframe reports interactions through them. */
export interface CanvasHostCallbacks {
  onReady: () => void;
  /** Instance ids cross the bridge as String(instanceId); null = page background. */
  onSelect: (instanceId: string | null) => void;
  onHover: (instanceId: string | null) => void;
  /** Delete/Backspace/Escape are forwarded so editor shortcuts work while the iframe has focus. */
  onKeyDown: (event: { key: string }) => void;
  onScroll: () => void;
  onRectsChanged: () => void;
  /**
   * A widget was dragged inside the canvas and dropped on a valid target.
   * The PARENT performs the tree mutation (e.g. `moveInstance`) and pushes
   * the result back down via `setContent`.
   */
  onCanvasDrop: (drop: CanvasDropEvent) => void;
}

/** API the iframe exposes on its window under the bridge global key. */
export interface CanvasBridgeApi {
  connect: (host: CanvasHostCallbacks) => void;
  disconnect: () => void;
  setContent: (content: Instance[]) => void;
  /** Generic JSON side channel for whatever page-level data the renderer needs. */
  setPageData: (data: unknown) => void;
  setSelection: (instanceId: string | null) => void;
  setHover: (instanceId: string | null) => void;
  setDropIndicator: (indicator: CanvasDropIndicator | null) => void;
  /**
   * true = edit input: clicks select widgets, hover/keys are reported and the
   * overlay renders. false (default) = read-only preview: nothing is reported
   * and no overlay renders. Clicks (incl. links) are swallowed in BOTH states.
   */
  setInputEnabled: (enabled: boolean) => void;
  getRectMap: () => CanvasRectMap;
}

/** Runtime guard: does this value look like a {@link CanvasBridgeApi}? */
export function isCanvasBridgeApi(value: unknown): value is CanvasBridgeApi {
  if (typeof value !== "object" || value === null) return false;
  const api = value as Record<string, unknown>;
  return (
    typeof api.connect === "function" &&
    typeof api.disconnect === "function" &&
    typeof api.setContent === "function" &&
    typeof api.setPageData === "function" &&
    typeof api.setSelection === "function" &&
    typeof api.setHover === "function" &&
    typeof api.setDropIndicator === "function" &&
    typeof api.setInputEnabled === "function" &&
    typeof api.getRectMap === "function"
  );
}

/**
 * Read the bridge from a window (typically an iframe's `contentWindow`).
 * Returns null while the iframe app has not published it yet, or when the
 * published value does not pass the {@link isCanvasBridgeApi} shape guard.
 */
export function getCanvasBridge(
  win: Window | null | undefined,
  globalKey: string = DEFAULT_CANVAS_BRIDGE_GLOBAL
): CanvasBridgeApi | null {
  if (!win) return null;
  let value: unknown;
  try {
    value = (win as unknown as Record<string, unknown>)[globalKey];
  } catch {
    // Cross-origin access throws; the bridge requires same-origin.
    return null;
  }
  return isCanvasBridgeApi(value) ? value : null;
}
