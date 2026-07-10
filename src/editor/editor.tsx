// Editor — the bundled Mantine editor (0.4.0, canvas-only).
//
// The page is edited exclusively through an iframe canvas: the consumer
// provides a canvas route (a bare page mounting "@derneuere/visual-react/
// canvas"'s CanvasBridge, rendering pushed content through the same
// renderer as the public pages) and passes its URL as `canvasSrc`. The
// editor mounts CanvasHost on it and wires selection, key forwarding,
// bridge-native move drags, dnd-kit palette drops (useCanvasDnd +
// useEditorDnd) and device-true previews around it.
//
// Layout: TopBar (undo/redo, Edit|Desktop|Mobile, save/publish/export)
// above three columns — LeftSidebar (pages | palette + layer tree),
// the canvas, RightSidebar (breadcrumb + property panel).
//
// The in-document editing mode (SortableItem chrome rendered into the page
// markup itself) was removed in 0.4.0.
import React from "react";
import { DndContext } from "@dnd-kit/core";

import "@mantine/core/styles.css";
import "./editor.css";
import { useEditor } from "./hooks";
import TopBar from "./components/TopBar";
import RightSidebar from "./components/RightSidebar";
import LeftSidebar from "./components/LeftSidebar";
import { EditorCanvas, type EditorCanvasOptions } from "./components/EditorCanvas";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import { useEditorDnd } from "../headless/dnd";
import { EditorLabelsProvider, type EditorLabels } from "./labels";
import type { EditorViewMode } from "./types";

export interface EditorProps {
  /**
   * URL of the canvas route (REQUIRED — shorthand for `canvas={{ src }}`).
   * The route must mount CanvasBridge from "@derneuere/visual-react/canvas"
   * and render the pushed content (see docs/canvas.md).
   */
  canvasSrc?: string;
  /** Canvas configuration; `canvas.src` and `canvasSrc` are equivalent. */
  canvas?: EditorCanvasOptions;
  /** Page-navigation callback for the Pages sidebar. */
  onNavigate?: (href: string) => void;
  /** Endpoint the TopBar "Export Site" button POSTs to (default "/api/export"). */
  exportUrl?: string;
  /** Full override for the export action; when set, exportUrl is ignored. */
  onExport?: () => Promise<void>;
  /** Partial label override for localizing the editor chrome. */
  labels?: Partial<EditorLabels>;
}

export function Editor({
  canvasSrc,
  canvas,
  onNavigate,
  exportUrl,
  onExport,
  labels,
}: EditorProps) {
  const canvasOptions: EditorCanvasOptions | null = canvas
    ? canvas
    : canvasSrc
      ? { src: canvasSrc }
      : null;
  if (!canvasOptions?.src) {
    throw new Error(
      "[visual-react] <Editor> requires a canvas route since 0.4.0: pass " +
        'canvasSrc="/your-canvas-route" (or canvas={{ src }}). The route must ' +
        'mount CanvasBridge from "@derneuere/visual-react/canvas" — see the ' +
        "MIGRATION section of the CHANGELOG."
    );
  }

  const { setIsPreview, setSelectedInstanceId } = useEditor();

  // View mode: structural editing vs device-true preview. All three modes
  // use the SAME canvas iframe (its own viewport — media queries evaluate
  // against the device width, so mobile really renders mobile); the mode
  // only resizes it and toggles the bridge's edit input.
  const [viewMode, setViewMode] = React.useState<EditorViewMode>("edit");

  // Keep the context's isPreview in sync so chrome that renders outside the
  // editor (and the keyboard-shortcut gate below) sees the read-only state.
  React.useEffect(() => {
    setIsPreview(viewMode !== "edit");
    if (viewMode !== "edit") setSelectedInstanceId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Device previews are read-only: no editor chrome shows the selection, so
  // shortcuts (esp. Delete, but also undo/redo) must not silently mutate the
  // page.
  useEditorKeyboardShortcuts({ enabled: viewMode === "edit" });

  // The shared headless dnd orchestration: palette adds (usePaletteDraggable
  // entries in ComponentPalette), tree-row drops (useTreeDroppable rows in
  // ComponentTree) and the canvas proxies (useCanvasDnd in EditorCanvas) all
  // resolve through one set of handlers.
  const dnd = useEditorDnd();

  return (
    <EditorLabelsProvider labels={labels}>
      <DndContext
        id="editor"
        sensors={dnd.sensors}
        collisionDetection={dnd.collisionDetection}
        {...dnd.handlers}
      >
        <div
          className="vr-editor"
          style={{
            height: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <TopBar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            exportUrl={exportUrl}
            onExport={onExport}
          />
          {/* Sidebars hide in preview modes; the canvas stays mounted so the
              iframe (and its bridge connection) survives mode switches. */}
          <div style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
            {viewMode === "edit" && <LeftSidebar onNavigate={onNavigate} />}
            <EditorCanvas canvas={canvasOptions} viewMode={viewMode} />
            {viewMode === "edit" && <RightSidebar />}
          </div>
        </div>
      </DndContext>
    </EditorLabelsProvider>
  );
}
