/**
 * "@derneuere/visual-react/canvas" — the iframe canvas architecture.
 *
 * True-WYSIWYG editing surface: the page renders inside a same-origin
 * <iframe> (own viewport → media queries, fixed positioning and zero style
 * bleed behave exactly like the published page) while the editor in the
 * parent window stays the single source of truth and pushes state through a
 * typed window-global bridge.
 *
 * React-only — this entry needs no optional peer dependency. The dnd-kit
 * glue (dragging new widgets from a parent palette onto the canvas) lives in
 * "@derneuere/visual-react/canvas/dnd" so @dnd-kit/core stays optional.
 *
 * See docs/canvas.md for the architecture and a complete consumer example.
 */

// Protocol — types, window-global key, guards
export {
  DEFAULT_CANVAS_BRIDGE_GLOBAL,
  isCanvasBridgeApi,
  getCanvasBridge,
  type CanvasRect,
  type CanvasRectMap,
  type CanvasDropPosition,
  type CanvasDropIndicator,
  type CanvasDropEvent,
  type CanvasHostCallbacks,
  type CanvasBridgeApi,
} from "./canvas/protocol";

// Pure helpers (bridge-id resolution, rect clamping)
export {
  findInstanceByBridgeId,
  clampRectToViewport,
  isInstanceLike,
  isInstanceArray,
} from "./canvas/canvasUtils";

// Iframe side — mount in your canvas route
export {
  CanvasBridge,
  type CanvasBridgeProps,
  type CanvasBridgeRenderArgs,
} from "./canvas/CanvasBridge";

// Parent side — the iframe host wired to your editor state
export {
  CanvasHost,
  CANVAS_DEVICE_PRESETS,
  type CanvasHostProps,
  type CanvasHostController,
  type CanvasDeviceSize,
} from "./canvas/CanvasHost";
