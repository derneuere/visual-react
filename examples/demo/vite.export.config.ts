import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Array form: the more specific "/editor" alias must be matched before
    // the bare package name (string aliases also match subpaths as a prefix).
    alias: [
      // Stub out the router so Header's Link renders as plain <a>
      {
        find: "@tanstack/react-router",
        replacement: resolve(__dirname, "scripts/router-stub.tsx"),
      },
      // Resolve the package entries to source for SSR compatibility
      {
        find: "@derneuere/visual-react/editor",
        replacement: resolve(__dirname, "../../src/editor.ts"),
      },
      {
        find: "@derneuere/visual-react",
        replacement: resolve(__dirname, "../../src/index.ts"),
      },
    ],
  },
  base: "./",
  build: {
    // Client bundle config (default)
    outDir: "dist-export/client",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "scripts/export-client.tsx"),
      output: {
        entryFileNames: "app.js",
        assetFileNames: "[name][extname]",
      },
    },
  },
});
