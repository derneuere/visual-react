// Iframe-canvas editor example — the second editing surface next to the
// classic in-document editor at /editor (which stays untouched).
//
// Demonstrates the full "@derneuere/visual-react/canvas" wiring end-to-end:
//   - CanvasHost renders the /canvas-frame route in an iframe and pushes the
//     draft tree, selection and edit mode through the bridge
//   - click-to-select, hover, Delete/Backspace/Escape forwarding
//   - bridge-native move-drag inside the canvas (onCanvasDrop -> moveInstance)
//   - dnd-kit palette drops onto the canvas via useCanvasDnd (canvas/dnd)
//   - fluid edit view + device-true Desktop/Mobile previews
//
// Edits are in-memory (this example has no save button); reload to reset.
import React, { useEffect } from "react";
import {
  DndContext,
  MouseSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  addItemRelativeToNode,
  addItemToParent,
  moveInstance,
  useComponentRegistry,
  useStorageAdapter,
  type Instance,
} from "@derneuere/visual-react";
import {
  CanvasHost,
  CANVAS_DEVICE_PRESETS,
  findInstanceByBridgeId,
  type CanvasDropEvent,
  type CanvasHostController,
} from "@derneuere/visual-react/canvas";
import { useCanvasDnd } from "@derneuere/visual-react/canvas/dnd";
import { Draggable } from "@derneuere/visual-react/editor";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Route } from "../../routes/canvas-editor/$";

type ViewMode = "edit" | "desktop" | "mobile";

export const CanvasEditorPage = () => {
  const { _splat } = Route.useParams();
  const { switchPage, setPage } = useComponentRegistry();
  const storage = useStorageAdapter();

  const { data } = useSuspenseQuery({
    queryKey: ["page", _splat || "index"],
    queryFn: async () => {
      const pagePath = _splat ? _splat : "index";
      if (pagePath === "favicon.ico") return null;
      try {
        return await storage.loadPage(pagePath);
      } catch {
        return {
          meta: {
            title: "Untitled",
            slug: pagePath,
            status: "draft" as const,
            description: "",
            ogTitle: "",
            ogDescription: "",
            ogImage: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          content: [],
        };
      }
    },
  });

  useEffect(() => {
    switchPage(_splat ?? "index");
    if (data) {
      setPage(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } })
  );

  return (
    <DndContext
      id="canvas-editor"
      sensors={sensors}
      collisionDetection={rectIntersection}
    >
      {/* useCanvasDnd must live INSIDE the DndContext */}
      <CanvasEditorInner />
    </DndContext>
  );
};

function CanvasEditorInner() {
  const {
    currentPage: tree,
    setCurrentPage: setTree,
    hasChildren,
    getChildren,
    getComponentProps,
    getAllRegisteredComponents,
    deleteNode,
    findInstance,
  } = useComponentRegistry();

  const [selectedId, setSelectedId] = React.useState<string | number | null>(
    null
  );
  const [viewMode, setViewMode] = React.useState<ViewMode>("edit");
  const [connected, setConnected] = React.useState(false);
  const [controller, setController] =
    React.useState<CanvasHostController | null>(null);

  // The registry context recreates its functions per render; keep the
  // latest behind refs so the bridge callbacks stay stable.
  const treeRef = React.useRef(tree);
  treeRef.current = tree;
  const registryRef = React.useRef({
    hasChildren,
    getChildren,
    getComponentProps,
    deleteNode,
  });
  registryRef.current = { hasChildren, getChildren, getComponentProps, deleteNode };
  const selectedRef = React.useRef(selectedId);
  selectedRef.current = selectedId;

  // Flat page content = the Page root's children (the Page chrome itself is
  // not part of the canvas render, mirroring the public CurrentPage view).
  const draftContent =
    (tree[0]?.props.children as Instance[] | undefined) ?? [];

  const handleSelect = React.useCallback((bridgeId: string | null) => {
    if (bridgeId == null) {
      setSelectedId(null);
      return;
    }
    const instance = findInstanceByBridgeId(treeRef.current, bridgeId);
    setSelectedId(instance ? instance.props.instanceId : null);
  }, []);

  const handleKeyDown = React.useCallback((key: string) => {
    if (key === "Escape") {
      setSelectedId(null);
      return;
    }
    if ((key === "Delete" || key === "Backspace") && selectedRef.current != null) {
      registryRef.current.deleteNode(selectedRef.current);
      setSelectedId(null);
    }
  }, []);

  // A widget was dragged inside the canvas: same tree mutation as the
  // in-document editor's move path (moveInstance); the updated tree
  // round-trips into the iframe via CanvasHost's content push.
  const handleCanvasDrop = React.useCallback(
    (drop: CanvasDropEvent) => {
      const { hasChildren, getChildren } = registryRef.current;
      const active = findInstanceByBridgeId(treeRef.current, drop.activeInstanceId);
      const target = findInstanceByBridgeId(treeRef.current, drop.targetInstanceId);
      if (!active || !target) return;
      setTree(
        (prev) =>
          moveInstance(
            prev,
            active.props.instanceId,
            target.props.instanceId,
            drop.position,
            hasChildren,
            getChildren
          ) ?? prev
      );
      setSelectedId(active.props.instanceId);
    },
    [setTree]
  );

  // dnd-kit glue: virtual droppables over the iframe while a palette drag is
  // active; drops add a new instance at the reported target.
  const rootBridgeId =
    tree[0] != null ? String(tree[0].props.instanceId) : undefined;
  const { overlay } = useCanvasDnd({
    controller,
    enabled: viewMode === "edit",
    isContainer: (bridgeId) => {
      const instance = findInstanceByBridgeId(treeRef.current, bridgeId);
      return instance ? registryRef.current.hasChildren(instance) : false;
    },
    rootDroppableData: rootBridgeId
      ? { bridgeInstanceId: rootBridgeId }
      : null,
    onDrop: (event, target) => {
      // Only palette adds arrive here — moves happen bridge-natively.
      if (event.active.data.current?.add !== true) return;
      const { hasChildren, getChildren, getComponentProps } =
        registryRef.current;
      const componentId = String(event.active.id);
      const meta = getComponentProps(componentId);
      if (!meta) return;
      const newItem: Instance = {
        id: componentId,
        props: { ...meta.defaultProps, instanceId: Date.now() },
      };
      const targetInstance = target.bridgeInstanceId
        ? findInstanceByBridgeId(treeRef.current, target.bridgeInstanceId)
        : null;
      if (!targetInstance) return;
      if (target.position === "into" && hasChildren(targetInstance)) {
        setTree((prev) =>
          addItemToParent(
            prev,
            targetInstance.props.instanceId,
            newItem,
            hasChildren,
            getChildren
          )
        );
      } else {
        setTree((prev) =>
          addItemRelativeToNode(
            prev,
            targetInstance.props.instanceId,
            newItem,
            target.position === "above" ? "above" : "below",
            hasChildren,
            getChildren
          )
        );
      }
      setSelectedId(newItem.props.instanceId);
    },
  });

  const paletteComponents = getAllRegisteredComponents().filter(
    (id) => id !== "Page"
  );
  const selectedInstance = findInstance(selectedId);

  const viewButton = (mode: ViewMode, label: string) => (
    <button
      key={mode}
      type="button"
      data-testid={`viewmode-${mode}`}
      onClick={() => setViewMode(mode)}
      style={{
        padding: "4px 12px",
        borderRadius: 4,
        border: "1px solid #ced4da",
        background: viewMode === mode ? "#228be6" : "#fff",
        color: viewMode === mode ? "#fff" : "#333",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 16px",
          borderBottom: "1px solid #dee2e6",
        }}
      >
        <strong style={{ fontSize: 14 }}>Canvas editor (iframe)</strong>
        <span style={{ fontSize: 12, color: "#868e96" }}>
          in-memory example — the classic editor lives at /editor
        </span>
        <span style={{ flexGrow: 1 }} />
        {viewButton("edit", "Edit")}
        {viewButton("desktop", "Desktop")}
        {viewButton("mobile", "Mobile")}
        <span
          data-testid="canvas-connection"
          style={{ fontSize: 12, color: connected ? "#2f9e44" : "#e03131" }}
        >
          {connected ? "connected" : "connecting…"}
        </span>
      </header>

      <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        {/* Palette: drag components onto the canvas */}
        <aside
          style={{
            width: 200,
            overflowY: "auto",
            borderRight: "1px solid #dee2e6",
            padding: 8,
          }}
        >
          <div style={{ fontSize: 12, color: "#868e96", marginBottom: 8 }}>
            Drag onto the canvas
          </div>
          {paletteComponents.map((id) => (
            <div key={id} data-testid={`canvas-palette-${id}`}>
              <Draggable
                id={id}
                add
                style={{ margin: "0 0 8px 0", padding: 10, fontSize: 13 }}
              >
                {getComponentProps(id)?.name ?? id}
              </Draggable>
            </div>
          ))}
        </aside>

        {/* The iframe canvas */}
        <div
          style={{
            flexGrow: 1,
            minWidth: 0,
            overflow: "auto",
            background: "#f1f3f5",
            padding: 16,
          }}
        >
          <CanvasHost
            src="/canvas-frame"
            content={draftContent}
            pageData={{ title: tree[0]?.props.title ?? "" }}
            selectedInstanceId={selectedId}
            editing={viewMode === "edit"}
            device={
              viewMode === "edit" ? null : CANVAS_DEVICE_PRESETS[viewMode]
            }
            fitPadding={32}
            connectTimeoutMs={30000}
            onSelect={handleSelect}
            onKeyDown={handleKeyDown}
            onCanvasDrop={handleCanvasDrop}
            onConnectedChange={setConnected}
            onController={setController}
            overlay={overlay}
            iframeStyle={{
              background: "#fff",
              borderRadius: 8,
              boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
              minHeight: viewMode === "edit" ? "calc(100vh - 90px)" : undefined,
            }}
          />
        </div>

        {/* Selection panel */}
        <aside
          style={{
            width: 240,
            borderLeft: "1px solid #dee2e6",
            padding: 12,
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 12, color: "#868e96", marginBottom: 8 }}>
            Selection
          </div>
          {selectedInstance ? (
            <>
              <div data-testid="canvas-selected-label" style={{ fontWeight: 600 }}>
                {getComponentProps(selectedInstance.id)?.name ??
                  selectedInstance.id}
              </div>
              <div style={{ color: "#868e96", margin: "4px 0 12px" }}>
                #{String(selectedInstance.props.instanceId)}
              </div>
              <button
                type="button"
                data-testid="canvas-delete-selected"
                onClick={() => {
                  deleteNode(selectedInstance.props.instanceId);
                  setSelectedId(null);
                }}
                style={{
                  padding: "4px 12px",
                  borderRadius: 4,
                  border: "1px solid #e03131",
                  background: "#fff",
                  color: "#e03131",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </>
          ) : (
            <div data-testid="canvas-selected-label" style={{ color: "#868e96" }}>
              Nothing selected — click a widget in the canvas.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
