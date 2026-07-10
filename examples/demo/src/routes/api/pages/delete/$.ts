import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import { LOCAL_PAGES_DIR } from "../../../../../utils/pagesUtils";

export const Route = createFileRoute("/api/pages/delete/$")({
  server: {
    handlers: {
      POST: async ({ params }) => {
    const filePath = params._splat + ".json";

    try {
      const localFilePath = path.join(LOCAL_PAGES_DIR, filePath);

      try {
        await fs.access(localFilePath);
      } catch {
        return new Response("File not found", { status: 404 });
      }

      await fs.unlink(localFilePath);

      return new Response("File deleted successfully", { status: 200 });
    } catch (error) {
      console.error("Error deleting page:", error);
      return new Response("Error deleting page", { status: 500 });
    }
      },
    },
  },
});
