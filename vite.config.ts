/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

export default defineConfig({
  // NOTE: no `define` block on purpose. The library source reads no
  // import.meta.env variables, so nothing from the build machine's
  // environment can ever be baked into dist (see src/utils/pagesUtils.ts).
  plugins: [react(), externalizeDeps()],
  test: {
    // Only the package's own unit tests; the Playwright e2e suite lives in examples/demo
    include: ['src/**/*.test.{ts,tsx}'],
  },
  build: {
    lib: {
      // Multi-entry ESM build. Shared modules (React contexts!) are split
      // into common chunks so "." and "./editor" share the same context
      // instances at runtime.
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        editor: resolve(__dirname, 'src/editor.ts'),
        canvas: resolve(__dirname, 'src/canvas.ts'),
        'canvas-dnd': resolve(__dirname, 'src/canvas-dnd.ts'),
      },
      formats: ['es'],
      // All extracted CSS (editor chrome + SortableItem) lands in dist/editor.css
      cssFileName: 'editor',
    },
  },
});
