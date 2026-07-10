import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Array form: the more specific "/editor" alias must be matched before
    // the bare package name (string aliases also match subpaths as a prefix).
    alias: [
      {
        find: "@tanstack/react-router",
        replacement: resolve(__dirname, "scripts/router-stub.tsx"),
      },
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
    ssr: resolve(__dirname, "scripts/export-ssr.tsx"),
    outDir: "dist-export/ssr",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "export-ssr.js",
        assetFileNames: "[name][extname]",
        format: "es",
      },
    },
  },
});
