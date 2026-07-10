import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import { LOCAL_ASSETS_DIR } from "../../../utils/pagesUtils";
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

export const Route = createFileRoute("/api/assets")({
  server: {
    handlers: {
      GET: async () => {
    try {
      const storage = createStorageAdapter();

      if (storage) {
        const assets = await storage.listAssets();
        return createJsonResponse(assets);
      }

      // Local mode: read from filesystem
      try {
        await fs.access(LOCAL_ASSETS_DIR);
      } catch {
        return createJsonResponse([]);
      }

      const entries = await fs.readdir(LOCAL_ASSETS_DIR, { withFileTypes: true });
      const assetFiles = entries
        .filter((entry) => entry.isFile())
        .map((entry) => `assets/${entry.name}`);

      return createJsonResponse(assetFiles);
    } catch (error) {
      console.error("Error listing assets:", error);
      return createJsonResponse({ error: "Failed to list assets." }, 500);
    }
      },
    },
  },
});
