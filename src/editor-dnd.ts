/**
 * "@derneuere/visual-react/editor/dnd" — headless dnd-kit orchestration for
 * building a custom editor. Separate entry (mirroring "./canvas/dnd") so
 * @dnd-kit/* stay OPTIONAL peer dependencies: the core "." entry never loads
 * dnd-kit; import this entry only when you wire your own DndContext.
 * See docs/headless-editor.md.
 */
export {
  useEditorDnd,
  usePaletteDraggable,
  useTreeDroppable,
  type UseEditorDndOptions,
  type UseEditorDndResult,
  type UsePaletteDraggableOptions,
  type UseTreeDroppableOptions,
  type EditorDropTarget,
} from "./headless/dnd";
