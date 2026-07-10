import { useEffect } from "react";
import { useEditor } from "./hooks";
import { useComponentRegistry } from "../registry/hooks";

function isEditingText(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  );
}

export function useEditorKeyboardShortcuts() {
  const {
    selectedInstanceId,
    setSelectedInstanceId,
    clipboard,
    setClipboard,
  } = useEditor();

  const {
    deleteNode,
    duplicateNode,
    pasteNode,
    findInstance,
  } = useComponentRegistry();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText(e)) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Escape — deselect
      if (e.key === "Escape") {
        setSelectedInstanceId(null);
        return;
      }

      if (!selectedInstanceId) return;

      // Delete / Backspace — delete selected
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteNode(selectedInstanceId);
        setSelectedInstanceId(null);
        return;
      }

      // Ctrl/Cmd+C — copy
      if (isMod && e.key === "c") {
        e.preventDefault();
        const node = findInstance(selectedInstanceId);
        if (node) setClipboard(node);
        return;
      }

      // Ctrl/Cmd+D — duplicate
      if (isMod && e.key === "d") {
        e.preventDefault();
        duplicateNode(selectedInstanceId);
        return;
      }

      // Ctrl/Cmd+V — paste
      if (isMod && e.key === "v") {
        if (!clipboard) return;
        e.preventDefault();
        pasteNode(clipboard, selectedInstanceId, "below");
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedInstanceId,
    setSelectedInstanceId,
    clipboard,
    setClipboard,
    deleteNode,
    duplicateNode,
    pasteNode,
    findInstance,
  ]);
}
