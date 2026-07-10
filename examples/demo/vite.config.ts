import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  plugins: [tanstackStart()],
  build: {
    outDir: ".output",
  },
  resolve: {
    // The visual-react package is consumed via file:../.. and the repo root
    // has its own node_modules (peer deps auto-installed by npm). Without
    // dedupe, its dist bundle would resolve a SECOND copy of react/mantine
    // from the root node_modules during SSR -> "Invalid hook call".
    dedupe: [
      "react",
      "react-dom",
      "@mantine/core",
      "@mantine/hooks",
      "@mantine/form",
      "@mantine/tiptap",
      "@tanstack/react-query",
      // The canvas/dnd entry and the demo's own DndContext must share ONE
      // @dnd-kit instance, or useDndMonitor listens on the wrong context.
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },
  ssr: {
    external: ["archiver"],
    // Bundle the linked package during SSR so dedupe applies to its imports
    noExternal: ["@derneuere/visual-react"],
  },
});
