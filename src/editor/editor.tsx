import React from "react";
import { Instance } from "../registry/types";
import { useComponentRegistry } from "../registry/hooks";
import {
  findNode,
  moveInstance,
  addItemToParent,
  addItemRelativeToNode,
  computeDropPosition,
} from "../utils";
import { useEditor } from "./hooks";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  MouseSensor,
  useSensor,
  useSensors,
  DragOverEvent,
  DragStartEvent,
  DragEndEvent,
  DragMoveEvent,
  closestCorners,
  rectIntersection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CurrentPage } from "./components/CurrentPage";
import { ComponentExplorerModal } from "./components/ComponentExplorerModal";

import "@mantine/core/styles.css";
import "./editor.css";
import TopBar from "./components/TopBar";
import RightSidebar from "./components/RightSidebar";
import LeftSidebar from "./components/LeftSidebar";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import { EditComponentModal } from "./components/EditComponentModal";

interface EditorProps {
  onNavigate?: (href: string) => void;
  /** Endpoint the TopBar "Export Site" button POSTs to (default "/api/export"). */
  exportUrl?: string;
  /** Full override for the export action; when set, exportUrl is ignored. */
  onExport?: () => Promise<void>;
}

export function Editor({ onNavigate, exportUrl, onExport }: EditorProps = {}) {
  const {
    currentPage: tree,
    setCurrentPage: setTree,
    hasChildren,
    getChildren,
    getComponentProps,
  } = useComponentRegistry();

  const { setDraggedInstanceId, isPreview, setDropTarget, dropTarget, setSelectedInstanceId } =
    useEditor();

  // Gate shortcuts while previewing so Delete/Backspace/copy/paste cannot
  // silently mutate the page in a read-only state.
  useEditorKeyboardShortcuts({ enabled: !isPreview });

  // Capture phase so it fires before SortableItem's stopPropagation
  const handleLinkCapture = React.useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip anchors, javascript:, mailto:, tel:
      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      // Skip links that explicitly open in a new tab
      if (anchor.target === "_blank") return;

      // Always prevent default to stop browser navigation away from the editor
      e.preventDefault();

      // Only navigate in preview mode — in edit mode, let component selection happen
      if (isPreview && onNavigate) {
        onNavigate(href);
      }
    },
    [onNavigate, isPreview]
  );

  const [adding, setAdding] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Increase activation constraint distance for more precise dragging
      activationConstraint: {
        distance: 8, // Activate after moving 8px
      },
    }),
    useSensor(MouseSensor, {
      // Add mouse sensor to get more frequent updates during dragging
      activationConstraint: {
        distance: 8, // Activate after moving 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.add) {
      setAdding(true);
      return;
    }
    setAdding(false);
    setDraggedInstanceId(event.active.id);
  };

  // Helper function to update drop target indicators based on current cursor position
  const updateDropTargetIndicator = (event: DragOverEvent | DragMoveEvent) => {
    const { over } = event;

    // If there is no target to drag over, exit early
    if (!over) return;

    // Skip if no valid over target
    if (!over.id) return;

    // Use the actual pointer position (not the dragged element's center,
    // which is offset from the cursor for tall elements)
    const activatorEvent = event.activatorEvent as PointerEvent | MouseEvent;
    const pointerY = activatorEvent.clientY + event.delta.y;

    // Get the field name if available
    const fieldName = over.data.current?.fieldName || "children";

    // Get the over node's ID (might be different from over.id which could be a droppable container ID)
    const overNodeId = over.data.current?.instanceId || over.id;

    // Check if the over element has children (is a container)
    const overNode = findNode(tree, overNodeId, hasChildren, getChildren);
    const isContainer = !!(overNode && hasChildren(overNode));

    // Shared pure drop-position math (specialized fields -> "into", container
    // edges -> above/below vs middle -> "into", leaves -> above/below).
    const position = computeDropPosition({
      pointerY,
      rect: { top: over.rect.top, height: over.rect.height },
      isContainer,
      fieldName,
    });

    // Only update if position or target has changed
    if (
      dropTarget?.id !== overNodeId ||
      dropTarget?.fieldName !== fieldName ||
      dropTarget?.position !== position
    ) {
      setDropTarget({
        id: overNodeId,
        fieldName,
        position,
      });
    }
  };

  // When dragging over a new element
  const handleDragOver = (event: DragOverEvent) => {
    updateDropTargetIndicator(event);
  };

  // When moving the cursor while dragging (more frequent updates)
  const handleDragMove = (event: DragMoveEvent) => {
    // More frequent updates during drag to capture position changes without needing to enter new elements
    updateDropTargetIndicator(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Get the drop position from the context
    const dropPosition = dropTarget?.position || "into";

    // Clear drag and drop states
    setDraggedInstanceId(null);
    setDropTarget(null);

    if (!over) return;

    // Handle adding a new component from the sidebar palette
    if (adding) {
      setAdding(false);
      const componentId = active.id as string;
      const defaultProps = getComponentProps(componentId);
      if (!defaultProps) return;

      const newItem: Instance = {
        id: componentId,
        props: {
          ...defaultProps.defaultProps,
          // crypto.randomUUID() over Date.now(): fast successive adds within
          // the same millisecond must not collide.
          instanceId: crypto.randomUUID(),
        },
      };

      const overNodeId = over.data.current?.instanceId || over.id;
      const overNode = findNode(tree, overNodeId, hasChildren, getChildren);
      if (!overNode) return;

      const overFieldName = over.data.current?.fieldName;

      // If dropping onto a container, add into it (addItemToParent derives
      // the child field itself, so no field guard here — one used to
      // spuriously abort adds into empty containers).
      if (hasChildren(overNode) && (dropPosition === "into" || overFieldName)) {
        setTree((prev) =>
          addItemToParent(prev, overNode.props.instanceId, newItem, hasChildren, getChildren)
        );
      } else {
        // Add relative to the target node
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
      return;
    }

    // Moving an existing node: all the tree surgery (self/descendant guards,
    // sibling reorder honoring above/below, "into" appending to a container,
    // node-count sanity check) lives in the shared moveInstance util. A null
    // result means no-op/invalid — keep the previous tree.
    setTree(
      (prevTree) =>
        moveInstance(
          prevTree,
          active.data.current?.instanceId || active.id,
          over.data.current?.instanceId || over.id,
          dropPosition,
          hasChildren,
          getChildren,
          over.data.current?.fieldName
        ) ?? prevTree
    );
  };

  if (isPreview) {
    return (
      <div
        className="vr-editor"
        style={{ height: "100vh", display: "flex", flexDirection: "column" }}
      >
        <TopBar exportUrl={exportUrl} onExport={onExport} />
        <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
          <LeftSidebar onNavigate={onNavigate} />
          <div style={{ flexGrow: 1, overflowY: "auto" }} onClickCapture={handleLinkCapture}>
            <CurrentPage />
          </div>
          <RightSidebar />
        </div>
      </div>
    );
  }

  return (
    <DndContext
      id="editor"
      sensors={sensors}
      collisionDetection={adding ? rectIntersection : closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div
        className="vr-editor"
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar exportUrl={exportUrl} onExport={onExport} />
        <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
          <LeftSidebar onNavigate={onNavigate} />
          <div
            style={{
              flexGrow: 1,
              overflowY: "auto",
              height: "calc(100vh - 56px)",
            }}
            onClickCapture={handleLinkCapture}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedInstanceId(null);
              }
            }}
          >
            <CurrentPage />
          </div>
          <RightSidebar />
        </div>
      </div>
      <ComponentExplorerModal></ComponentExplorerModal>
      <EditComponentModal />
    </DndContext>
  );
}
