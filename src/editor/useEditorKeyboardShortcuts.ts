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

export interface UseEditorKeyboardShortcutsOptions {
  /**
   * Gate for the shortcuts (default true). Pass false while the editor is in
   * a read-only state (e.g. a device preview) so shortcuts — especially
   * Delete — cannot silently mutate the page.
   */
  enabled?: boolean;
}

export function useEditorKeyboardShortcuts(
  options?: UseEditorKeyboardShortcutsOptions
) {
  const enabled = options?.enabled ?? true;

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
    undo,
    redo,
  } = useComponentRegistry();

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText(e)) return;

      const isMod = e.metaKey || e.ctrlKey;

      // Escape — deselect
      if (e.key === "Escape") {
        setSelectedInstanceId(null);
        return;
      }

      // Ctrl/Cmd+Z — undo, Ctrl/Cmd+Shift+Z — redo (works without selection)
      if (isMod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      // Ctrl/Cmd+Y — redo
      if (isMod && e.key === "y") {
        e.preventDefault();
        redo();
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
    enabled,
    selectedInstanceId,
    setSelectedInstanceId,
    clipboard,
    setClipboard,
    deleteNode,
    duplicateNode,
    pasteNode,
    findInstance,
    undo,
    redo,
  ]);
}
