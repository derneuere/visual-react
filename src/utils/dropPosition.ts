// dropPosition — pure drop-position math shared by the editor's dnd-kit
// handlers (editor.tsx) and any custom drag surface (e.g. an iframe canvas
// host) that needs to translate a pointer position over a drop target into
// the editor's "above" / "below" / "into" semantics.
//
// Semantics (extracted from Editor.updateDropTargetIndicator):
//   - Containers with a specialized (non-"children") child field always
//     accept drops "into" that field.
//   - Containers with a "children" field: pointer near the top/bottom edge
//     (25% of the height, capped at 50px) reorders siblings (above/below),
//     the middle nests ("into").
//   - Leaf widgets: top half = "above", bottom half = "below".

export type DropPosition = "above" | "below" | "into";

export interface DropTargetRect {
  top: number;
  height: number;
}

export interface DropPositionInput {
  /** Pointer Y in the same coordinate space as `rect`. */
  pointerY: number;
  /** Rect of the hovered drop target. */
  rect: DropTargetRect;
  /** Whether the target instance is a container (registry hasChildren). */
  isContainer: boolean;
  /** Container child field the target represents; defaults to "children". */
  fieldName?: string | null;
  /**
   * Short-circuit to "into" regardless of geometry. Used by drop targets that
   * always nest (e.g. a canvas-root proxy droppable that appends to the page).
   */
  forceInto?: boolean;
}

export function computeDropPosition({
  pointerY,
  rect,
  isContainer,
  fieldName,
  forceInto,
}: DropPositionInput): DropPosition {
  if (forceInto) {
    return "into";
  }

  const field = fieldName || "children";

  if (isContainer && field !== "children") {
    return "into";
  }

  if (isContainer) {
    const edgeThreshold = Math.min(rect.height * 0.25, 50);
    if (pointerY < rect.top + edgeThreshold) return "above";
    if (pointerY > rect.top + rect.height - edgeThreshold) return "below";
    return "into";
  }

  return pointerY < rect.top + rect.height / 2 ? "above" : "below";
}
