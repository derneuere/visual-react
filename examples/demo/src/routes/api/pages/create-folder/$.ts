import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PAGES_DIR, ensureDirectoryExists } from "../../../../../utils/pagesUtils";

export const Route = createFileRoute("/api/pages/create-folder/$")({
  server: {
    handlers: {
      POST: async ({ params }) => {
    const folderPath = params._splat;

    if (!folderPath) {
      return new Response("Folder path not provided", { status: 400 });
    }

    try {
      const localDirPath = path.join(LOCAL_PAGES_DIR, folderPath);
      await ensureDirectoryExists(localDirPath);

      // Create a .keep marker so the folder persists when empty
      const keepPath = path.join(localDirPath, ".keep");
      try {
        await fs.access(keepPath);
      } catch {
        await fs.writeFile(keepPath, "", "utf-8");
      }

      return new Response("Folder created successfully", { status: 200 });
    } catch (error) {
      console.error("Error creating folder:", error);
      return new Response("Error creating folder", { status: 500 });
    }
      },
    },
  },
});
