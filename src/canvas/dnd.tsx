// dnd-kit glue for the iframe canvas — the "@derneuere/visual-react/canvas/dnd"
// entry. Kept separate from "./canvas" so @dnd-kit/core stays an OPTIONAL
// peer: importing "./canvas" never loads dnd-kit; import this entry only
// when you wire a parent-side DndContext (e.g. a component palette) to the
// canvas.
//
// How it works: while a dnd-kit drag is active in the parent, a transparent
// overlay covers the iframe (so the parent keeps receiving pointer events —
// the iframe document would swallow them) and hosts one virtual useDroppable
// proxy per widget rendered in the iframe, positioned from the bridge's rect
// map and clamped to the iframe viewport. A full-size root droppable behind
// the proxies means "append to the page". The drop indicator is mirrored
// into the iframe via the host controller; on drop, `onDrop` reports the
// resolved target so the consumer mutates their tree.
//
// Usage (inside YOUR DndContext — both the hook and the overlay use dnd-kit
// context):
//
//   const [controller, setController] = useState<CanvasHostController|null>(null);
//   const { overlay } = useCanvasDnd({ controller, isContainer, onDrop });
//   <CanvasHost ... onController={setController} overlay={overlay} />
import React from "react";
import {
  useDndContext,
  useDndMonitor,
  useDroppable,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { computeDropPosition } from "../utils/dropPosition";
import type {
  CanvasDropIndicator,
  CanvasDropPosition,
  CanvasRect,
} from "./protocol";
import type { CanvasHostController } from "./CanvasHost";
import { clampRectToViewport } from "./canvasUtils";

/** Droppable id of the full-iframe root overlay ("append to the page"). */
export const CANVAS_ROOT_DROPPABLE_ID = "vr-canvas-root";
/** Prefix of the per-widget proxy droppable ids: `vr-canvas:<bridgeId>`. */
export const CANVAS_DROPPABLE_PREFIX = "vr-canvas:";

/** Data every canvas droppable carries (merged under consumer data). */
export interface CanvasDroppableData {
  /** Marks the droppable as a canvas proxy. */
  canvas: true;
  /** Bridge id of the proxied widget; absent on the root droppable. */
  bridgeInstanceId?: string;
  /** Root droppable: always drop "into" regardless of geometry. */
  forceInto?: boolean;
  [key: string]: unknown;
}

/** Resolved drop target passed to {@link UseCanvasDndOptions.onDrop}. */
export interface CanvasDndDropTarget {
  /** Bridge id of the target widget; null = the canvas root droppable. */
  bridgeInstanceId: string | null;
  position: CanvasDropPosition;
  /** The droppable's full data object (incl. consumer-provided extras). */
  data: Record<string, unknown>;
}

export interface UseCanvasDndOptions {
  /** The controller received from CanvasHost's `onController`. */
  controller: CanvasHostController | null;
  /** Gate (e.g. only in edit view mode). Default true. */
  enabled?: boolean;
  /** Container predicate for drop-position math, by bridge id. */
  isContainer?: (bridgeInstanceId: string) => boolean;
  /** Field name for the drop-position math; defaults to "children". */
  fieldName?: string;
  /**
   * Extra data merged into each per-widget proxy droppable (e.g. the real
   * instanceId so your generic drag handlers keep working). Return null to
   * skip creating a proxy for that widget.
   */
  getDroppableData?: (
    bridgeInstanceId: string
  ) => Record<string, unknown> | null;
  /**
   * Extra data for the full-canvas root droppable ("append to the page").
   * Pass null to disable the root droppable entirely.
   */
  rootDroppableData?: Record<string, unknown> | null;
  /**
   * A dnd-kit drag ended over a canvas droppable. Mutate your tree here
   * (the active side — new widget vs move — comes from `event.active`).
   */
  onDrop?: (event: DragEndEvent, target: CanvasDndDropTarget) => void;
}

export interface UseCanvasDndResult {
  /**
   * Pass to CanvasHost's `overlay` prop. Non-null exactly while a drag is
   * active (and the hook is enabled + the bridge connected).
   */
  overlay: React.ReactNode;
  /** Whether a dnd-kit drag currently targets the canvas. */
  dragging: boolean;
}

interface DragRects {
  rects: Record<string, CanvasRect>;
  width: number;
  height: number;
}

/**
 * Wires a parent-side DndContext to an iframe canvas. Must be called from a
 * component INSIDE your DndContext (it uses useDndMonitor).
 */
export function useCanvasDnd({
  controller,
  enabled = true,
  isContainer,
  fieldName = "children",
  getDroppableData,
  rootDroppableData,
  onDrop,
}: UseCanvasDndOptions): UseCanvasDndResult {
  // Non-null exactly while a drag is active: the bridge's rect map
  // (iframe-viewport-relative, keyed by bridge id) plus the iframe's client
  // size for clipping off-viewport widgets.
  const [dragRects, setDragRects] = React.useState<DragRects | null>(null);
  const dragActiveRef = React.useRef(false);
  const rectPullRaf = React.useRef(0);

  const optionsRef = React.useRef({
    controller,
    enabled,
    isContainer,
    fieldName,
    getDroppableData,
    rootDroppableData,
    onDrop,
  });
  optionsRef.current = {
    controller,
    enabled,
    isContainer,
    fieldName,
    getDroppableData,
    rootDroppableData,
    onDrop,
  };

  const pullDragRects = React.useCallback(() => {
    const { controller } = optionsRef.current;
    if (!controller) return;
    const map = controller.getRectMap();
    const viewport = controller.getViewportSize();
    if (!map || !viewport) return;
    setDragRects({
      rects: map.rects,
      width: viewport.width,
      height: viewport.height,
    });
  }, []);

  // Rect-map freshness during a drag (iframe scroll, image loads, the drop
  // indicator itself nudging layout observers): re-pull, rAF-batched.
  const scheduleRectPull = React.useCallback(() => {
    if (!dragActiveRef.current || rectPullRaf.current) return;
    rectPullRaf.current = requestAnimationFrame(() => {
      rectPullRaf.current = 0;
      if (dragActiveRef.current) pullDragRects();
    });
  }, [pullDragRects]);

  React.useEffect(() => {
    if (!controller) return;
    return controller.subscribeRectsChanged(scheduleRectPull);
  }, [controller, scheduleRectPull]);

  // Resolve the drop target from a dnd-kit event: only droppables carrying
  // `canvas: true` count. Position math = computeDropPosition on the
  // dnd-kit-measured proxy rect — the same inputs the in-document editor
  // uses, so the indicator always matches what the drop will do.
  const computeTarget = React.useCallback(
    (event: DragMoveEvent | DragOverEvent | DragEndEvent): CanvasDndDropTarget | null => {
      const over = event.over;
      const data = over?.data.current as CanvasDroppableData | undefined;
      if (!over || data?.canvas !== true) return null;
      const bridgeId = typeof data.bridgeInstanceId === "string"
        ? data.bridgeInstanceId
        : null;
      let position: CanvasDropPosition = "into";
      if (data.forceInto !== true && bridgeId != null) {
        const { isContainer, fieldName } = optionsRef.current;
        const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent;
        position = computeDropPosition({
          pointerY: activatorEvent.clientY + event.delta.y,
          rect: { top: over.rect.top, height: over.rect.height },
          isContainer: !!isContainer && isContainer(bridgeId),
          fieldName,
        });
      }
      return {
        bridgeInstanceId: bridgeId,
        position,
        data: data as Record<string, unknown>,
      };
    },
    []
  );

  const updateDropIndicator = React.useCallback(
    (event: DragMoveEvent | DragOverEvent) => {
      const { controller } = optionsRef.current;
      if (!dragActiveRef.current || !controller) return;
      const target = computeTarget(event);
      if (!target) {
        controller.setDropIndicator(null);
        return;
      }
      const indicator: CanvasDropIndicator = {
        // The root droppable has no widget rect; the bridge falls back to
        // highlighting the page content area for "into".
        instanceId: target.bridgeInstanceId ?? CANVAS_ROOT_DROPPABLE_ID,
        position: target.position,
      };
      controller.setDropIndicator(indicator);
    },
    [computeTarget]
  );

  const endDrag = React.useCallback(() => {
    if (!dragActiveRef.current) return;
    dragActiveRef.current = false;
    if (rectPullRaf.current) {
      cancelAnimationFrame(rectPullRaf.current);
      rectPullRaf.current = 0;
    }
    setDragRects(null);
    optionsRef.current.controller?.setDropIndicator(null);
  }, []);

  useDndMonitor(
    React.useMemo(
      () => ({
        onDragStart: () => {
          const { controller, enabled } = optionsRef.current;
          if (!enabled || !controller?.isConnected()) return;
          dragActiveRef.current = true;
          pullDragRects();
        },
        onDragMove: updateDropIndicator,
        onDragOver: updateDropIndicator,
        onDragEnd: (event: DragEndEvent) => {
          const wasActive = dragActiveRef.current;
          endDrag();
          if (!wasActive) return;
          const target = computeTarget(event);
          if (target) optionsRef.current.onDrop?.(event, target);
        },
        onDragCancel: endDrag,
      }),
      [pullDragRects, updateDropIndicator, computeTarget, endDrag]
    )
  );

  const overlay = dragRects ? (
    <CanvasDndOverlay
      dragRects={dragRects}
      getDroppableData={getDroppableData}
      rootDroppableData={rootDroppableData}
    />
  ) : null;

  return { overlay, dragging: dragRects != null };
}

// ---------------------------------------------------------------------------
// Overlay + virtual droppables
// ---------------------------------------------------------------------------

interface CanvasDndOverlayProps {
  dragRects: DragRects;
  getDroppableData?: (
    bridgeInstanceId: string
  ) => Record<string, unknown> | null;
  rootDroppableData?: Record<string, unknown> | null;
}

// Transparent layer exactly covering the iframe (mounted via CanvasHost's
// `overlay` prop). Serves two purposes while a drag is active: (a) the
// parent document keeps receiving pointer events over the canvas, (b) it IS
// the root droppable — pointer over the canvas but not over any widget
// appends to the page (forceInto). Widget rects are iframe-viewport-
// relative, i.e. already in this layer's coordinate space; no translation
// needed.
function CanvasDndOverlay({
  dragRects,
  getDroppableData,
  rootDroppableData,
}: CanvasDndOverlayProps) {
  const rootDisabled = rootDroppableData === null;
  const { setNodeRef } = useDroppable({
    id: CANVAS_ROOT_DROPPABLE_ID,
    disabled: rootDisabled,
    data: {
      canvas: true,
      forceInto: true,
      ...(rootDroppableData ?? {}),
    } satisfies CanvasDroppableData,
  });

  // One proxy per widget visible in the iframe viewport, clamped to it:
  // dnd-kit measures getBoundingClientRect (clipping is ignored), so an
  // unclamped off-screen rect would catch pointer hits outside the canvas.
  const proxies = React.useMemo(() => {
    const out: Array<{
      bridgeId: string;
      rect: CanvasRect;
      data: Record<string, unknown>;
    }> = [];
    for (const [bridgeId, rect] of Object.entries(dragRects.rects)) {
      const extra = getDroppableData ? getDroppableData(bridgeId) : {};
      if (extra === null) continue;
      const clamped = clampRectToViewport(rect, dragRects);
      if (!clamped) continue;
      out.push({ bridgeId, rect: clamped, data: extra ?? {} });
    }
    return out;
  }, [dragRects, getDroppableData]);

  // dnd-kit measures droppables when they register, but NOT when they merely
  // move: after each rect-map refresh re-measure the proxies explicitly so
  // collision detection sees their new positions.
  const { measureDroppableContainers } = useDndContext();
  React.useEffect(() => {
    measureDroppableContainers([
      CANVAS_ROOT_DROPPABLE_ID,
      ...proxies.map((p) => `${CANVAS_DROPPABLE_PREFIX}${p.bridgeId}`),
    ]);
  }, [proxies, measureDroppableContainers]);

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {proxies.map((proxy) => (
        <CanvasProxyDroppable key={proxy.bridgeId} {...proxy} />
      ))}
    </div>
  );
}

interface CanvasProxyDroppableProps {
  bridgeId: string;
  rect: CanvasRect;
  data: Record<string, unknown>;
}

// Invisible stand-in for one widget inside the iframe. Carries
// `{ canvas: true, bridgeInstanceId }` plus whatever the consumer's
// getDroppableData added (e.g. the real instanceId / fieldName), so generic
// drag handlers can resolve it like any other droppable.
function CanvasProxyDroppable({
  bridgeId,
  rect,
  data,
}: CanvasProxyDroppableProps) {
  const { setNodeRef } = useDroppable({
    id: `${CANVAS_DROPPABLE_PREFIX}${bridgeId}`,
    data: {
      canvas: true,
      bridgeInstanceId: bridgeId,
      ...data,
    } satisfies CanvasDroppableData,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
