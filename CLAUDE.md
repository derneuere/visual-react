# Visual React - Development Guidelines

## Repository Layout
- `/` (repo root) - the `@derneuere/visual-react` npm package (library source in `/src`)
- `/examples/demo` - TanStack Start example app + Playwright e2e suite (consumes the package via `file:../..`)
- `/examples/backend` - optional Python example backend

## Package Entry Points
- `.` (src/index.ts) - headless core, must stay importable with only react/react-dom
- `./editor` (src/editor.ts) - Mantine editor chrome + dnd-kit render pieces (optional peers)
- `./editor.css` (dist/editor.css) - extracted stylesheet for the editor entry
- `./canvas` (src/canvas.ts -> src/canvas/) - iframe canvas: bridge protocol, CanvasBridge (iframe side), CanvasHost (parent side); react-only, must stay importable with only react/react-dom (docs/canvas.md)
- `./canvas/dnd` (src/canvas-dnd.ts -> src/canvas/dnd.tsx) - dnd-kit glue for the canvas (useCanvasDnd); the ONLY canvas module allowed to import @dnd-kit/*
- Never export anything importing @mantine/*, @tabler/*, @tiptap/*, @dnd-kit/* or react-error-boundary from `.` or `./canvas`

## Build Commands
- Package (repo root): `npm run build` (library), `npm test` (vitest), `npm run build:types`
- Demo (`examples/demo`): `npm run dev` (dev server, port 3000), `npm run build`, `npm start`, `npm test` (Playwright)

## Code Style
- **Components**: Use function declarations. PascalCase for component names.
- **Hooks**: Use `use` prefix with camelCase. Put custom hooks in hooks.ts files.
- **Types**: Use TypeScript interfaces for props. Required for all components.
- **Imports**: React first, then third-party, then local. Group by category.
- **Naming**: PascalCase for components/types, camelCase for functions/variables.
- **Context Pattern**: Separate files for Context.ts, Provider.tsx, hooks.ts.

## Project Structure (package)
- `/src/components` - Reusable UI components (Block, ComponentLoader, ComponentRenderer, ...)
- `/src/canvas` - iframe canvas (protocol, CanvasBridge, CanvasHost, dnd glue; canvasUtils vitest-covered)
- `/src/editor` - Visual editor implementation
- `/src/registry` - Component registration system
- `/src/storage` - Storage adapters (fetch, GitHub)
- `/src/utils` - Tree/page utilities (vitest-covered)

## TypeScript Configuration
- Strict mode enabled
- No unused locals or parameters
- React JSX transform
