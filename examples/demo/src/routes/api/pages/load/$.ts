import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PAGES_DIR } from "../../../../../utils/pagesUtils";
import {
  GitHubStorageAdapter,
  type StorageAdapter,
} from "@derneuere/visual-react";

function createStorageAdapter(): StorageAdapter | null {
  if (import.meta.env.VITE_STORAGE_MODE === "github") {
    return new GitHubStorageAdapter({
      token: import.meta.env.VITE_GITHUB_TOKEN,
      owner: import.meta.env.VITE_GITHUB_OWNER || "derneuere",
      repo: import.meta.env.VITE_GITHUB_REPO || "visual-react-content",
    });
  }
  return null;
}

export const Route = createFileRoute("/api/pages/load/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
    const pagePath = params._splat;

    try {
      const storage = createStorageAdapter();

      if (storage) {
        // GitHub mode: use storage adapter
        const data = await storage.loadPage(pagePath);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Local mode: read from filesystem
      const localFilePath = path.join(LOCAL_PAGES_DIR, pagePath + ".json");

      try {
        await fs.access(localFilePath);
      } catch {
        return new Response("Page not found", { status: 404 });
      }

      const content = await fs.readFile(localFilePath, "utf-8");
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error loading page:", error);
      return new Response("Error loading page", { status: 500 });
    }
      },
    },
  },
});
