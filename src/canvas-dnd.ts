/**
 * "@derneuere/visual-react/canvas/dnd" — dnd-kit integration for the iframe
 * canvas. Separate entry so @dnd-kit/core stays an OPTIONAL peer dependency:
 * import it only when you wire a parent-side DndContext (e.g. a component
 * palette) to a CanvasHost. See docs/canvas.md.
 */
export {
  useCanvasDnd,
  CANVAS_ROOT_DROPPABLE_ID,
  CANVAS_DROPPABLE_PREFIX,
  type UseCanvasDndOptions,
  type UseCanvasDndResult,
  type CanvasDndDropTarget,
  type CanvasDroppableData,
} from "./canvas/dnd";
