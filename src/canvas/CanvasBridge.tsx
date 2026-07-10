// CanvasBridge — the iframe side of the editor canvas.
//
// The consumer mounts this component in a bare route that the parent editor
// loads in an <iframe> (see CanvasHost). It renders the page through the
// consumer-supplied `renderPage` function and publishes the typed bridge API
// (protocol.ts) on the iframe's window.
//
// The parent editor pushes content/pageData/selection in; the bridge reports
// clicks, hovers, key presses and completed widget drags (onCanvasDrop) out.
// All editor visuals (selection outline, hover highlight, drop indicator)
// are drawn in a pointer-events-none overlay so the page markup itself stays
// identical to the public render — modulo the `data-instance-id` hit-target
// wrappers the bridge injects via the WrapInstance render hook.
import React from "react";
import type { Instance } from "../registry/types";
import { WrapInstanceProvider, type WrapInstance } from "../components/wrapInstance";
import { computeDropPosition } from "../utils/dropPosition";
import {
  DEFAULT_CANVAS_BRIDGE_GLOBAL,
  type CanvasBridgeApi,
  type CanvasDropIndicator,
  type CanvasDropPosition,
  type CanvasHostCallbacks,
  type CanvasRect,
  type CanvasRectMap,
} from "./protocol";
import { findInstanceByBridgeId } from "./canvasUtils";

// Bridge-native drag (move a widget by dragging it inside the canvas).
const DRAG_THRESHOLD_PX = 8;
const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_STEP_PX = 24;

export interface CanvasBridgeRenderArgs {
  content: Instance[];
  /** Whatever the host pushed through the generic pageData channel. */
  pageData: unknown;
  /**
   * The hit-target wrapper the bridge needs around every rendered instance.
   * It is ALSO provided via WrapInstanceProvider, so a renderer built on the
   * package's ComponentRenderer picks it up automatically; custom renderers
   * can apply it explicitly.
   */
  wrapInstance: WrapInstance;
}

export interface CanvasBridgeProps {
  /**
   * Renders the pushed content — typically with the package renderer
   * (ComponentRenderer / a page view component), but any renderer works as
   * long as the {@link CanvasBridgeRenderArgs.wrapInstance} wrappers end up
   * in the DOM (they carry the data-instance-id hit targets).
   */
  renderPage: (args: CanvasBridgeRenderArgs) => React.ReactNode;
  /**
   * Container predicate for drop-position math during bridge-native drags
   * (containers accept "into", leaves only above/below). Typically the
   * registry's `hasChildren`. Defaults to treating everything as a leaf.
   */
  isContainer?: (instance: Instance) => boolean;
  /** Label for the selection chip; defaults to the instance's component id. */
  getInstanceLabel?: (instance: Instance) => string;
  /** Window-global key the bridge publishes under. */
  globalKey?: string;
  /** Field name passed to the drop-position math; defaults to "children". */
  fieldName?: string;
  /**
   * Selector for the page content area used as the fallback "into the page
   * root" drop-indicator rect; falls back to document.body.
   */
  pageAreaSelector?: string;
  /** Accent color for selection/hover/drop visuals. */
  accentColor?: string;
  /** Translucent accent for the "into" drop ring background. */
  accentSoftColor?: string;
  /** Text color on the selection label chip. */
  accentTextColor?: string;
  /** Shown until the host pushes the first content. */
  loadingFallback?: React.ReactNode;
  /** Overlay hint shown while the pushed content is empty. */
  emptyHint?: React.ReactNode;
}

// Every instance (incl. nested container children) gets a plain hit-target
// wrapper the interaction handlers + overlay resolve against.
const defaultWrapInstance: WrapInstance = (instance, node) => (
  <div
    data-instance-id={String(instance.props.instanceId)}
    data-widget-id={instance.id}
  >
    {node}
  </div>
);

function measureRect(instanceId: string | null): CanvasRect | null {
  if (instanceId == null) return null;
  const el = document.querySelector(
    `[data-instance-id="${CSS.escape(instanceId)}"]`
  );
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function getRectMap(): CanvasRectMap {
  const rects: Record<string, CanvasRect> = {};
  document.querySelectorAll<HTMLElement>("[data-instance-id]").forEach((el) => {
    const id = el.dataset.instanceId;
    if (!id) return;
    const r = el.getBoundingClientRect();
    rects[id] = { top: r.top, left: r.left, width: r.width, height: r.height };
  });
  return { rects, scrollX: window.scrollX, scrollY: window.scrollY };
}

// Fallback rect for a root-level "into" drop indicator (append to the page):
// the page root usually has no [data-instance-id] element, so highlight the
// page content area instead. Min height keeps the ring visible on an empty
// page, where the content area collapses to zero height.
function measurePageAreaRect(selector: string): CanvasRect | null {
  const el = document.querySelector(selector) ?? document.body;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top,
    left: r.left,
    width: r.width,
    height: Math.max(r.height, 120),
  };
}

export function CanvasBridge({
  renderPage,
  isContainer,
  getInstanceLabel,
  globalKey = DEFAULT_CANVAS_BRIDGE_GLOBAL,
  fieldName = "children",
  pageAreaSelector = "main",
  accentColor = "#228be6",
  accentSoftColor = "rgba(34, 139, 230, 0.08)",
  accentTextColor = "#ffffff",
  loadingFallback,
  emptyHint = "This page has no content yet.",
}: CanvasBridgeProps) {
  // null until the parent's first push — the route shows a neutral shell.
  const [content, setContent] = React.useState<Instance[] | null>(null);
  const [pageData, setPageData] = React.useState<unknown>(undefined);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [dropIndicator, setDropIndicator] =
    React.useState<CanvasDropIndicator | null>(null);
  // true = edit input (select/hover/keys reported, overlay drawn); false =
  // read-only device preview. Defaults to false until the host pushes a mode.
  const [editInputEnabled, setEditInputEnabled] = React.useState(false);

  const hostRef = React.useRef<CanvasHostCallbacks | null>(null);
  const editInputRef = React.useRef(false);
  editInputRef.current = editInputEnabled;
  const contentRef = React.useRef<Instance[]>([]);
  contentRef.current = content ?? [];
  const optionsRef = React.useRef({ isContainer, getInstanceLabel, fieldName });
  optionsRef.current = { isContainer, getInstanceLabel, fieldName };

  const resolveInstance = React.useCallback(
    (bridgeId: string | null): Instance | null =>
      bridgeId == null
        ? null
        : findInstanceByBridgeId(contentRef.current, bridgeId),
    []
  );

  // Publish the bridge API. The host polls for it after the iframe loads.
  React.useEffect(() => {
    const api: CanvasBridgeApi = {
      connect: (host) => {
        hostRef.current = host;
        host.onReady();
      },
      disconnect: () => {
        hostRef.current = null;
      },
      setContent: (c) => setContent(c ?? []),
      setPageData: (d) => setPageData(d),
      setSelection: (id) => setSelectedId(id),
      setHover: (id) => setHoveredId(id),
      setDropIndicator: (indicator) => setDropIndicator(indicator),
      setInputEnabled: (enabled) => {
        setEditInputEnabled(enabled);
        // Drop a stale hover echo when the host switches to preview.
        if (!enabled) setHoveredId(null);
      },
      getRectMap,
    };
    const win = window as unknown as Record<string, unknown>;
    win[globalKey] = api;
    return () => {
      if (win[globalKey] === api) {
        delete win[globalKey];
      }
    };
  }, [globalKey]);

  // Interaction layer: capture-phase handlers on the document. ALL clicks
  // (incl. middle-click auxclick and keyboard Enter on links) are swallowed
  // in every mode — links never navigate, buttons never fire. With edit input
  // on, every click additionally maps to the nearest [data-instance-id] (or
  // clears the selection when it hits bare page area); with it off (device
  // preview) nothing is reported.
  //
  // Dragging a wrapper (pointerdown + 8px threshold) starts a bridge-native
  // MOVE: the dragged widget dims, the target under the pointer is resolved
  // via elementFromPoint + the shared drop-position math and drawn as the
  // overlay drop indicator, and pointerup reports onCanvasDrop — the PARENT
  // mutates the tree (moveInstance) and pushes the result back via setContent.
  React.useEffect(() => {
    const findInstanceEl = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element
        ? target.closest<HTMLElement>("[data-instance-id]")
        : null;

    // ---- Drag session ------------------------------------------------------
    interface DragSession {
      pointerId: number;
      sourceEl: HTMLElement;
      sourceId: string;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      /** true once the movement threshold is crossed. */
      active: boolean;
      target: { id: string; position: CanvasDropPosition } | null;
      prevOpacity: string;
      prevUserSelect: string;
      scrollRaf: number;
    }
    let session: DragSession | null = null;
    // A finished drag must not turn its trailing click into a select.
    let suppressNextClick = false;

    const updateDragTarget = () => {
      if (!session?.active) return;
      let el =
        document
          .elementFromPoint(session.lastX, session.lastY)
          ?.closest<HTMLElement>("[data-instance-id]") ?? null;
      // Never target the dragged widget or its subtree (nested children are
      // DOM descendants of the wrapper, so contains() covers the tree rule).
      while (el && session.sourceEl.contains(el)) {
        el =
          el.parentElement?.closest<HTMLElement>("[data-instance-id]") ?? null;
      }
      if (!el) {
        if (session.target) {
          session.target = null;
          setDropIndicator(null);
        }
        return;
      }
      const id = el.getAttribute("data-instance-id");
      if (!id) return;
      const rect = el.getBoundingClientRect();
      const { isContainer, fieldName } = optionsRef.current;
      const instance = resolveInstance(id);
      const position = computeDropPosition({
        pointerY: session.lastY,
        rect: { top: rect.top, height: rect.height },
        isContainer: !!instance && !!isContainer && isContainer(instance),
        fieldName,
      });
      if (session.target?.id !== id || session.target.position !== position) {
        session.target = { id, position };
        setDropIndicator({ instanceId: id, position });
      }
    };

    // Keep long pages draggable: scroll when the pointer nears the viewport
    // edge, re-resolving the target under the (stationary) pointer.
    const autoScrollStep = () => {
      if (!session?.active) return;
      const y = session.lastY;
      const bottomEdge = window.innerHeight - AUTO_SCROLL_EDGE_PX;
      let delta = 0;
      if (y < AUTO_SCROLL_EDGE_PX) {
        delta = -Math.ceil(
          ((AUTO_SCROLL_EDGE_PX - y) / AUTO_SCROLL_EDGE_PX) *
            AUTO_SCROLL_MAX_STEP_PX
        );
      } else if (y > bottomEdge) {
        delta = Math.ceil(
          ((y - bottomEdge) / AUTO_SCROLL_EDGE_PX) * AUTO_SCROLL_MAX_STEP_PX
        );
      }
      if (delta !== 0) {
        window.scrollBy(0, delta);
        updateDragTarget();
      }
      session.scrollRaf = requestAnimationFrame(autoScrollStep);
    };

    const endDragSession = () => {
      if (!session) return;
      const s = session;
      session = null;
      if (!s.active) return;
      cancelAnimationFrame(s.scrollRaf);
      s.sourceEl.style.opacity = s.prevOpacity;
      document.body.style.userSelect = s.prevUserSelect;
      setDropIndicator(null);
      suppressNextClick = true;
      if (s.sourceEl.hasPointerCapture(s.pointerId)) {
        s.sourceEl.releasePointerCapture(s.pointerId);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      suppressNextClick = false;
      if (!editInputRef.current || !e.isPrimary || e.button !== 0) return;
      const el = findInstanceEl(e.target);
      const id = el?.getAttribute("data-instance-id");
      if (!el || !id) return;
      // Arm only — the gesture stays a click until the threshold is crossed.
      session = {
        pointerId: e.pointerId,
        sourceEl: el,
        sourceId: id,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        active: false,
        target: null,
        prevOpacity: "",
        prevUserSelect: "",
        scrollRaf: 0,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!session || e.pointerId !== session.pointerId) return;
      if (!editInputRef.current) {
        // Mode switched mid-gesture (host push): abort cleanly.
        endDragSession();
        return;
      }
      session.lastX = e.clientX;
      session.lastY = e.clientY;
      if (!session.active) {
        if (
          Math.hypot(e.clientX - session.startX, e.clientY - session.startY) <
          DRAG_THRESHOLD_PX
        ) {
          return;
        }
        session.active = true;
        try {
          session.sourceEl.setPointerCapture(session.pointerId);
        } catch {
          // Pointer may already be gone; the drag still works uncaptured.
        }
        session.prevOpacity = session.sourceEl.style.opacity;
        session.sourceEl.style.opacity = "0.4";
        session.prevUserSelect = document.body.style.userSelect;
        document.body.style.userSelect = "none";
        window.getSelection()?.removeAllRanges();
        setHoveredId(null);
        session.scrollRaf = requestAnimationFrame(autoScrollStep);
      }
      updateDragTarget();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!session || e.pointerId !== session.pointerId) return;
      const { active, sourceId, target } = session;
      endDragSession();
      if (active && target) {
        hostRef.current?.onCanvasDrop({
          activeInstanceId: sourceId,
          targetInstanceId: target.id,
          position: target.position,
        });
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (!session || e.pointerId !== session.pointerId) return;
      endDragSession();
    };

    // ---- Click / hover / keys ----------------------------------------------
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      if (!editInputRef.current) return;
      hostRef.current?.onSelect(
        findInstanceEl(e.target)?.getAttribute("data-instance-id") ?? null
      );
    };

    // Middle/other-button clicks bypass "click" (links would open in a new
    // tab); swallow them in every mode.
    const onAuxClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onMouseOver = (e: MouseEvent) => {
      if (!editInputRef.current || session?.active) return;
      const id =
        findInstanceEl(e.target)?.getAttribute("data-instance-id") ?? null;
      // Local echo keeps the highlight snappy even before the host reacts.
      setHoveredId(id);
      hostRef.current?.onHover(id);
    };

    const onMouseLeave = () => {
      setHoveredId(null);
      hostRef.current?.onHover(null);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Enter on a focused link fires a synthetic click/navigation; block it
      // in every mode — the canvas never navigates.
      if (
        e.key === "Enter" &&
        e.target instanceof Element &&
        e.target.closest("a[href]")
      ) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!editInputRef.current) return;
      if (e.key === "Escape" && session?.active) {
        // Escape cancels a running drag instead of clearing the selection.
        e.preventDefault();
        endDragSession();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") {
        e.preventDefault();
        hostRef.current?.onKeyDown({ key: e.key });
      }
    };

    const onScroll = () => {
      hostRef.current?.onScroll();
    };

    // Native drag&drop (links/images are draggable by default) would steal
    // the pointer stream from a bridge drag; block it in edit mode.
    const onNativeDragStart = (e: DragEvent) => {
      if (editInputRef.current) e.preventDefault();
    };

    // Suppress text selection for the whole gesture incl. the pre-threshold
    // phase (a selection started there would survive into the drag; the
    // user-select override only starts at activation).
    const onSelectStart = (e: Event) => {
      if (session) e.preventDefault();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onAuxClick, true);
    document.addEventListener("mouseover", onMouseOver, true);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("dragstart", onNativeDragStart, true);
    document.addEventListener("selectstart", onSelectStart, true);
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    return () => {
      endDragSession();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onAuxClick, true);
      document.removeEventListener("mouseover", onMouseOver, true);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("dragstart", onNativeDragStart, true);
      document.removeEventListener("selectstart", onSelectStart, true);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [resolveInstance]);

  if (content == null) {
    return (
      loadingFallback ?? (
        <div
          data-vr-canvas-loading
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            color: "#868e96",
            fontSize: 14,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Loading canvas…
        </div>
      )
    );
  }

  return (
    <>
      <WrapInstanceProvider value={defaultWrapInstance}>
        {renderPage({ content, pageData, wrapInstance: defaultWrapInstance })}
      </WrapInstanceProvider>
      {/* Device preview is a true preview: no editor visuals at all. */}
      {editInputEnabled && (
        <CanvasOverlay
          content={content}
          selectedId={selectedId}
          hoveredId={hoveredId}
          dropIndicator={dropIndicator}
          resolveInstance={resolveInstance}
          getInstanceLabel={getInstanceLabel}
          pageAreaSelector={pageAreaSelector}
          accentColor={accentColor}
          accentSoftColor={accentSoftColor}
          accentTextColor={accentTextColor}
          emptyHint={emptyHint}
          notifyRectsChanged={() => hostRef.current?.onRectsChanged()}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Overlay — all editor visuals, absolutely positioned above the page.
// ---------------------------------------------------------------------------

interface OverlayRects {
  selected: CanvasRect | null;
  selectedName: string | null;
  hovered: CanvasRect | null;
  drop: CanvasRect | null;
}

const EMPTY_RECTS: OverlayRects = {
  selected: null,
  selectedName: null,
  hovered: null,
  drop: null,
};

interface CanvasOverlayProps {
  content: Instance[];
  selectedId: string | null;
  hoveredId: string | null;
  dropIndicator: CanvasDropIndicator | null;
  resolveInstance: (bridgeId: string | null) => Instance | null;
  getInstanceLabel?: (instance: Instance) => string;
  pageAreaSelector: string;
  accentColor: string;
  accentSoftColor: string;
  accentTextColor: string;
  emptyHint: React.ReactNode;
  notifyRectsChanged: () => void;
}

function CanvasOverlay({
  content,
  selectedId,
  hoveredId,
  dropIndicator,
  resolveInstance,
  getInstanceLabel,
  pageAreaSelector,
  accentColor,
  accentSoftColor,
  accentTextColor,
  emptyHint,
  notifyRectsChanged,
}: CanvasOverlayProps) {
  const [rects, setRects] = React.useState<OverlayRects>(EMPTY_RECTS);

  const labelFor = React.useCallback(
    (bridgeId: string | null): string | null => {
      const instance = resolveInstance(bridgeId);
      if (!instance) return null;
      return getInstanceLabel ? getInstanceLabel(instance) : instance.id;
    },
    [resolveInstance, getInstanceLabel]
  );

  // Keep the outlines glued to their widgets: re-measure on scroll/resize,
  // element/body resizes and DOM mutations (content pushes, image loads, …),
  // batched to one measurement per animation frame.
  React.useEffect(() => {
    let raf = 0;
    let lastSerialized = "";
    let disposed = false;

    const sync = () => {
      raf = 0;
      if (disposed) return;
      const next: OverlayRects = {
        selected: measureRect(selectedId),
        selectedName: labelFor(selectedId),
        hovered:
          hoveredId && hoveredId !== selectedId ? measureRect(hoveredId) : null,
        drop:
          measureRect(dropIndicator?.instanceId ?? null) ??
          (dropIndicator?.position === "into"
            ? measurePageAreaRect(pageAreaSelector)
            : null),
      };
      const serialized = JSON.stringify(next);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        setRects(next);
        notifyRectsChanged();
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };

    schedule();
    window.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.documentElement);
    ro.observe(document.body);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      mo.disconnect();
    };
  }, [
    selectedId,
    hoveredId,
    dropIndicator,
    content,
    labelFor,
    pageAreaSelector,
    notifyRectsChanged,
  ]);

  return (
    <div
      aria-hidden
      data-vr-canvas-overlay
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2147483000,
      }}
    >
      {/* Hover highlight (suppressed on the selected widget). */}
      {rects.hovered && (
        <div
          data-vr-canvas-hover
          style={{
            position: "absolute",
            top: rects.hovered.top,
            left: rects.hovered.left,
            width: rects.hovered.width,
            height: rects.hovered.height,
            outline: `1.5px dashed ${accentColor}`,
            outlineOffset: -1,
            opacity: 0.6,
          }}
        />
      )}

      {/* Selection outline + widget-name chip. */}
      {rects.selected && (
        <div
          data-vr-canvas-selection
          style={{
            position: "absolute",
            top: rects.selected.top,
            left: rects.selected.left,
            width: rects.selected.width,
            height: rects.selected.height,
            outline: `2px solid ${accentColor}`,
            outlineOffset: -1,
          }}
        >
          {rects.selectedName && (
            <span
              style={{
                position: "absolute",
                left: 0,
                // Flip the chip inside the outline when the widget touches the
                // viewport top (e.g. hero sections while scrolled up).
                top: rects.selected.top < 24 ? 0 : -22,
                padding: "2px 6px",
                fontSize: 11,
                fontWeight: 600,
                lineHeight: "16px",
                color: accentTextColor,
                background: accentColor,
                borderRadius:
                  rects.selected.top < 24 ? "0 0 4px 0" : "4px 4px 0 0",
                whiteSpace: "nowrap",
              }}
            >
              {rects.selectedName}
            </span>
          )}
        </div>
      )}

      {/* Drop indicator: insertion bar (above/below) or inset ring (into). */}
      {rects.drop &&
        dropIndicator &&
        (dropIndicator.position === "into" ? (
          <div
            data-vr-canvas-drop="into"
            style={{
              position: "absolute",
              top: rects.drop.top,
              left: rects.drop.left,
              width: rects.drop.width,
              height: rects.drop.height,
              outline: `2px dashed ${accentColor}`,
              outlineOffset: -2,
              background: accentSoftColor,
            }}
          />
        ) : (
          <div
            data-vr-canvas-drop={dropIndicator.position}
            style={{
              position: "absolute",
              top:
                dropIndicator.position === "above"
                  ? rects.drop.top - 1
                  : rects.drop.top + rects.drop.height - 1,
              left: rects.drop.left,
              width: rects.drop.width,
              height: 2,
              background: accentColor,
            }}
          />
        ))}

      {/* Empty-page hint (the widget area renders zero-height otherwise). */}
      {content.length === 0 && (
        <div
          data-vr-canvas-empty
          style={{
            position: "absolute",
            top: "40%",
            left: 0,
            right: 0,
            textAlign: "center",
            color: "#868e96",
            fontSize: 14,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {emptyHint}
        </div>
      )}
    </div>
  );
}
