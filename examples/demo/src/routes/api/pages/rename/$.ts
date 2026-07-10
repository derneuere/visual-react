import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PAGES_DIR, ensureDirectoryExists } from "../../../../../utils/pagesUtils";

export const Route = createFileRoute("/api/pages/rename/$")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
    const filePath = params._splat + ".json";
    const body = await request.json();
    const { newFilePath: originalNewFilePath } = body;

    if (!originalNewFilePath) {
      return new Response("New file path not provided", { status: 400 });
    }

    const newFilePath = originalNewFilePath + ".json";

    try {
      const localFilePath = path.join(LOCAL_PAGES_DIR, filePath);
      const localNewFilePath = path.join(LOCAL_PAGES_DIR, newFilePath);

      try {
        await fs.access(localFilePath);
      } catch {
        return new Response("Source file not found", { status: 404 });
      }

      const newDirPath = path.dirname(localNewFilePath);
      await ensureDirectoryExists(newDirPath);

      const content = await fs.readFile(localFilePath, "utf-8");
      await fs.writeFile(localNewFilePath, content, "utf-8");
      await fs.unlink(localFilePath);

      return new Response("File renamed successfully", { status: 200 });
    } catch (error) {
      console.error("Error renaming page:", error);
      return new Response("Error renaming page", { status: 500 });
    }
      },
    },
  },
});
