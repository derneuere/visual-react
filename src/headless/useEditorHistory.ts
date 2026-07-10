import { useComponentRegistry } from "../registry/hooks";

export interface UseEditorHistoryResult {
  /** Step the page tree back one change. No-op when nothing to undo. */
  undo: () => void;
  /** Step forward one undone change. No-op when nothing to redo. */
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Drop both stacks (keeps the current tree). */
  clear: () => void;
}

/**
 * Undo/redo over the page tree. History is recorded by
 * ComponentRegistryProvider around EVERY tree mutation (setCurrentPage and
 * everything built on it: updateInstanceProps, deleteNode, duplicateNode,
 * pasteNode, addChild, drag moves…), so this works with any editor UI on
 * top. Rapid `updateInstanceProps` calls to the same instance+fields
 * coalesce into one step (typing = one undo); the stack is bounded
 * (ComponentRegistryProvider's `historyLimit`, default 100) and resets on
 * page switches (setPage / switchPage).
 *
 * Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y are wired in
 * useEditorKeyboardShortcuts.
 */
export function useEditorHistory(): UseEditorHistoryResult {
  const { undo, redo, canUndo, canRedo, clearHistory } =
    useComponentRegistry();
  return { undo, redo, canUndo, canRedo, clear: clearHistory };
}
