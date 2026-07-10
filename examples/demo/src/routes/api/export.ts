import { createFileRoute } from "@tanstack/react-router";
import { promises as fs } from "fs";
import path from "path";
import archiver from "archiver";
import {
  LOCAL_PAGES_DIR,
  LOCAL_ASSETS_DIR,
} from "../../../utils/pagesUtils";
import {
  GitHubStorageAdapter,
  type StorageAdapter,
} from "@derneuere/visual-react";

const DIST_EXPORT_CLIENT = path.resolve(process.cwd(), "dist-export/client");
const DIST_EXPORT_SSR = path.resolve(process.cwd(), "dist-export/ssr");

function createStorageAdapter(): StorageAdapter | null {
  if (import.meta.env.VITE_STORAGE_MODE === "github") {
    return new GitHubStorageAdapter({
      token: import.meta.env.VITE_GITHUB_TOKEN,
      owner: import.meta.env.VITE_GITHUB_OWNER || "derneuere",
      repo: import.meta.env.VITE_GITHUB_REPO || "visual-react-content",
    });
  }
  return null; // local mode
}

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      POST: async () => {
    try {
      // Check if the pre-built export assets exist
      const clientBundleExists = await fileExists(
        path.join(DIST_EXPORT_CLIENT, "app.js")
      );
      const ssrBundleExists = await fileExists(
        path.join(DIST_EXPORT_SSR, "export-ssr.js")
      );
      if (!clientBundleExists || !ssrBundleExists) {
        return new Response(
          JSON.stringify({
            error:
              'Export bundles not found. Run "npm run build:export" first to build export assets.',
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      // Load pre-built SSR module
      const ssrModule = await import(
        path.join(DIST_EXPORT_SSR, "export-ssr.js")
      );
      const renderPage = ssrModule.renderPage as (data: any) => string;

      // Load pages from the appropriate storage backend
      const storage = createStorageAdapter();
      let pages: { name: string; data: any }[];

      if (storage) {
        // GitHub mode: use the storage adapter
        const pageList = await storage.listPages();
        if (pageList.length === 0) {
          return new Response(
            JSON.stringify({ error: "No pages found to export." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        pages = await Promise.all(
          pageList.map(async (pagePath: string) => {
            const name = pagePath.replace(/\.json$/, "");
            const data = await storage.loadPage(name);
            return { name, data };
          })
        );
      } else {
        // Local mode: read from filesystem
        const pageFiles = await getLocalPageFiles(LOCAL_PAGES_DIR);
        if (pageFiles.length === 0) {
          return new Response(
            JSON.stringify({ error: "No pages found to export." }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }
        pages = await Promise.all(
          pageFiles.map(async (pageFile) => {
            const filePath = path.resolve(LOCAL_PAGES_DIR, pageFile);
            const raw = await fs.readFile(filePath, "utf-8");
            return {
              name: pageFile.replace(/\.json$/, ""),
              data: JSON.parse(raw),
            };
          })
        );
      }

      // Collect referenced media assets from all pages
      const referencedAssets = new Set<string>();
      for (const { data } of pages) {
        collectReferencedAssets(data, referencedAssets);
      }

      // Create ZIP archive in memory
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on("data", (chunk: Buffer) => chunks.push(chunk));

      // Add pre-built client assets
      archive.directory(DIST_EXPORT_CLIENT, "assets");

      // Add only referenced media assets (not the entire directory)
      if (referencedAssets.size > 0) {
        for (const filename of referencedAssets) {
          const filePath = path.resolve(LOCAL_ASSETS_DIR, filename);
          if (await fileExists(filePath)) {
            archive.file(filePath, { name: `assets/media/${filename}` });
          } else if (storage) {
            // Download from GitHub
            const assetUrl = storage.getAssetUrl(`assets/${filename}`);
            try {
              const response = await fetch(assetUrl, {
                headers: {
                  Authorization: `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
                },
              });
              if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                archive.append(buffer, { name: `assets/media/${filename}` });
              }
            } catch {
              // Skip assets that can't be downloaded
            }
          }
        }
      }

      // SSR render and generate HTML for each page
      for (const { name, data } of pages) {
        const pageTitle = data[0]?.props?.title || name;
        let ssrHtml: string;
        try {
          ssrHtml = renderPage(data);
        } catch (err) {
          console.error(`SSR rendering failed for page "${name}":`, err);
          ssrHtml = "";
        }
        ssrHtml = ssrHtml.replace(/\/api\/assets\//g, "./assets/media/");
        // Rewrite SSR static asset paths to match the client bundle's resolution
        // SSR outputs "/france.svg", client resolves to "./assets/france.svg"
        ssrHtml = ssrHtml.replace(/"\/([\w.-]+\.(svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|eot))"/g, '"./assets/$1"');
        const html = buildHtmlTemplate(pageTitle, ssrHtml, data);
        archive.append(html, { name: `${name}.html` });
      }

      await archive.finalize();

      const zipBuffer = Buffer.concat(chunks);

      return new Response(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=site-export.zip",
        },
      });
    } catch (error) {
      console.error("Export error:", error);
      return new Response(
        JSON.stringify({ error: "Export failed." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
      },
    },
  },
});

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getLocalPageFiles(
  dir: string,
  prefix = ""
): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await getLocalPageFiles(path.resolve(dir, entry.name), relative))
      );
    } else if (entry.name.endsWith(".json")) {
      files.push(relative);
    }
  }
  return files;
}

function collectReferencedAssets(data: any, assets: Set<string>) {
  if (typeof data === "string") {
    const matches = data.matchAll(/\/api\/assets\/([^"'\s\\]+)/g);
    for (const match of matches) {
      assets.add(match[1]);
    }
  } else if (Array.isArray(data)) {
    for (const item of data) {
      collectReferencedAssets(item, assets);
    }
  } else if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      collectReferencedAssets(value, assets);
    }
  }
}

function buildHtmlTemplate(
  title: string,
  ssrHtml: string,
  pageData: any
): string {
  const escapedData = JSON.stringify(pageData)
    .replace(/\/api\/assets\//g, "./assets/media/")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e");

  return `<!DOCTYPE html>
<html lang="de" data-mantine-color-scheme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="./assets/export-client.css">
</head>
<body>
  <div id="root">${ssrHtml}</div>
  <script type="application/json" id="__PAGE_DATA__">${escapedData}</script>
  <script type="module" src="./assets/app.js"></script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
