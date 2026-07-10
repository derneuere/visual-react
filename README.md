# @derneuere/visual-react

[![npm](https://img.shields.io/npm/v/%40derneuere%2Fvisual-react)](https://www.npmjs.com/package/@derneuere/visual-react)

A React-based visual CMS engine. You register your own React components in a
registry, and visual-react turns them into editable pages: content is a
serializable **Instance tree** (component name + props + nested children),
edited through an **iframe canvas** (true-WYSIWYG: your app renders the page
inside an iframe while the surrounding editor stays in full control) — either
with the bundled Mantine editor or with your own chrome built on the headless
hooks. Pages load and save through pluggable **storage adapters** (REST,
GitHub, or your own).

**Building blocks**

- **Instance tree** — pages are plain JSON: `{ instanceId, component, props }`
  with children nested in props. Pure tree utils (`moveInstance`,
  `computeDropPosition`, page tree helpers) are exported and unit-tested.
- **Component registry** — register any React component with metadata and
  editable props; the engine never imports your components itself.
- **Editor state** — `EditorProvider` / `useEditor` (selection, editing mode,
  keyboard shortcuts), headless and UI-free.
- **Storage adapters** — `FetchStorageAdapter` (REST), `GitHubStorageAdapter`
  (commits pages to a repo), content migration helpers, or bring your own.
- **Bundled editor** — `/editor`: canvas-only Mantine editor (since 0.4.0) —
  palette + layer tree, component picker, property panel, undo/redo, dnd-kit
  drags onto the iframe canvas, and Edit | Desktop | Mobile device previews
  on one never-remounting iframe. Pass your canvas route as `canvasSrc`;
  chrome strings are localizable via the `labels` prop.
- **Iframe canvas** — `/canvas`: typed same-origin bridge, overlay-drawn
  selection/hover/drop indicators, device presets with scale-to-fit, and
  optional dnd-kit glue (`/canvas/dnd`). See [docs/canvas.md](docs/canvas.md).
- **Headless editor hooks** — build your own editor UI: `useEditorDnd`
  (`/editor/dnd`) for the full drag-and-drop orchestration,
  `useInstanceFields` for a typed property panel, `useInstancePath`
  (breadcrumbs), `useEditorHistory` (undo/redo), and the
  `createPageRoot`/`unwrapPageRoot` page wrapper. See
  [docs/headless-editor.md](docs/headless-editor.md).

## Repository layout

- `/` (repo root) — the `@derneuere/visual-react` npm package (source in `src/`, library build via Vite)
- `examples/demo` — a full TanStack Start example app: the canvas-only editor (`/editor` with its `/canvas-frame` iframe route), file-based page storage, static export scripts, and the Playwright e2e suite
- `examples/backend` — an optional Python example backend (server-side page storage API)

## Installation

```bash
npm install @derneuere/visual-react
```

`react` and `react-dom` v19 are the only required peers. The editor entry
needs additional optional peers (see the matrix below).

## Entry points

The package is split so the headless core stays dependency-free:

| Import | Contents | Extra dependencies needed |
| --- | --- | --- |
| `@derneuere/visual-react` | Headless core: component registry, editor state (`EditorProvider`, `useEditor`, keyboard shortcuts), undo/redo (`useEditorHistory`), headless property panel (`useInstanceFields`), breadcrumbs (`useInstancePath`), page-root wrapper (`createPageRoot`/`unwrapPageRoot`), storage adapters + migration, auth, static mode, templates, tree/page utils (`moveInstance`, `computeDropPosition`, …), `ComponentLoader`, `ContentTag`, `WrapInstanceProvider` | none — only `react`/`react-dom` |
| `@derneuere/visual-react/editor` | The bundled canvas-only editor: `Editor` (requires `canvasSrc`), chrome building blocks (sidebars, layer tree, palette, picker modal, property panel), the static render pieces `ComponentRenderer` / `Block`, `Draggable`, `RichTextEditor` | the optional peers below |
| `@derneuere/visual-react/editor/dnd` | Headless dnd orchestration for custom editors (`useEditorDnd`, `usePaletteDraggable`, `useTreeDroppable`) — see [docs/headless-editor.md](docs/headless-editor.md) | `@dnd-kit/core`, `@dnd-kit/sortable` |
| `@derneuere/visual-react/editor.css` | Stylesheet for the editor entry (import it once alongside `/editor`) | — |
| `@derneuere/visual-react/canvas` | Iframe canvas: `CanvasBridge` (iframe side), `CanvasHost` (parent side), the typed bridge protocol, `CANVAS_DEVICE_PRESETS` — see [docs/canvas.md](docs/canvas.md) | none — only `react`/`react-dom` |
| `@derneuere/visual-react/canvas/dnd` | dnd-kit glue for the canvas (`useCanvasDnd`): palette drags onto the iframe via virtual droppables | `@dnd-kit/core` |

### Peer dependency matrix

| Peer | Required? | Needed by |
| --- | --- | --- |
| `react`, `react-dom` (v19) | **required** | everything |
| `@mantine/core`, `@mantine/hooks`, `@mantine/tiptap` | optional | `/editor` |
| `@tabler/icons-react` | optional | `/editor` |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/pm` | optional | `/editor` (rich text) |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | optional | `/editor`; `@dnd-kit/core` + `@dnd-kit/sortable` for `/editor/dnd`; `@dnd-kit/core` for `/canvas/dnd` |
| `@tanstack/react-query` | optional | `/editor` |
| `react-error-boundary` | optional | `/editor` |

The editor entry also imports `@mantine/core/styles.css` itself, so `/editor`
is bundler-only (Vite, webpack, …).

## Quickstart

### Headless core (`.`)

Rendering and state without any editor UI — e.g. for the public, read-only
side of your site:

```tsx
import {
  ComponentRegistryProvider,
  EditorProvider,
  StorageAdapterProvider,
  FetchStorageAdapter,
  useComponentRegistry,
} from "@derneuere/visual-react";

function App({ children }) {
  return (
    <ComponentRegistryProvider>
      <EditorProvider>
        <StorageAdapterProvider adapter={new FetchStorageAdapter()}>
          {children}
        </StorageAdapterProvider>
      </EditorProvider>
    </ComponentRegistryProvider>
  );
}
```

### Bundled editor (`./editor`)

The editor is canvas-only (since 0.4.0): it edits the page through an iframe
canvas. Create a bare canvas route in your app and pass its URL:

```tsx
// /canvas-frame — the canvas route, rendered inside the iframe
import { useComponentRegistry, StaticModeProvider } from "@derneuere/visual-react";
import { CanvasBridge } from "@derneuere/visual-react/canvas";
import { ComponentRenderer } from "@derneuere/visual-react/editor";

function CanvasFrame() {
  const { hasChildren, getComponentProps } = useComponentRegistry();
  return (
    <CanvasBridge
      isContainer={hasChildren}
      getInstanceLabel={(i) => getComponentProps(i.id)?.name ?? i.id}
      renderPage={({ content }) => (
        <StaticModeProvider>
          <main>
            <ComponentRenderer items={content} />
          </main>
        </StaticModeProvider>
      )}
    />
  );
}

// editor route — inside the provider stack above:
import { Editor } from "@derneuere/visual-react/editor";
import "@derneuere/visual-react/editor.css";

<Editor canvasSrc="/canvas-frame" />
// localize the chrome: <Editor canvasSrc="…" labels={{ publish: "Veröffentlichen" }} />
```

### Iframe canvas (`./canvas`)

The canvas splits editing across two routes of *your* app: a bare iframe
route that renders the page with `CanvasBridge`, and the editor route that
embeds it with `CanvasHost`:

```tsx
// /canvas-frame — rendered inside the iframe
import { CanvasBridge } from "@derneuere/visual-react/canvas";

<CanvasBridge
  renderPage={({ content }) => <PageRenderer content={content} />}
  isContainer={(instance) => hasChildSlots(instance)}
/>

// editor route — the parent
import { CanvasHost, CANVAS_DEVICE_PRESETS } from "@derneuere/visual-react/canvas";

<CanvasHost
  src="/canvas-frame"
  content={tree}
  selectedInstanceId={selectedId}
  editing
  onSelectInstance={setSelectedId}
/>
```

Full walkthrough (including drag-and-drop from a palette via
`/canvas/dnd`): [docs/canvas.md](docs/canvas.md). Working example:
`examples/demo` routes `/editor` and `/canvas-frame`.

## Examples

- [`examples/demo`](examples/demo) — complete TanStack Start integration:
  component registration via `ComponentLoader`, file-based page storage API
  routes, the canvas-only editor, static export, Playwright e2e tests.
- [`examples/backend`](examples/backend) — Python (nanodjango) backend
  showing server-side page storage + auth behind `FetchStorageAdapter`.

## Development

```bash
npm install        # runs "prepare" = full library build (vite + tsc types)
npm test           # vitest unit tests
npm run build      # ESM bundles per entry (dist/)
npm run build:types
```

Node 22+ recommended. The Playwright e2e suite lives in `examples/demo`:

```bash
cd examples/demo && npm install && npx playwright test
```

Because the demo consumes the package via `file:../..`, its Vite config
dedupes `react`/`@mantine/*`/`@dnd-kit/*` across the link boundary — keep
that pattern if you consume the package as a `file:` or git dependency.

## Releases

Current version: **0.4.0**.

To cut a release:

1. Bump `version` in `package.json` and update `CHANGELOG.md`.
2. Either publish locally:
   ```bash
   npm run build && npm run build:types
   npm publish --access public
   ```
3. Or via CI: set the `NPM_TOKEN` repository secret once, then push a `v*`
   tag (e.g. `v0.2.1`) — `.github/workflows/release.yml` builds and publishes
   automatically.

## License

MIT © 2026 derneuere
