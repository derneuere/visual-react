// CanvasHost — the parent side of the iframe canvas.
//
// Renders the <iframe> that loads the consumer's canvas route (which mounts
// CanvasBridge) and wires it to the consumer's editor state through the
// typed bridge (protocol.ts):
//   parent -> iframe: draft content (rAF-batched), page data, selection,
//                     edit-input mode
//   iframe -> parent: click-to-select, hover, forwarded Delete/Backspace/
//                     Escape, completed canvas-native widget drags
//                     (onCanvasDrop)
//
// The parent stays the single source of truth: the Instance tree and the
// selection live in the consumer's state; the iframe only renders and
// reports. Bridge ids are String(instanceId) — resolve them back with
// findInstanceByBridgeId.
//
// The SAME iframe also serves fixed-size device previews: only the
// size/scale wrappers around it change, the element never remounts, so the
// bridge connection and page state survive mode switches and media queries
// evaluate against the true device width.
//
// dnd-kit integration (dragging new widgets from a parent-side palette onto
// the canvas) lives in the separate "@derneuere/visual-react/canvas/dnd"
// entry so @dnd-kit stays an optional peer; it plugs in through the
// {@link CanvasHostController} exposed via `onController` and the `overlay`
// prop.
import React from "react";
import type { Instance } from "../registry/types";
import {
  DEFAULT_CANVAS_BRIDGE_GLOBAL,
  getCanvasBridge,
  type CanvasBridgeApi,
  type CanvasDropEvent,
  type CanvasDropIndicator,
  type CanvasHostCallbacks,
  type CanvasRectMap,
} from "./protocol";

/** Fixed device size for a true-width preview (or a fixed-size edit canvas). */
export interface CanvasDeviceSize {
  width: number;
  height: number;
}

/** Convenience presets; pass your own {@link CanvasDeviceSize} for others. */
export const CANVAS_DEVICE_PRESETS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 760 },
} as const satisfies Record<string, CanvasDeviceSize>;

/**
 * Imperative surface the host hands out (via `onController`) for advanced
 * integrations — primarily the dnd-kit glue in "./canvas/dnd". The object
 * identity is stable for the lifetime of the host.
 */
export interface CanvasHostController {
  /** Live rect map from the iframe, or null while disconnected. */
  getRectMap: () => CanvasRectMap | null;
  /** Mirror a drop indicator into the iframe (deduped). */
  setDropIndicator: (indicator: CanvasDropIndicator | null) => void;
  /** The iframe's client size (its viewport), or null before mount. */
  getViewportSize: () => { width: number; height: number } | null;
  /** Whether the bridge is currently connected. */
  isConnected: () => boolean;
  /**
   * Subscribe to rect-invalidation signals (iframe scroll or layout
   * changes). Returns an unsubscribe function.
   */
  subscribeRectsChanged: (listener: () => void) => () => void;
}

export interface CanvasHostProps {
  /** URL of the consumer's canvas route (same-origin, mounts CanvasBridge). */
  src: string;
  /** Draft content to render; pushed on every change (rAF-batched). */
  content: Instance[];
  /** Generic JSON side channel (page-level data the renderer needs). */
  pageData?: unknown;
  /** Currently selected instance id (string or number; sent as string). */
  selectedInstanceId?: string | number | null;
  /**
   * true = edit mode (clicks select, keys forward, overlay renders);
   * false = read-only preview. Defaults to true.
   */
  editing?: boolean;
  /**
   * Fixed device size; null/undefined renders fluid (the iframe fills the
   * host). Combine with `scaleToFit` to shrink oversized devices into the
   * available column while keeping true-device media queries.
   */
  device?: CanvasDeviceSize | null;
  /** Scale a fixed-size device down to fit the host width. Default true. */
  scaleToFit?: boolean;
  /** Horizontal breathing room subtracted before computing the fit scale. */
  fitPadding?: number;
  /** Window-global key the bridge publishes under (must match the bridge). */
  globalKey?: string;
  /** Give up polling for the bridge after this long (per load). Default 15s. */
  connectTimeoutMs?: number;
  /** Poll interval while waiting for the bridge. Default 100ms. */
  connectIntervalMs?: number;
  onSelect?: (bridgeInstanceId: string | null) => void;
  onHover?: (bridgeInstanceId: string | null) => void;
  /** Forwarded Delete/Backspace/Escape from inside the iframe. */
  onKeyDown?: (key: string) => void;
  /** Completed bridge-native drag; perform the move and update `content`. */
  onCanvasDrop?: (drop: CanvasDropEvent) => void;
  onConnectedChange?: (connected: boolean) => void;
  /** The bridge did not appear within `connectTimeoutMs` after a load. */
  onConnectTimeout?: () => void;
  /** Receives the stable controller on mount and null on unmount. */
  onController?: (controller: CanvasHostController | null) => void;
  className?: string;
  style?: React.CSSProperties;
  iframeClassName?: string;
  iframeStyle?: React.CSSProperties;
  iframeTitle?: string;
  /**
   * Rendered absolutely over the iframe (e.g. the dnd drag overlay with
   * virtual droppables). Only mounted when non-null — while mounted it
   * covers the iframe, so pass it only during a drag.
   */
  overlay?: React.ReactNode;
}

export function CanvasHost({
  src,
  content,
  pageData,
  selectedInstanceId = null,
  editing = true,
  device = null,
  scaleToFit = true,
  fitPadding = 0,
  globalKey = DEFAULT_CANVAS_BRIDGE_GLOBAL,
  connectTimeoutMs = 15000,
  connectIntervalMs = 100,
  onSelect,
  onHover,
  onKeyDown,
  onCanvasDrop,
  onConnectedChange,
  onConnectTimeout,
  onController,
  className,
  style,
  iframeClassName,
  iframeStyle,
  iframeTitle = "Canvas",
  overlay,
}: CanvasHostProps) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const bridgeRef = React.useRef<CanvasBridgeApi | null>(null);
  const [connected, setConnected] = React.useState(false);

  // Latest state for the connect-time initial push + rAF-batched pushes.
  const latestRef = React.useRef({
    content,
    pageData,
    selectedInstanceId,
    editing,
  });
  latestRef.current = { content, pageData, selectedInstanceId, editing };

  // Latest handlers behind stable identities (consumers pass fresh closures
  // every render).
  const handlersRef = React.useRef({
    onSelect,
    onHover,
    onKeyDown,
    onCanvasDrop,
    onConnectedChange,
    onConnectTimeout,
  });
  handlersRef.current = {
    onSelect,
    onHover,
    onKeyDown,
    onCanvasDrop,
    onConnectedChange,
    onConnectTimeout,
  };

  // ---- Controller (for the optional dnd integration) -----------------------
  const rectListenersRef = React.useRef(new Set<() => void>());
  // Last indicator pushed to the bridge, serialized for cheap dedupe.
  const lastIndicatorRef = React.useRef("");
  const connectedRef = React.useRef(false);
  connectedRef.current = connected;

  const pushDropIndicator = React.useCallback(
    (indicator: CanvasDropIndicator | null) => {
      const key = indicator
        ? `${indicator.instanceId}:${indicator.position}`
        : "";
      if (lastIndicatorRef.current === key) return;
      lastIndicatorRef.current = key;
      bridgeRef.current?.setDropIndicator(indicator);
    },
    []
  );

  const controllerRef = React.useRef<CanvasHostController | null>(null);
  if (controllerRef.current == null) {
    controllerRef.current = {
      getRectMap: () => bridgeRef.current?.getRectMap() ?? null,
      setDropIndicator: (indicator) => pushDropIndicator(indicator),
      getViewportSize: () => {
        const iframe = iframeRef.current;
        return iframe
          ? { width: iframe.clientWidth, height: iframe.clientHeight }
          : null;
      },
      isConnected: () => connectedRef.current,
      subscribeRectsChanged: (listener) => {
        rectListenersRef.current.add(listener);
        return () => rectListenersRef.current.delete(listener);
      },
    };
  }

  React.useEffect(() => {
    onController?.(controllerRef.current);
    return () => onController?.(null);
    // The controller identity is stable; re-notify only if the callback
    // itself changes.
  }, [onController]);

  // ---- Connect: poll the contentWindow for the bridge global ---------------
  // Re-polls after every iframe load (initial load and full reloads inside
  // the iframe mint a new bridge). Improvement over uncapped polling: give
  // up after `connectTimeoutMs` per load and report `onConnectTimeout`.
  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cancelled = false;
    let timer: number | undefined;

    const callbacks: CanvasHostCallbacks = {
      onReady: () => {},
      onSelect: (id) => handlersRef.current.onSelect?.(id),
      onHover: (id) => handlersRef.current.onHover?.(id),
      onKeyDown: ({ key }) => handlersRef.current.onKeyDown?.(key),
      onCanvasDrop: (drop) => handlersRef.current.onCanvasDrop?.(drop),
      onScroll: () => rectListenersRef.current.forEach((l) => l()),
      onRectsChanged: () => rectListenersRef.current.forEach((l) => l()),
    };

    let deadline = Date.now() + connectTimeoutMs;

    const tryConnect = () => {
      if (cancelled) return;
      const bridge = getCanvasBridge(iframe.contentWindow, globalKey);
      if (!bridge) {
        if (Date.now() >= deadline) {
          handlersRef.current.onConnectTimeout?.();
          return;
        }
        timer = window.setTimeout(tryConnect, connectIntervalMs);
        return;
      }
      bridgeRef.current = bridge;
      bridge.connect(callbacks);
      // Initial push — the canvas shows its neutral shell until this arrives.
      const { content, pageData, selectedInstanceId, editing } =
        latestRef.current;
      bridge.setContent(content);
      bridge.setPageData(pageData);
      bridge.setSelection(
        selectedInstanceId != null ? String(selectedInstanceId) : null
      );
      bridge.setInputEnabled(editing);
      setConnected(true);
      handlersRef.current.onConnectedChange?.(true);
    };

    const onLoad = () => {
      setConnected(false);
      handlersRef.current.onConnectedChange?.(false);
      bridgeRef.current = null;
      lastIndicatorRef.current = "";
      if (timer) window.clearTimeout(timer);
      deadline = Date.now() + connectTimeoutMs;
      tryConnect();
    };
    iframe.addEventListener("load", onLoad);
    tryConnect();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      try {
        bridgeRef.current?.disconnect();
      } catch {
        // Iframe window may already be gone.
      }
      bridgeRef.current = null;
    };
  }, [globalKey, connectTimeoutMs, connectIntervalMs]);

  // ---- Pushes ---------------------------------------------------------------
  // Content push, rAF-batched: property edits fire per keystroke.
  React.useEffect(() => {
    if (!connected) return;
    const raf = requestAnimationFrame(() => {
      bridgeRef.current?.setContent(latestRef.current.content);
    });
    return () => cancelAnimationFrame(raf);
  }, [content, connected]);

  React.useEffect(() => {
    if (!connected) return;
    bridgeRef.current?.setPageData(pageData);
  }, [pageData, connected]);

  React.useEffect(() => {
    if (!connected) return;
    bridgeRef.current?.setSelection(
      selectedInstanceId != null ? String(selectedInstanceId) : null
    );
  }, [selectedInstanceId, connected]);

  // Preview mode: edit input off (clicks stay swallowed inside the iframe,
  // so links still never navigate), leftover hover/drop visuals cleared.
  React.useEffect(() => {
    if (!connected) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    bridge.setInputEnabled(editing);
    if (!editing) {
      bridge.setHover(null);
      pushDropIndicator(null);
    }
  }, [editing, connected, pushDropIndicator]);

  // ---- Device sizing ---------------------------------------------------------
  // Fixed device: optionally scale the frame down to fit the available
  // column, tracking host resizes via ResizeObserver.
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const [fitScale, setFitScale] = React.useState(1);

  const deviceWidth = device?.width;
  React.useEffect(() => {
    if (deviceWidth == null || !scaleToFit) return;
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - fitPadding;
      setFitScale(Math.min(1, Math.max(0.1, available / deviceWidth)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [deviceWidth, scaleToFit, fitPadding]);

  const scale = device && scaleToFit ? fitScale : 1;

  // The wrapper structure is IDENTICAL in fluid and device modes (only
  // styles change) so React never remounts the iframe on a mode switch.
  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", ...style }}
    >
      <div
        style={
          device
            ? {
                width: device.width * scale,
                height: device.height * scale,
                margin: "0 auto",
              }
            : { width: "100%", height: "100%" }
        }
      >
        <div
          style={
            device
              ? {
                  position: "relative",
                  width: device.width,
                  height: device.height,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }
              : { position: "relative", width: "100%", height: "100%" }
          }
        >
          <iframe
            ref={iframeRef}
            src={src}
            title={iframeTitle}
            className={iframeClassName}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              border: 0,
              ...iframeStyle,
            }}
          />
          {/* Overlay layer (e.g. dnd drag proxies): covers the iframe so the
              PARENT document keeps receiving pointer events during a drag —
              the iframe document would swallow them otherwise. */}
          {overlay != null && (
            <div
              data-vr-canvas-host-overlay
              style={{ position: "absolute", inset: 0, overflow: "hidden" }}
            >
              {overlay}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
