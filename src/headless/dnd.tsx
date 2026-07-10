// Headless dnd orchestration — the "@derneuere/visual-react/editor/dnd"
// entry. Kept OUT of the core "." entry for the same reason as
// "./canvas/dnd": @dnd-kit/* are optional peers, and the core entry must
// stay importable without them. Import this entry only when you build a
// drag-and-drop editing surface.
//
// useEditorDnd owns the drag semantics every visual-react editor shares
// (ported from the julis Bezirksseiten editor, the reference
// implementation):
//
//   - palette-vs-move branching (the "adding" flag),
//   - pointer-Y drop-indicator math feeding computeDropPosition and
//     useEditor().dropTarget (with the forceInto root-proxy convention),
//   - three-tier collision detection: real droppables win via pointerWithin;
//     over an iframe canvas the virtual proxies (data.canvas === true) are
//     hit-tested innermost-first by rect area; elsewhere the fallback is
//     rectIntersection while adding, closestCorners while moving,
//   - the nesting guard: a drop nests into a container only for
//     position === "into" or a specialized (non-"children") child field —
//     container edges reorder as siblings, matching the indicator,
//   - palette-add instance construction (crypto.randomUUID + the registry's
//     defaultProps) choosing addItemToParent vs addItemRelativeToNode,
//   - moves via the shared moveInstance util (null = no-op),
//   - bridge-id -> real-id resolution (findInstanceByBridgeId) for canvas
//     proxies that don't carry a real instanceId in their data.
//
// The consumer owns the DndContext:
//
//   const dnd = useEditorDnd();
//   <DndContext sensors={dnd.sensors} collisionDetection={dnd.collisionDetection}
//               {...dnd.handlers}> … </DndContext>
//
// Droppable/draggable data contracts (guaranteed by usePaletteDraggable /
// useTreeDroppable, mirrored by the canvas proxies via useCanvasDnd's
// getDroppableData):
//   palette drag source:  { source: "palette", widgetKey }
//   drop target:          { instanceId, fieldName }  (+ forceInto / canvas)
import React from "react";
import {
  KeyboardSensor,
  MouseSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Active,
  type DragCancelEvent,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
  type UseDraggableArguments,
  type UseDroppableArguments,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { Instance } from "../registry/types";
import { useComponentRegistry } from "../registry/hooks";
import { useEditor } from "../editor/hooks";
import {
  addItemRelativeToNode,
  addItemToParent,
  findNode,
  moveInstance,
} from "../utils/treeUtils";
import { computeDropPosition, type DropPosition } from "../utils/dropPosition";
import { findInstanceByBridgeId } from "../canvas/canvasUtils";

/** Resolved drop target reported by the onInstanceAdded/onInstanceMoved callbacks. */
export interface EditorDropTarget {
  /** Real instanceId of the node the drop resolved against. */
  targetInstanceId: number | string;
  position: DropPosition;
  /** Container child field the drop zone represented (default "children"). */
  fieldName: string;
}

export interface UseEditorDndOptions {
  /**
   * Anything truthy (e.g. the CanvasHostController from CanvasHost's
   * `onController`) declares that an iframe canvas participates: its virtual
   * proxy droppables (data.canvas === true, from useCanvasDnd) then get
   * their own innermost-first collision tier, and proxies carrying only a
   * bridgeInstanceId are resolved to real ids via findInstanceByBridgeId.
   * Canvas droppables only exist while useCanvasDnd renders its overlay, so
   * leaving this unset simply skips that tier.
   */
  canvasController?: unknown;
  /**
   * Classify the dragged item as a palette add. Default: data.source ===
   * "palette" (usePaletteDraggable's contract) or data.add === true (the
   * legacy bundled-editor Draggable contract).
   */
  isPaletteDrag?: (active: Active) => boolean;
  /** A new instance was inserted from the palette. */
  onInstanceAdded?: (instance: Instance, target: EditorDropTarget) => void;
  /** An existing instance was moved (only fires when the move applied). */
  onInstanceMoved?: (
    instanceId: number | string,
    target: EditorDropTarget
  ) => void;
}

export interface UseEditorDndResult {
  /** Pass to your DndContext. Pointer/mouse (8px activation) + keyboard. */
  sensors: ReturnType<typeof useSensors>;
  /** Pass to your DndContext. */
  collisionDetection: CollisionDetection;
  /** Spread onto your DndContext: {...dnd.handlers}. */
  handlers: {
    onDragStart: (event: DragStartEvent) => void;
    onDragOver: (event: DragOverEvent) => void;
    onDragMove: (event: DragMoveEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDragCancel: (event: DragCancelEvent) => void;
  };
  /** True while a palette item is being dragged. */
  adding: boolean;
}

const defaultIsPaletteDrag = (active: Active): boolean => {
  const data = active.data.current as
    | { source?: unknown; add?: unknown }
    | undefined;
  return data?.source === "palette" || data?.add === true;
};

export function useEditorDnd(
  options: UseEditorDndOptions = {}
): UseEditorDndResult {
  const {
    currentPage: tree,
    setCurrentPage: setTree,
    hasChildren,
    getChildren,
    getComponentProps,
  } = useComponentRegistry();

  const { dropTarget, setDropTarget, setDraggedInstanceId } = useEditor();

  const [adding, setAdding] = React.useState(false);
  const addingRef = React.useRef(false);

  // Handlers close over the latest tree/options via a ref so long drags
  // never act on a stale snapshot.
  const ctxRef = React.useRef({
    tree,
    hasChildren,
    getChildren,
    getComponentProps,
    dropTarget,
    options,
  });
  ctxRef.current = {
    tree,
    hasChildren,
    getChildren,
    getComponentProps,
    dropTarget,
    options,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Resolve the REAL instanceId a droppable stands for:
  //   1. explicit data.instanceId (tree rows, canvas proxies with consumer
  //      data, in-document sortables),
  //   2. canvas proxies that only know their bridge id,
  //   3. the droppable id itself (legacy in-document convention).
  const resolveOverInstanceId = React.useCallback(
    (data: Record<string, unknown> | undefined, fallbackId: UniqueIdentifier) => {
      const explicit = data?.instanceId;
      if (typeof explicit === "string" || typeof explicit === "number") {
        return explicit;
      }
      const bridgeId = data?.bridgeInstanceId;
      if (typeof bridgeId === "string") {
        const instance = findInstanceByBridgeId(ctxRef.current.tree, bridgeId);
        if (instance) return instance.props.instanceId;
      }
      return fallbackId;
    },
    []
  );

  // Three-tier collision detection (see module docs).
  const collisionDetection: CollisionDetection = React.useCallback(
    (args) => {
      const realContainers = args.droppableContainers.filter(
        (c) => c.data.current?.canvas !== true
      );

      const pointerHits = pointerWithin({
        ...args,
        droppableContainers: realContainers,
      });
      if (pointerHits.length > 0) return pointerHits;

      const canvasContainers = args.droppableContainers.filter(
        (c) => c.data.current?.canvas === true
      );
      if (canvasContainers.length > 0) {
        const canvasHits = pointerWithin({
          ...args,
          droppableContainers: canvasContainers,
        });
        if (canvasHits.length > 0) {
          // Nested proxies overlap (a Section covers its children): the
          // innermost = smallest rect wins; the full-iframe root proxy only
          // matches when no widget is under the pointer.
          const area = (id: UniqueIdentifier) => {
            const rect = args.droppableRects.get(id);
            return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;
          };
          return [...canvasHits].sort((a, b) => area(a.id) - area(b.id));
        }
      }

      return (addingRef.current ? rectIntersection : closestCorners)({
        ...args,
        droppableContainers: realContainers,
      });
    },
    []
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    const { options } = ctxRef.current;
    const isPalette = (options.isPaletteDrag ?? defaultIsPaletteDrag)(
      event.active
    );
    setAdding(isPalette);
    addingRef.current = isPalette;
    if (!isPalette) {
      const data = event.active.data.current as
        | { instanceId?: number | string }
        | undefined;
      setDraggedInstanceId(data?.instanceId ?? event.active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recompute the drop-target indicator from the current pointer position;
  // shared pure math in computeDropPosition.
  const updateDropTargetIndicator = React.useCallback(
    (event: DragOverEvent | DragMoveEvent) => {
      const { over } = event;
      if (!over || !over.id) return;
      const { tree, hasChildren, getChildren, dropTarget } = ctxRef.current;

      const data = over.data.current as Record<string, unknown> | undefined;
      const fieldName = (data?.fieldName as string) || "children";
      const overNodeId = resolveOverInstanceId(data, over.id);

      const overNode = findNode(tree, overNodeId, hasChildren, getChildren);
      const isContainer = !!overNode && hasChildren(overNode);

      // Use the actual pointer position (not the dragged element's center,
      // which is offset from the cursor for tall elements). Keyboard drags
      // have no pointer: fall back to the target's vertical middle.
      const activatorEvent = event.activatorEvent as
        | PointerEvent
        | MouseEvent
        | undefined;
      const pointerY =
        typeof activatorEvent?.clientY === "number"
          ? activatorEvent.clientY + event.delta.y
          : over.rect.top + over.rect.height / 2;

      // forceInto (e.g. the canvas root proxy = whole iframe area) always
      // appends into the target.
      const position = data?.forceInto
        ? "into"
        : computeDropPosition({
            pointerY,
            rect: { top: over.rect.top, height: over.rect.height },
            isContainer,
            fieldName,
          });

      if (
        dropTarget?.id !== overNodeId ||
        dropTarget?.fieldName !== fieldName ||
        dropTarget?.position !== position
      ) {
        setDropTarget({ id: overNodeId, fieldName, position });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolveOverInstanceId]
  );

  const clearDragState = React.useCallback(() => {
    setAdding(false);
    addingRef.current = false;
    setDraggedInstanceId(null);
    setDropTarget(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const {
        tree,
        hasChildren,
        getChildren,
        getComponentProps,
        dropTarget,
        options,
      } = ctxRef.current;
      const wasAdding = addingRef.current;
      const dropPosition = dropTarget?.position || "into";

      clearDragState();

      if (!over) return;

      const overData = over.data.current as
        | Record<string, unknown>
        | undefined;
      const overNodeId = resolveOverInstanceId(overData, over.id);
      const overNode = findNode(tree, overNodeId, hasChildren, getChildren);
      if (!overNode) return;
      const overFieldName = overData?.fieldName as string | undefined;

      // --- ADD a new instance from the palette ---------------------------
      if (wasAdding) {
        const activeData = active.data.current as
          | { widgetKey?: unknown }
          | undefined;
        const widgetKey =
          typeof activeData?.widgetKey === "string"
            ? activeData.widgetKey
            : String(active.id);
        const metadata = getComponentProps(widgetKey);
        if (!metadata) return;

        const newItem: Instance = {
          id: widgetKey,
          props: {
            ...metadata.defaultProps,
            // crypto.randomUUID() over Date.now(): fast successive adds
            // within the same millisecond must not collide.
            instanceId: crypto.randomUUID(),
          },
        };

        // Nesting guard: drop INTO a container only when the indicator said
        // "into" or the drop zone represents a specialized child field. The
        // generic "children" fieldName is the default every drop zone
        // carries, so it must not force nesting — container edges reorder
        // as siblings, matching the indicator.
        const nest =
          hasChildren(overNode) &&
          (dropPosition === "into" ||
            (!!overFieldName && overFieldName !== "children"));

        if (nest) {
          setTree((prev) =>
            addItemToParent(
              prev,
              overNode.props.instanceId,
              newItem,
              hasChildren,
              getChildren
            )
          );
        } else {
          setTree((prev) =>
            addItemRelativeToNode(
              prev,
              overNode.props.instanceId,
              newItem,
              dropPosition === "above" ? "above" : "below",
              hasChildren,
              getChildren
            )
          );
        }
        options.onInstanceAdded?.(newItem, {
          targetInstanceId: overNode.props.instanceId,
          position: nest ? "into" : dropPosition === "above" ? "above" : "below",
          fieldName: overFieldName || "children",
        });
        return;
      }

      // --- MOVE / REORDER an existing instance ----------------------------
      // All tree surgery (self/descendant guards, sibling reorder honoring
      // above/below, "into" appending, node-count sanity check) lives in the
      // shared moveInstance util; null = no-op/invalid.
      const activeData = active.data.current as
        | Record<string, unknown>
        | undefined;
      const activeId = resolveOverInstanceId(activeData, active.id);

      const next = moveInstance(
        tree,
        activeId,
        overNodeId,
        dropPosition,
        hasChildren,
        getChildren,
        overFieldName
      );
      if (next) {
        setTree(next);
        options.onInstanceMoved?.(activeId, {
          targetInstanceId: overNode.props.instanceId,
          position: dropPosition,
          fieldName: overFieldName || "children",
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearDragState, resolveOverInstanceId, setTree]
  );

  const handlers = React.useMemo(
    () => ({
      onDragStart: handleDragStart,
      onDragOver: updateDropTargetIndicator,
      onDragMove: updateDropTargetIndicator,
      onDragEnd: handleDragEnd,
      onDragCancel: clearDragState,
    }),
    [handleDragStart, updateDropTargetIndicator, handleDragEnd, clearDragState]
  );

  return { sensors, collisionDetection, handlers, adding };
}

// ---------------------------------------------------------------------------
// Data-contract wrappers
// ---------------------------------------------------------------------------

export interface UsePaletteDraggableOptions {
  disabled?: boolean;
  /** Extra data merged UNDER the contract keys (source/widgetKey win). */
  data?: Record<string, unknown>;
  /** Override the droppable id (default `palette:<widgetKey>`). */
  id?: UseDraggableArguments["id"];
}

/**
 * A palette entry that inserts a new `widgetKey` instance on drop. Thin
 * useDraggable wrapper that GUARANTEES the `{ source: "palette", widgetKey }`
 * data contract useEditorDnd's palette branch relies on.
 */
export function usePaletteDraggable(
  widgetKey: string,
  options: UsePaletteDraggableOptions = {}
) {
  return useDraggable({
    id: options.id ?? `palette:${widgetKey}`,
    disabled: options.disabled,
    data: { ...options.data, source: "palette", widgetKey },
  });
}

export interface UseTreeDroppableOptions {
  disabled?: boolean;
  /** Extra data merged UNDER the contract keys (instanceId/fieldName win). */
  data?: Record<string, unknown>;
  /** Override the droppable id (default `tree:<instanceId>[:<fieldName>]`). */
  id?: UseDroppableArguments["id"];
}

/**
 * A drop target standing for an instance (e.g. a layer-tree row). Thin
 * useDroppable wrapper that GUARANTEES the `{ instanceId, fieldName }` data
 * contract — the same shape the canvas proxies carry — so one set of
 * useEditorDnd handlers serves tree rows and canvas alike.
 *
 * Besides the useDroppable fields it returns the resolved indicator state
 * for this row: `isActiveTarget` and `position` (from useEditor's
 * dropTarget), ready to render an insertion line / nesting ring.
 */
export function useTreeDroppable(
  instanceId: number | string,
  fieldName: string = "children",
  options: UseTreeDroppableOptions = {}
) {
  const { dropTarget } = useEditor();
  const droppable = useDroppable({
    id:
      options.id ??
      (fieldName === "children"
        ? `tree:${instanceId}`
        : `tree:${instanceId}:${fieldName}`),
    disabled: options.disabled,
    data: { ...options.data, instanceId, fieldName },
  });

  const isActiveTarget =
    droppable.isOver &&
    dropTarget?.id === instanceId &&
    (dropTarget?.fieldName || "children") === fieldName;

  return {
    ...droppable,
    /** True when the shared drop indicator points at THIS row. */
    isActiveTarget,
    /** Indicator position for this row (undefined when not targeted). */
    position: isActiveTarget ? dropTarget?.position : undefined,
  };
}
