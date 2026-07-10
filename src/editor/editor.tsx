import React from "react";
import { useEditor } from "./hooks";
import { DndContext } from "@dnd-kit/core";
import { CurrentPage } from "./components/CurrentPage";
import { ComponentExplorerModal } from "./components/ComponentExplorerModal";

import "@mantine/core/styles.css";
import "./editor.css";
import TopBar from "./components/TopBar";
import RightSidebar from "./components/RightSidebar";
import LeftSidebar from "./components/LeftSidebar";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import { useEditorDnd } from "../headless/dnd";
import { EditComponentModal } from "./components/EditComponentModal";

interface EditorProps {
  onNavigate?: (href: string) => void;
  /** Endpoint the TopBar "Export Site" button POSTs to (default "/api/export"). */
  exportUrl?: string;
  /** Full override for the export action; when set, exportUrl is ignored. */
  onExport?: () => Promise<void>;
}

export function Editor({ onNavigate, exportUrl, onExport }: EditorProps = {}) {
  const { isPreview, setSelectedInstanceId } = useEditor();

  // Gate shortcuts while previewing so Delete/Backspace/copy/paste/undo
  // cannot silently mutate the page in a read-only state.
  useEditorKeyboardShortcuts({ enabled: !isPreview });

  // All dnd orchestration (sensors, palette-vs-move branching, drop-target
  // indicator math, collision detection, add/move tree mutations) comes from
  // the shared headless hook — the same one custom editors build on.
  const dnd = useEditorDnd();

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
