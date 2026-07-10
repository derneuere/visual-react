import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";

const LOCAL_ASSETS_DIR = path.resolve(process.cwd(), "src");

function getMimeType(filePath) {
  const extension = filePath.split(".").pop().toLowerCase();
  const mimeTypes = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
  };
  return mimeTypes[extension] || "application/octet-stream";
}

export const Route = createFileRoute("/api/assets/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
    const filePath = "assets/" + params._splat;

    // Try local filesystem first
    try {
      const localPath = path.join(LOCAL_ASSETS_DIR, filePath);
      const content = await fs.readFile(localPath);
      const mimeType = getMimeType(filePath);

      return new Response(content, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": content.length.toString(),
        },
      });
    } catch {
      // File not found locally — fall through to GitHub
    }

    // GitHub mode: proxy the asset from the GitHub repo
    if (import.meta.env.VITE_STORAGE_MODE === "github") {
      const owner = import.meta.env.VITE_GITHUB_OWNER || "derneuere";
      const repo = import.meta.env.VITE_GITHUB_REPO || "visual-react-content";
      const branch = "main";
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/assets/${params._splat}`;

      try {
        const response = await fetch(rawUrl, {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
          },
        });

        if (response.ok) {
          const mimeType = getMimeType(filePath);
          const body = await response.arrayBuffer();
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": mimeType,
              "Content-Length": body.byteLength.toString(),
            },
          });
        }
      } catch (error) {
        console.error("Error fetching asset from GitHub:", error);
      }
    }

    return new Response("Asset not found", { status: 404 });
      },
    },
  },
});
