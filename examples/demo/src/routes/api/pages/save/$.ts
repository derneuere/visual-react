import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PAGES_DIR, ensureDirectoryExists } from "../../../../../utils/pagesUtils";

export const Route = createFileRoute("/api/pages/save/$")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
    const filePath = params._splat + ".json";
    const body = await request.json();
    const { pageData } = body;

    try {
      const localFilePath = path.join(LOCAL_PAGES_DIR, filePath);

      const dirPath = path.dirname(localFilePath);
      await ensureDirectoryExists(dirPath);

      const formattedContent = JSON.stringify(pageData, null, 2);
      await fs.writeFile(localFilePath, formattedContent, "utf-8");

      return new Response("File saved successfully", { status: 200 });
    } catch (error) {
      console.error("Error saving page:", error);
      return new Response("Error saving page", { status: 500 });
    }
      },
    },
  },
});
