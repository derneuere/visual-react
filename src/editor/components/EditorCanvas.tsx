// EditorCanvas — the canvas column of the bundled editor (0.4.0).
//
// Mounts the package CanvasHost on the consumer's canvas route (the REQUIRED
// `canvasSrc` of the Editor) and wires it to the editor state:
//   parent -> iframe: draft content (the page root's children), page data,
//                     selection, edit-input mode
//   iframe -> parent: click-to-select, forwarded Delete/Backspace/Escape,
//                     completed bridge-native widget drags (onCanvasDrop ->
//                     moveInstance)
//
// Drag & drop over the canvas comes from useCanvasDnd (called inside the
// Editor's DndContext): while a dnd-kit drag is active a transparent overlay
// covers the iframe and hosts one virtual droppable proxy per rendered
// widget. The proxies carry the same { instanceId, fieldName } data shape as
// the tree-row droppables, so useEditorDnd resolves and inserts identically;
// the drop indicator is mirrored into the iframe by the hook.
//
// The SAME iframe also serves the device previews (Desktop | Mobile): the
// wrapper structure never changes, so the element never remounts, the bridge
// connection survives mode switches and media queries evaluate against the
// true device width.
import React from "react";
import type { Instance } from "../../registry/types";
import { useComponentRegistry } from "../../registry/hooks";
import { useEditor } from "../hooks";
import { moveInstance } from "../../utils/treeUtils";
import {
  CANVAS_DEVICE_PRESETS,
  CanvasHost,
  type CanvasHostController,
} from "../../canvas/CanvasHost";
import { findInstanceByBridgeId } from "../../canvas/canvasUtils";
import { useCanvasDnd } from "../../canvas/dnd";
import { useEditorLabels } from "../labels";
import type { EditorViewMode } from "../types";

export interface EditorCanvasOptions {
  /** URL of the consumer's canvas route (same-origin, mounts CanvasBridge). */
  src: string;
  /** Window-global key the bridge publishes under (must match the bridge). */
  globalKey?: string;
  /** Give up polling for the bridge after this long (per load). */
  connectTimeoutMs?: number;
  /** Extra page-level data pushed through the bridge's pageData channel. */
  pageData?: unknown;
  iframeClassName?: string;
  iframeStyle?: React.CSSProperties;
}

interface EditorCanvasProps {
  canvas: EditorCanvasOptions;
  viewMode: EditorViewMode;
}

export function EditorCanvas({ canvas, viewMode }: EditorCanvasProps) {
  const {
    currentPage: tree,
    setCurrentPage: setTree,
    hasChildren,
    getChildren,
    deleteNode,
  } = useComponentRegistry();
  const { selectedInstanceId, setSelectedInstanceId } = useEditor();
  const labels = useEditorLabels();

  const [controller, setController] =
    React.useState<CanvasHostController | null>(null);

  // Content pushed into the iframe. Stored pages follow the page-root
  // convention (content = [PageRootInstance] whose children are the visible
  // widgets — what the old CurrentPage rendered); a tree without a container
  // root is pushed as-is.
  const root = tree[0];
  const rootIsContainer = !!root && hasChildren(root);
  const draftContent: Instance[] = rootIsContainer
    ? ((root.props.children as Instance[] | undefined) ?? [])
    : tree;
  // Root-proxy appends land in the page root's children.
  const rootInstanceId = rootIsContainer ? root.props.instanceId : null;

  const pageData = React.useMemo(
    () => ({
      title: (root?.props.title as string) ?? "",
      ...(typeof canvas.pageData === "object" && canvas.pageData != null
        ? (canvas.pageData as Record<string, unknown>)
        : {}),
    }),
    [root?.props.title, canvas.pageData]
  );

  // dnd-kit glue: virtual droppable proxies over the iframe while a drag is
  // active in edit mode (drags never target the scaled previews). The proxy
  // data mirrors the tree-row droppables so useEditorDnd's handleDragEnd
  // inserts identically; forceInto on the root proxy makes the whole canvas
  // area append to the page.
  const { overlay } = useCanvasDnd({
    controller,
    enabled: viewMode === "edit",
    fieldName: "children",
    isContainer: (bridgeId) => {
      const instance = findInstanceByBridgeId(tree, bridgeId);
      return !!instance && hasChildren(instance);
    },
    getDroppableData: (bridgeId) => {
      const instance = findInstanceByBridgeId(tree, bridgeId);
      return instance
        ? { instanceId: instance.props.instanceId, fieldName: "children" }
        : null;
    },
    rootDroppableData:
      rootInstanceId != null
        ? { instanceId: rootInstanceId, fieldName: "children" }
        : null,
  });

  // Device-true preview sizes; Desktop is scaled down to fit the column,
  // Mobile renders 1:1 (390px always fits).
  const device =
    viewMode === "edit" ? null : CANVAS_DEVICE_PRESETS[viewMode];

  return (
    <div
      style={{
        flexGrow: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: "auto",
        background: "#f1f3f5",
      }}
    >
      <div
        style={
          device
            ? { padding: "24px 0" }
            : {
                margin: "0 auto",
                height: "100%",
                width: "100%",
                maxWidth: 960,
                padding: "16px",
              }
        }
      >
        <CanvasHost
          src={canvas.src}
          globalKey={canvas.globalKey}
          connectTimeoutMs={canvas.connectTimeoutMs}
          content={draftContent}
          pageData={pageData}
          selectedInstanceId={selectedInstanceId}
          editing={viewMode === "edit"}
          device={device}
          scaleToFit
          fitPadding={48}
          iframeTitle={labels.canvasTitle}
          iframeClassName={canvas.iframeClassName}
          iframeStyle={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
            ...(device ? {} : { minHeight: "70vh" }),
            ...canvas.iframeStyle,
          }}
          onController={setController}
          overlay={overlay}
          onSelect={(bridgeId) => {
            if (bridgeId == null) {
              setSelectedInstanceId(null);
              return;
            }
            const instance = findInstanceByBridgeId(tree, bridgeId);
            setSelectedInstanceId(instance ? instance.props.instanceId : null);
          }}
          // Same behavior as useEditorKeyboardShortcuts for the forwarded keys.
          onKeyDown={(key) => {
            if (viewMode !== "edit") return;
            if (key === "Escape") {
              setSelectedInstanceId(null);
              return;
            }
            if (
              (key === "Delete" || key === "Backspace") &&
              selectedInstanceId != null
            ) {
              deleteNode(selectedInstanceId);
              setSelectedInstanceId(null);
            }
          }}
          // A widget was dragged inside the canvas: same tree mutation as the
          // dnd-kit MOVE path (moveInstance), so both drag flavors behave
          // alike. The updated tree round-trips into the iframe via the
          // host's content push.
          onCanvasDrop={({ activeInstanceId, targetInstanceId, position }) => {
            const active = findInstanceByBridgeId(tree, activeInstanceId);
            const target = findInstanceByBridgeId(tree, targetInstanceId);
            if (!active || !target) return;
            setTree(
              (prev) =>
                moveInstance(
                  prev,
                  active.props.instanceId,
                  target.props.instanceId,
                  position,
                  hasChildren,
                  getChildren
                ) ?? prev
            );
            // Selection follows the moved widget.
            setSelectedInstanceId(active.props.instanceId);
          }}
        />
      </div>
    </div>
  );
}

export default EditorCanvas;
