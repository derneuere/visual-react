# The iframe canvas (`@derneuere/visual-react/canvas`)

A true-WYSIWYG editing surface: the page renders inside a same-origin
`<iframe>` while the editor in the parent window stays the single source of
truth. This is **additive** — the classic in-document editing surface
(`Editor` / `SortableItem` from `@derneuere/visual-react/editor`) remains
fully supported; the canvas is an alternative surface for editors that want
the page to look exactly like the published site while editing.

## Why an iframe

- **Viewport media queries.** The iframe is its own viewport, so a 390px
  device preview really evaluates `@media (max-width: …)` at 390px — no
  emulation, no container-query rewrites.
- **Fixed-position fidelity.** `position: fixed` headers, cookie banners and
  scroll effects behave exactly like on the published page, because the page
  scrolls inside its own window instead of inside an editor column.
- **Zero style bleed.** Editor chrome CSS can never leak into the page and
  page CSS can never break the editor.

The cost: state has to cross the frame boundary. The bridge keeps that cheap
— both windows are same-origin, so it is a plain typed object on the iframe's
`window`, not postMessage.

## Architecture

```
┌───────────── parent window (your editor) ─────────────┐
│  Instance tree, selection, all mutations               │
│                                                         │
│  <CanvasHost                                            │
│     src="/your-canvas-route"                            │
│     content={draft} selectedInstanceId={sel} …/>        │
│        │ push: setContent / setPageData / setSelection  │
│        │       setInputEnabled / setDropIndicator       │
│        ▼                                                │
│  ┌──────────── <iframe> (same origin) ───────────────┐  │
│  │  your canvas route:                                │  │
│  │  <CanvasBridge renderPage={…} isContainer={…}/>    │  │
│  │   • renders content via YOUR renderer              │  │
│  │   • data-instance-id wrappers (WrapInstance hook)  │  │
│  │   • overlay: selection / hover / drop indicator    │  │
│  │   • swallows every click/auxclick/Enter-on-link    │  │
│  │   • bridge-native move-drag (8px threshold)        │  │
│  └────────────────────────────────────────────────────┘  │
│        │ report: onSelect / onHover / onKeyDown          │
│        │         onCanvasDrop / onScroll / onRectsChanged│
└──────────────────────────────────────────────────────────┘
```

Data flow rules:

1. **The parent owns everything.** The iframe never loads content itself —
   the host pushes the *unsaved draft* down (`setContent`, rAF-batched), so
   the canvas always shows what the editor sees.
2. **The iframe is a renderer + interaction reporter.** Clicks map to the
   nearest `data-instance-id` and come back as `onSelect(bridgeId)`;
   Delete/Backspace/Escape are forwarded as `onKeyDown`; a completed
   in-canvas drag comes back as `onCanvasDrop` — the parent performs the tree
   mutation (e.g. `moveInstance`) and pushes the result back down.
3. **Ids cross as strings.** `instanceId` may be a number or a string in
   stored content, so the bridge always sends `String(instanceId)`. Resolve
   back with `findInstanceByBridgeId(content, bridgeId)`.
4. **`pageData` is a generic JSON channel** for whatever page-level data your
   renderer needs (theme, locale, resolved server data, …). The package never
   interprets it.

## The protocol

The iframe publishes a `CanvasBridgeApi` on its own window under a global key
(default `"__visualReactCanvasBridge"`, configurable on both sides via
`globalKey`). The host polls the iframe's `contentWindow` for it after each
`load` event — with a retry cap (`connectTimeoutMs`, default 15s) — and calls
`connect(callbacks)`.

```ts
interface CanvasBridgeApi {
  connect(host: CanvasHostCallbacks): void;
  disconnect(): void;
  setContent(content: Instance[]): void;
  setPageData(data: unknown): void;
  setSelection(bridgeId: string | null): void;
  setHover(bridgeId: string | null): void;
  setDropIndicator(indicator: CanvasDropIndicator | null): void;
  setInputEnabled(enabled: boolean): void; // edit input vs read-only preview
  getRectMap(): CanvasRectMap;             // viewport-relative widget rects
}

interface CanvasHostCallbacks {
  onReady(): void;
  onSelect(bridgeId: string | null): void; // null = page background
  onHover(bridgeId: string | null): void;
  onKeyDown(e: { key: string }): void;     // Delete | Backspace | Escape
  onScroll(): void;
  onRectsChanged(): void;
  onCanvasDrop(drop: CanvasDropEvent): void;
}
```

`setInputEnabled(false)` turns the canvas into a *true preview*: no overlay,
nothing reported — but clicks (including middle-click and keyboard Enter on
links) are still swallowed in **both** modes, so the canvas never navigates.

## Minimal consumer example

### 1. The canvas route (loaded inside the iframe)

A bare route — no editor chrome, ideally no app chrome at all beyond your
providers. Supply `renderPage` (any renderer works as long as the
`wrapInstance` wrappers end up in the DOM; renderers built on the package's
`ComponentRenderer` pick it up automatically via `WrapInstanceProvider`) and
an `isContainer` predicate for drop-position math.

```tsx
// /canvas-frame route
import { useComponentRegistry, StaticModeProvider } from "@derneuere/visual-react";
import { CanvasBridge } from "@derneuere/visual-react/canvas";
import { ComponentRenderer } from "@derneuere/visual-react/editor";

export function CanvasFrame() {
  const { hasChildren, getComponentProps } = useComponentRegistry();
  return (
    <CanvasBridge
      isContainer={hasChildren}
      getInstanceLabel={(i) => getComponentProps(i.id)?.name ?? i.id}
      renderPage={({ content }) => (
        // StaticModeProvider renders SortableItem/Block without dnd —
        // the canvas markup stays identical to the public render.
        <StaticModeProvider>
          <ComponentRenderer items={content} notEditable />
        </StaticModeProvider>
      )}
    />
  );
}
```

### 2. The host (in your editor)

```tsx
import {
  useComponentRegistry, moveInstance, findNode,
} from "@derneuere/visual-react";
import {
  CanvasHost, CANVAS_DEVICE_PRESETS, findInstanceByBridgeId,
} from "@derneuere/visual-react/canvas";

function EditorCanvas({ viewMode }: { viewMode: "edit" | "desktop" | "mobile" }) {
  const { currentPage: tree, setCurrentPage, hasChildren, getChildren, deleteNode } =
    useComponentRegistry();
  const [selected, setSelected] = useState<string | number | null>(null);
  const draft = (tree[0]?.props.children as Instance[]) ?? [];

  return (
    <CanvasHost
      src="/canvas-frame"
      content={draft}
      selectedInstanceId={selected}
      editing={viewMode === "edit"}
      device={viewMode === "edit" ? null : CANVAS_DEVICE_PRESETS[viewMode]}
      onSelect={(bridgeId) => {
        const inst = bridgeId ? findInstanceByBridgeId(tree, bridgeId) : null;
        setSelected(inst?.props.instanceId ?? null);
      }}
      onKeyDown={(key) => {
        if (key === "Escape") setSelected(null);
        else if (selected != null) { deleteNode(selected); setSelected(null); }
      }}
      onCanvasDrop={({ activeInstanceId, targetInstanceId, position }) => {
        const active = findInstanceByBridgeId(tree, activeInstanceId);
        const target = findInstanceByBridgeId(tree, targetInstanceId);
        if (!active || !target) return;
        setCurrentPage((prev) =>
          moveInstance(prev, active.props.instanceId, target.props.instanceId,
            position, hasChildren, getChildren) ?? prev);
      }}
    />
  );
}
```

Device sizing: `device={null}` renders fluid (the iframe fills the host);
a fixed `{ width, height }` renders device-true and — with `scaleToFit`
(default) — scales down to the available column via ResizeObserver. The
wrapper structure is identical in all modes, so the iframe never remounts
and the bridge connection survives mode switches. `CANVAS_DEVICE_PRESETS`
ships `desktop` (1280×800) and `mobile` (390×760); pass any size you like.

### 3. dnd-kit palette drops (`@derneuere/visual-react/canvas/dnd`)

Dragging **new** widgets from a parent-side palette onto the canvas needs
dnd-kit. The glue lives in a separate entry so `@dnd-kit/core` stays an
optional peer — importing `./canvas` alone never loads it.

While a drag is active, a transparent overlay covers the iframe (the parent
document keeps receiving pointer events) and hosts one virtual `useDroppable`
proxy per widget, positioned from the bridge's rect map and clamped to the
iframe viewport; a full-size root droppable underneath means "append to the
page". The drop indicator is mirrored into the iframe.

```tsx
import { DndContext } from "@dnd-kit/core";
import { useCanvasDnd } from "@derneuere/visual-react/canvas/dnd";
import type { CanvasHostController } from "@derneuere/visual-react/canvas";

function EditorWithPalette() {
  return (
    <DndContext /* your sensors/collision */>
      <PaletteAndCanvas />   {/* useCanvasDnd needs the DndContext above */}
    </DndContext>
  );
}

function PaletteAndCanvas() {
  const [controller, setController] = useState<CanvasHostController | null>(null);
  const { overlay } = useCanvasDnd({
    controller,
    isContainer: (bridgeId) => { /* resolve + registry hasChildren */ },
    rootDroppableData: { bridgeInstanceId: String(tree[0]?.props.instanceId) },
    onDrop: (event, target) => {
      // target = { bridgeInstanceId, position, data }
      // event.active tells you what was dragged (e.g. a palette item)
    },
  });

  return (
    <>
      {/* palette of <Draggable> items */}
      <CanvasHost … onController={setController} overlay={overlay} />
    </>
  );
}
```

`useCanvasDnd` and the overlay must live **inside** your `DndContext` (they
use `useDndMonitor` / `useDroppable`). Per-proxy droppables carry
`{ canvas: true, bridgeInstanceId }` plus whatever `getDroppableData` adds,
so generic drag-end handlers can also resolve them like any other droppable.

## Bridge-native move-drag (built in, no dnd-kit)

Moving an *existing* widget inside the canvas does not use dnd-kit at all —
the bridge implements it with plain pointer events:

- 8px activation threshold (below it, the gesture stays a click),
- pointer capture (with fallback), dragged widget dims to 40%,
- target resolution via `elementFromPoint` + a `contains()` walk that
  excludes the dragged subtree,
- shared drop-position math (`computeDropPosition` — same thresholds as the
  in-document editor: 25%/50px container edges, leaf halves),
- auto-scroll near the viewport edges on long pages,
- Escape cancels the drag (consumed, does not clear the selection),
- the trailing click after a drag is suppressed,
- result reported as `onCanvasDrop` — the parent mutates and pushes back.

## Migration notes (from in-document editing)

Nothing is removed: `Editor`, `SortableItem`, `Block` keep working unchanged.
To offer a canvas surface next to (or instead of) the in-document one:

1. Add a bare canvas route mounting `CanvasBridge` with your renderer.
2. Replace the in-document page column with `CanvasHost`, feeding it the
   same draft tree and selection you already manage.
3. Keyboard shortcuts: the iframe forwards Delete/Backspace/Escape while it
   has focus — handle them in `onKeyDown` exactly like your existing
   shortcut hook.
4. dnd-kit: keep your `DndContext`, palette and drag handlers; add
   `useCanvasDnd` and branch on `data.canvas === true` (or just use the
   `onDrop` callback) where your drag-end handler resolves droppables.
5. The overlay visuals are drawn by the bridge — remove any in-document
   selection/hover CSS from the canvas path (the page markup inside the
   iframe stays identical to the public render, modulo the
   `data-instance-id` wrappers).

## Testability

Overlay elements carry stable data attributes:
`data-vr-canvas-overlay`, `data-vr-canvas-selection`, `data-vr-canvas-hover`,
`data-vr-canvas-drop` (value = position), `data-vr-canvas-empty`,
`data-vr-canvas-loading`, and the host overlay layer
`data-vr-canvas-host-overlay`. The bridge move-drag listens to plain pointer
events, so synthetic `PointerEvent`s dispatched inside the iframe drive it in
tests (see `examples/demo/tests/canvas-editor.spec.ts`).
