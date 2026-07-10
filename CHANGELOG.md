# Changelog

All notable changes to `@derneuere/visual-react` are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 0.2.2

### Added

- **Shared tree-move helpers** in the tree utils (core entry):
  `moveInstanceUp` / `moveInstanceDown` (reorder within the sibling list —
  the parent's child field, or the tree's top level for root-level nodes),
  `moveInstanceOut` (reparent to the grandparent, positioned right after the
  former parent) and `moveInstanceInto` (append into the previous sibling
  container's first child field). All are pure, unit-tested, never mutate
  the input tree and return `null` for no-ops (edges, root-level `out`,
  non-container previous sibling). The bundled `ComponentTree` now delegates
  to them, deleting its private reimplementations — tree surgery exists
  exactly once in the package.
- **`{ type: "color" }` fields render in the editor.** The declared
  FieldType finally has an `EditingTab` branch: a Mantine `Select` whose
  options (and current value) show the color as a swatch next to its label.
  Previously such fields silently rendered nothing.
- **Configurable export endpoint.** `TopBar` (and `Editor`, which forwards)
  accepts `exportUrl?: string` (default `"/api/export"`) and
  `onExport?: () => Promise<void>` as a full override of the built-in
  fetch-and-download. Additive — existing consumers are unchanged.

### Fixed

- **Palette drops into empty containers are no longer spuriously aborted.**
  The palette-add path had a leftover guard that resolved a child field and
  bailed when none was found — but the result was never used
  (`addItemToParent` derives the field itself), so drops into containers
  without a resolvable field were dropped on the floor.
- **New-instance ids use `crypto.randomUUID()`** (palette drops,
  ComponentExplorer inserts, `addChild`) instead of `Date.now()`, which
  collides when two instances are created within the same millisecond —
  duplicated ids broke selection and tree surgery for one of the twins.
- **Keyboard shortcuts are inert during preview.** The editor now passes
  `enabled: !isPreview` to `useEditorKeyboardShortcuts`, so Delete/Backspace
  (and copy/duplicate/paste) can no longer silently mutate the page while
  previewing.
- Removed leftover `console.log` debugging from `EditingTab`.

## 0.2.1

### Added

- `ComponentRegistryEntry.Component` is now optional: editors that render in
  a separate document (iframe canvas) can register metadata-only entries
  (`defaultProps`/`editableProps`); `ComponentRenderer` skips entries
  without a `Component`.
- `FieldValue` and `FieldMetadataEntry` types exported from the core entry.
- `useEditorKeyboardShortcuts` takes an optional `{ enabled }` gate so
  consumers can disable shortcuts in read-only states (device previews).

### Package

- Widened the optional `@dnd-kit/sortable` peer range to `^9 || ^10`.

## 0.2.0

### Package

- Renamed to the scoped package **`@derneuere/visual-react`** (the unscoped
  `visual-react` name on npm belongs to an unrelated project). MIT licensed.
- Split into entry points:
  - `@derneuere/visual-react` — the headless core (registry, editor state,
    storage adapters, auth, static mode, templates, tree/page utils). Only
    needs `react`/`react-dom`.
  - `@derneuere/visual-react/editor` — the visual editing surface (Mantine
    chrome, dnd-kit render pieces, rich text). Requires the optional peer
    dependencies.
  - `@derneuere/visual-react/editor.css` — the editor stylesheet.
  - `@derneuere/visual-react/canvas` — the iframe canvas architecture
    (react-only; see below).
  - `@derneuere/visual-react/canvas/dnd` — dnd-kit glue for the canvas, kept
    separate so `@dnd-kit/core` stays an optional peer.
- ESM-only multi-entry build with shared chunks (UMD build dropped);
  `prepare` script builds `dist/` on git-dependency installs.

### Added

- **Iframe canvas (`/canvas` + `/canvas/dnd` entries)** — a true-WYSIWYG
  editing surface rendered in a same-origin `<iframe>` (real viewport media
  queries, fixed-position fidelity, zero style bleed), upstreamed from a
  downstream fork and fully headless/consumer-parameterized. Additive: the
  in-document editing surface is unchanged. See `docs/canvas.md`.
  - **Protocol** (`protocol.ts`): typed same-origin window-global bridge
    (`CanvasBridgeApi` / `CanvasHostCallbacks`, configurable `globalKey`,
    default `"__visualReactCanvasBridge"`); ids cross as `String(instanceId)`;
    generic JSON `pageData` channel; `isCanvasBridgeApi` / `getCanvasBridge`
    guards and the pure helpers `findInstanceByBridgeId` /
    `clampRectToViewport` (unit-tested).
  - **`CanvasBridge`** (iframe side): consumer supplies
    `renderPage({ content, pageData, wrapInstance })` and an
    `isContainer(instance)` predicate; the bridge owns the hit-target
    `data-instance-id` wrappers (via the `wrapInstance` hook), the overlay
    (selection outline + label chip, hover highlight, drop indicator
    bar/ring, empty-state hint — glued via ResizeObserver/MutationObserver/
    scroll with rAF batching), capture-phase click interception (now also
    blocking middle-click `auxclick` and keyboard Enter-on-link — a known
    gap in the downstream original), click→select, key forwarding,
    input-enabled gating, and the bridge-native move-drag (8 px threshold,
    pointer capture, descendant-excluding target walk, shared
    `computeDropPosition`, auto-scroll, Escape cancel, click suppression,
    `onCanvasDrop`).
  - **`CanvasHost`** (parent side): iframe lifecycle with capped connect
    polling (`connectTimeoutMs`, improvement over the downstream's uncapped
    poll), rAF-batched content pushes, selection/pageData/edit-mode pushes,
    device sizing as props (`device` + `scaleToFit` + `CANVAS_DEVICE_PRESETS`
    — sizes are not hardcoded), and a stable `CanvasHostController`
    (`onController`) exposing `getRectMap` / `setDropIndicator` /
    `subscribeRectsChanged` for integrations.
  - **`useCanvasDnd`** (`/canvas/dnd`): wires a consumer's own `DndContext`
    to the canvas — transparent drag overlay over the iframe, virtual
    droppable proxies from the rect map (clamped to the iframe viewport),
    root "append to page" droppable, indicator mirroring, and an `onDrop`
    callback with the resolved target.
  - The demo app gained an end-to-end example at `/canvas-editor` (canvas
    route at `/canvas-frame`) plus a Playwright spec covering select
    round-trip, palette drops and the bridge-native move-drag; the classic
    `/editor` route is untouched.
- **`moveInstance(tree, activeInstanceId, targetInstanceId, position, hasChildren, getChildren, fieldName?)`**
  in the tree utils: the editor's complete drag-move semantics as a pure,
  unit-tested function (self/descendant/no-op guards, sibling reorders that
  honor the drop indicator, `"into"` nesting, node-count sanity check;
  returns `null` for invalid moves). The editor's `handleDragEnd` now uses it.
- **`computeDropPosition({ pointerY, rect, isContainer, fieldName?, forceInto? })`**
  (`DropPosition`, `DropTargetRect`, `DropPositionInput` types): the pure
  above/below/into drop-position math previously inlined in the editor
  (25 %-of-height edge threshold capped at 50 px on containers, halves on
  leaves, specialized child fields always `"into"`). The editor's drop
  indicator now uses it; custom drag surfaces (e.g. an iframe canvas host)
  can share the exact same semantics.
- **`wrapInstance`** render hook: `ComponentRenderer` accepts an optional
  `wrapInstance?: (instance, rendered) => ReactNode` prop, and the core entry
  exports `WrapInstanceProvider` / `useWrapInstance` so a wrapper propagates
  through nested containers. Lets an editor canvas tag rendered instances
  (e.g. `data-instance-id` hit-targets) with zero cost and byte-identical
  output when unused.
- **`ROOT_PARENT_ID`** constant documenting `addItemToParent`'s root
  addressing contract: passing `"root"` as `parentId` appends as a top-level
  node. The sentinel is matched before any node lookup, so instance ids must
  never be the literal string `"root"`.

### Fixed

- **Same-parent drags now honor the drop indicator.** Previously, moving a
  node within its own container fell into an `arrayMove` code path that
  ignored the above/below indicator (and could never reach the last slot —
  the old inline To-Do bug). Moves now splice into the post-removal sibling
  list exactly where the indicator pointed, in both drag directions.
- **`"into"` a non-empty container now APPENDS.** Previously the inserted
  node was spliced at index `-1` (the target container isn't among its own
  children), landing before the last child instead of at the end.

### Internal

- The editor (`editor.tsx`) delegates its inline drop-indicator math and
  drag-end tree surgery to the shared `computeDropPosition` / `moveInstance`
  utilities (behavior-preserving apart from the two fixes above); the noisy
  drag-end `console.log` debugging went away with it.
- Note on render architecture: container components receive their child
  instances as props and render them via `Block` → `ComponentRenderer`; the
  registry never imports component modules (registration happens at
  runtime), so there is no module-level import cycle on the render path.

## 0.1.0

- Initial in-repo version (unpublished): registry-driven visual page editor
  with Mantine UI, dnd-kit drag & drop, tiptap rich text, GitHub/fetch
  storage adapters, page templates, and static render mode.
