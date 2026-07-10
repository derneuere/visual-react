# @derneuere/visual-react demo

A full example app for the `@derneuere/visual-react` package: a [TanStack Start](https://tanstack.com/start) site with the visual editor, example widgets, file-based page storage (API routes reading/writing `pages/*.json`), static-site export scripts, and the Playwright e2e suite for the package.

The demo consumes the package from the repo root via `"@derneuere/visual-react": "file:../.."`, so build the package first.

Editing (0.4.0, canvas-only):

- `/editor` — the bundled editor (`Editor` from the `/editor` entry). It
  edits the page through an iframe canvas: the bare canvas route lives at
  `/canvas-frame` (mounts `CanvasBridge` and renders pushed content through
  the same static renderer as the public pages) and is passed to the editor
  as `canvasSrc="/canvas-frame"`. Architecture and wiring:
  [`../../docs/canvas.md`](../../docs/canvas.md).

## Run

```bash
# 1. Build the package (repo root)
cd ../..
npm install
npm run build

# 2. Run the demo
cd examples/demo
npm install
npm run dev        # http://localhost:3000
```

## Scripts

- `npm run dev` / `npm run build` / `npm start` — dev server / production build / serve build
- `npm test` — Playwright e2e suite (starts the dev server itself, uses local file storage)
- `npm run export` — static-site export of `pages/*.json` to `export/`
- `npm run backend` — start the optional Python example backend (see `../backend`)
