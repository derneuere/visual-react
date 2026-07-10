import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PAGES_DIR, ensureDirectoryExists } from "../../../../utils/pagesUtils";
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

function createJsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function getAllFiles(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const nested = await getAllFiles(fullPath, baseDir);
        if (nested.length === 0) {
          // Empty directory — check for .keep marker
          try {
            await fs.access(path.join(fullPath, ".keep"));
            return relativePath + "/";
          } catch {
            return null;
          }
        }
        return nested;
      } else if (entry.name.endsWith(".json")) {
        return relativePath;
      }
      return null;
    })
  );

  return files.flat().filter(Boolean);
}

export const Route = createFileRoute("/api/pages/list")({
  server: {
    handlers: {
      GET: async () => {
    try {
      const storage = createStorageAdapter();

      if (storage) {
        // GitHub mode: use storage adapter
        const pages = await storage.listPages();
        return createJsonResponse(pages);
      }

      // Local mode: read from filesystem
      try {
        await fs.access(LOCAL_PAGES_DIR);
      } catch {
        await ensureDirectoryExists(LOCAL_PAGES_DIR);
        return createJsonResponse([]);
      }

      const jsonFiles = await getAllFiles(LOCAL_PAGES_DIR);
      return createJsonResponse(jsonFiles);
    } catch (error) {
      console.error("Error listing pages:", error);
      return createJsonResponse({ error: "Failed to list pages." }, 500);
    }
  },
    },
  },
});
