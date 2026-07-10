# Building a custom editor (headless hooks)

The bundled Mantine editor (`@derneuere/visual-react/editor`) is one UI on
top of a headless controller layer. Since 0.3.0 that layer is public, so you
can build an editor in your own design system (shadcn, plain CSS, …) without
re-implementing drag-and-drop orchestration, property-panel plumbing, or
undo/redo.

## Entry points

| Import | Needs | Contents |
| --- | --- | --- |
| `@derneuere/visual-react` | react only | `useInstanceFields`, `useInstancePath`, `useEditorHistory`, `createPageRoot`/`unwrapPageRoot`, providers, tree utils |
| `@derneuere/visual-react/editor/dnd` | `@dnd-kit/core`, `@dnd-kit/sortable` | `useEditorDnd`, `usePaletteDraggable`, `useTreeDroppable` |
| `@derneuere/visual-react/canvas` | react only | iframe canvas (`CanvasHost`, `CanvasBridge`, device presets) |
| `@derneuere/visual-react/canvas/dnd` | `@dnd-kit/core` | `useCanvasDnd` (virtual droppables over the iframe) |

`@dnd-kit/*` are **optional** peer dependencies. That is why the dnd hooks
live in the dedicated `./editor/dnd` entry (same rule and same pattern as
`./canvas/dnd`): importing the core entry never loads dnd-kit.

## The pieces

### `useEditorDnd(options?)`

Owns every drag semantic the editors share and returns what your own
`DndContext` needs:

```tsx
const dnd = useEditorDnd();

<DndContext
  sensors={dnd.sensors}
  collisionDetection={dnd.collisionDetection}
  {...dnd.handlers}
>
  …
</DndContext>
```

It handles:

- **palette vs. move** — drags whose data says `{ source: "palette" }` (or
  the legacy `{ add: true }`) ADD a fresh instance
  (`crypto.randomUUID()` + the registry's `defaultProps`), everything else
  MOVES the existing instance via the shared `moveInstance` util,
- **drop indicator** — pointer-Y math (`computeDropPosition`) written to
  `useEditor().dropTarget` (`{ id, fieldName, position }`), honoring a
  droppable's `forceInto` flag (e.g. an iframe root proxy that always
  appends),
- **three-tier collision detection** — real droppables win via
  `pointerWithin`; over an iframe canvas the virtual proxies
  (`data.canvas === true`, from `useCanvasDnd`) are hit-tested
  innermost-first by rect area; otherwise `rectIntersection` while adding /
  `closestCorners` while moving,
- **the nesting guard** — a drop lands INSIDE a container only when the
  indicator says `"into"` or the drop zone represents a specialized
  (non-`"children"`) child field; container edges reorder as siblings,
- **bridge-id resolution** — canvas proxies that only carry a
  `bridgeInstanceId` are resolved to real ids with
  `findInstanceByBridgeId`.

Options: `{ canvasController?, isPaletteDrag?, onInstanceAdded?, onInstanceMoved? }`.

### `usePaletteDraggable(widgetKey)` / `useTreeDroppable(instanceId, fieldName?)`

Thin dnd-kit wrappers that guarantee the data contracts the handlers rely
on: palette sources carry `{ source: "palette", widgetKey }`, drop targets
carry `{ instanceId, fieldName }`. `useTreeDroppable` additionally returns
`isActiveTarget` / `position` resolved against the shared drop indicator, so
a tree row can draw its own insertion line. Canvas proxies get the same
target shape via `useCanvasDnd`'s `getDroppableData`, so one set of handlers
serves sidebar rows and the iframe canvas alike.

### `useInstanceFields(instance)`

The headless property panel: returns ordered, typed field descriptors —
`{ key, fieldType, label, description, warning, options, min/max/step,
toolbar, group, structural, visible, error, validation, value, setValue }` —
for every entry in the component's `editableProps`. `fieldType` is the
normalized discriminant (`"enum"`, `"color"`, `"slider"`, …), so your panel
reduces to a `fieldType -> input component` map. `visible` has
`conditionalProperties` already resolved, `error`/`validation` come from the
component's `validate`, `structural: true` marks `componentlist` fields
(managed by the tree/canvas — skip them), and `setValue` writes through
`updateInstanceProps` (undo-aware, coalesces while typing).

### `useInstancePath(instanceId)`

Root-first ancestry of an instance (ending with the instance itself) — feed
it straight into a breadcrumb.

### `useEditorHistory()`

`{ undo, redo, canUndo, canRedo, clear }`. History is recorded inside
`ComponentRegistryProvider` around every tree mutation, bounded (default
100, `historyLimit` prop), coalesces rapid `updateInstanceProps` calls to
the same instance+fields (~500 ms — typing is one step), and resets on page
switches. `useEditorKeyboardShortcuts` binds Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z
and Ctrl/Cmd+Y.

### `createPageRoot(content)` / `unwrapPageRoot(tree)`

Canvas-style editors want the whole page to behave like one container. The
tree utils, however, special-case the top level: `addItemToParent` reserves
the literal parent id `"root"` (`ROOT_PARENT_ID`) for "append as a top-level
node", and `addItemRelativeToNode` is a no-op for targets without a parent.
`createPageRoot` sidesteps all of that by wrapping the flat content in one
transient root instance (component id `__root__`, instance id
`__page_root__` — deliberately **not** `"root"`), so every content node has
a parent and "append to the page" is a plain
`addItemToParent(tree, PAGE_ROOT_INSTANCE_ID, …)`. Register
`pageRootMetadata` under `PAGE_ROOT_COMPONENT_ID` in your (metadata-only)
editor registry so `hasChildren`/`getChildren` treat the wrapper as a
container, and `unwrapPageRoot` the tree before persisting.

## A complete minimal editor

```tsx
import { useState } from "react";
import { DndContext } from "@dnd-kit/core";
import {
  ComponentRegistryProvider,
  EditorProvider,
  useComponentRegistry,
  useEditor,
  useEditorHistory,
  useEditorKeyboardShortcuts,
  useInstanceFields,
  useInstancePath,
  createPageRoot,
  unwrapPageRoot,
  pageRootMetadata,
  PAGE_ROOT_COMPONENT_ID,
  type ComponentRegistry,
  type Instance,
} from "@derneuere/visual-react";
import {
  useEditorDnd,
  usePaletteDraggable,
  useTreeDroppable,
} from "@derneuere/visual-react/editor/dnd";

// Metadata-only registry: this editor renders no widgets itself (a canvas
// iframe or preview column does), so entries need no Component.
const registry: ComponentRegistry = {
  [PAGE_ROOT_COMPONENT_ID]: { metadata: pageRootMetadata },
  text: {
    metadata: {
      name: "Text",
      defaultProps: { body: "Lorem ipsum" },
      editableProps: { body: "string" },
    },
  },
  section: {
    metadata: {
      name: "Section",
      defaultProps: { children: [] },
      editableProps: { children: { type: "componentlist" } },
    },
  },
};

function PaletteItem({ widgetKey, name }: { widgetKey: string; name: string }) {
  const { setNodeRef, listeners, attributes } = usePaletteDraggable(widgetKey);
  return (
    <button ref={setNodeRef} {...listeners} {...attributes}>
      {name}
    </button>
  );
}

function TreeRow({ instance, depth }: { instance: Instance; depth: number }) {
  const { setSelectedInstanceId } = useEditor();
  const { getComponentProps, hasChildren, getChildren } =
    useComponentRegistry();
  const { setNodeRef, position } = useTreeDroppable(instance.props.instanceId);
  const children = hasChildren(instance)
    ? (instance.props[getChildren(instance)![0]] as Instance[] | undefined)
    : undefined;
  return (
    <div ref={setNodeRef} style={{ paddingLeft: depth * 12 }}>
      <div
        onClick={() => setSelectedInstanceId(instance.props.instanceId)}
        style={{
          borderTop: position === "above" ? "2px solid blue" : undefined,
          borderBottom: position === "below" ? "2px solid blue" : undefined,
          outline: position === "into" ? "1px solid blue" : undefined,
        }}
      >
        {getComponentProps(instance.id)?.name ?? instance.id}
      </div>
      {children?.map((child) => (
        <TreeRow
          key={child.props.instanceId}
          instance={child}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function PropertyPanel() {
  const { findInstance } = useComponentRegistry();
  const { selectedInstanceId } = useEditor();
  const instance = findInstance(selectedInstanceId);
  const fields = useInstanceFields(instance);
  const path = useInstancePath(selectedInstanceId);
  return (
    <div>
      <nav>{path.map((n) => n.id).join(" › ")}</nav>
      {fields
        .filter((f) => f.visible && !f.structural)
        .map((f) => (
          <label key={f.key}>
            {f.label}
            {/* map f.fieldType -> your input components; string shown here */}
            <input
              value={String(f.value ?? "")}
              onChange={(e) => f.setValue(e.target.value)}
            />
            {f.error && <span role="alert">{f.error}</span>}
          </label>
        ))}
    </div>
  );
}

function EditorSurface({ onSave }: { onSave: (content: Instance[]) => void }) {
  const dnd = useEditorDnd();
  const { currentPage } = useComponentRegistry();
  const { undo, redo, canUndo, canRedo } = useEditorHistory();
  useEditorKeyboardShortcuts(); // Delete, copy/paste, Ctrl+Z / Ctrl+Shift+Z

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      {...dnd.handlers}
    >
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
      {/* persist the FLAT content — the transient root stays editor-internal */}
      <button onClick={() => onSave(unwrapPageRoot(currentPage))}>Save</button>
      <PaletteItem widgetKey="text" name="Text" />
      <PaletteItem widgetKey="section" name="Section" />
      {currentPage.map((node) => (
        <TreeRow key={node.props.instanceId} instance={node} depth={0} />
      ))}
      <PropertyPanel />
    </DndContext>
  );
}

export function MyEditor({
  content,
  onSave,
}: {
  content: Instance[];
  onSave: (content: Instance[]) => void;
}) {
  // Wrap the flat page content in the transient root; unwrap on save.
  const [initialPage] = useState(() => createPageRoot(content));
  return (
    <ComponentRegistryProvider
      initialRegistry={registry}
      initialPage={initialPage}
    >
      <EditorProvider>
        <EditorSurface onSave={onSave} />
      </EditorProvider>
    </ComponentRegistryProvider>
  );
}
```

## Adding an iframe canvas

Combine the above with `CanvasHost` + `useCanvasDnd` (see
[canvas.md](./canvas.md)). Give the canvas proxies the same
`{ instanceId, fieldName }` target data via `getDroppableData`, hand the
root proxy `{ forceInto }` semantics via `rootDroppableData`, and
`useEditorDnd`'s handlers will treat canvas drops exactly like tree-row
drops. The julis Bezirksseiten editor is the reference implementation of
this setup.
