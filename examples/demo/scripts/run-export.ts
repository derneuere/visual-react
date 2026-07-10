import { build } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readdir, readFile, writeFile, mkdir, cp, copyFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { config } from "dotenv";
import {
  GitHubStorageAdapter,
  type StorageAdapter,
} from "./storage-adapters";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ASSETS_DIR = resolve(ROOT, "src/assets");
const EXPORT_DIR = resolve(ROOT, "export");
const PAGES_DIR = resolve(ROOT, "pages");

// Load .env file
config({ path: resolve(ROOT, ".env") });

function createStorageAdapter(): StorageAdapter {
  const mode = process.env.VITE_STORAGE_MODE;
  if (mode === "github") {
    const token = process.env.VITE_GITHUB_TOKEN;
    const owner = process.env.VITE_GITHUB_OWNER || "derneuere";
    const repo = process.env.VITE_GITHUB_REPO || "visual-react-content";
    if (!token) {
      throw new Error(
        "VITE_GITHUB_TOKEN is required when VITE_STORAGE_MODE=github"
      );
    }
    console.log(`Using GitHub storage: ${owner}/${repo}`);
    return new GitHubStorageAdapter({ token, owner, repo });
  }
  console.log("Using local storage");
  return null as any; // Local mode uses direct filesystem reads
}

// Step 1: Build the client hydration bundle and SSR bundle
async function buildBundles() {
  console.log("Building client bundle...");
  await build({
    configFile: resolve(ROOT, "vite.export.config.ts"),
    logLevel: "warn",
  });
  console.log("Client bundle built.");

  console.log("Building SSR bundle...");
  await build({
    configFile: resolve(ROOT, "vite.export-ssr.config.ts"),
    logLevel: "warn",
  });
  console.log("SSR bundle built.");
}

// Step 2: SSR-render pages using the pre-built SSR bundle
async function renderPages(): Promise<Set<string>> {
  console.log("Starting SSR rendering...");

  const storageMode = process.env.VITE_STORAGE_MODE;
  const isGitHub = storageMode === "github";

  // Load the pre-built SSR module
  const ssrModule = await import(
    resolve(ROOT, "dist-export/ssr/export-ssr.js")
  );
  const renderPage = ssrModule.renderPage as (data: any) => string;

  // Get page list and data from the appropriate source
  let pages: { name: string; data: any }[];

  if (isGitHub) {
    const storage = createStorageAdapter();
    const pageList = await storage.listPages();
    console.log(
      `Found ${pageList.length} page(s) from GitHub: ${pageList.join(", ")}`
    );

    pages = await Promise.all(
      pageList.map(async (pagePath: string) => {
        const name = pagePath.replace(/\.json$/, "");
        const data = await storage.loadPage(name);
        return { name, data };
      })
    );
  } else {
    // Local mode: read from pages/ directory
    const pageFiles = await getLocalPageFiles(PAGES_DIR);
    console.log(
      `Found ${pageFiles.length} page(s): ${pageFiles.join(", ")}`
    );

    pages = await Promise.all(
      pageFiles.map(async (pageFile) => {
        const filePath = resolve(PAGES_DIR, pageFile);
        const raw = await readFile(filePath, "utf-8");
        return {
          name: pageFile.replace(/\.json$/, ""),
          data: JSON.parse(raw),
        };
      })
    );
  }

  // Collect all referenced media assets from page data
  const referencedAssets = new Set<string>();
  for (const { data } of pages) {
    collectReferencedAssets(data, referencedAssets);
  }

  // Ensure export directory exists
  await mkdir(EXPORT_DIR, { recursive: true });

  // Render each page
  for (const { name, data } of pages) {
    const pageTitle = data[0]?.props?.title || name;
    console.log(`  Rendering: ${name}`);

    let html: string;
    try {
      html = renderPage(data);
    } catch (err) {
      console.error(`SSR rendering failed for page "${name}":`, err);
      html = "";
    }
    // Rewrite /api/assets/ references to ./assets/media/
    html = html.replace(/\/api\/assets\//g, "./assets/media/");
    // Rewrite SSR static asset paths to match the client bundle's resolution
    html = html.replace(/"\/([\w.-]+\.(svg|png|jpg|jpeg|webp|gif|ico|woff2?|ttf|eot))"/g, '"./assets/$1"');
    const fullHtml = buildHtmlTemplate(pageTitle, html, data);

    const outputPath = resolve(EXPORT_DIR, `${name}.html`);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, fullHtml, "utf-8");
  }

  console.log(`Rendered ${pages.length} page(s).
Referenced media assets: ${referencedAssets.size}`);

  return referencedAssets;
}

// Step 3: Copy static assets
async function copyAssets(referencedAssets: Set<string>) {
  console.log("Copying assets...");

  // Copy the Vite-built client bundle (includes app.js, export-client.css, and bundled assets)
  const clientSrc = resolve(ROOT, "dist-export/client");
  const clientDest = resolve(EXPORT_DIR, "assets");
  await mkdir(clientDest, { recursive: true });
  await cp(clientSrc, clientDest, { recursive: true });

  // Copy only referenced media assets (not the entire directory)
  if (referencedAssets.size > 0) {
    const mediaDest = resolve(EXPORT_DIR, "assets/media");
    await mkdir(mediaDest, { recursive: true });
    for (const filename of referencedAssets) {
      const src = resolve(ASSETS_DIR, filename);
      if (existsSync(src)) {
        await copyFile(src, resolve(mediaDest, filename));
        console.log(`  Copied: ${filename}`);
      } else if (process.env.VITE_STORAGE_MODE === "github") {
        // Try downloading from GitHub
        const owner = process.env.VITE_GITHUB_OWNER || "derneuere";
        const repo = process.env.VITE_GITHUB_REPO || "visual-react-content";
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/assets/${filename}`;
        try {
          const response = await fetch(rawUrl, {
            headers: {
              Authorization: `Bearer ${process.env.VITE_GITHUB_TOKEN}`,
            },
          });
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            await writeFile(resolve(mediaDest, filename), buffer);
            console.log(`  Downloaded from GitHub: ${filename}`);
          } else {
            console.warn(`  Warning: asset not found on GitHub: ${filename} (${response.status})`);
          }
        } catch (error) {
          console.warn(`  Warning: failed to download asset: ${filename}`, error);
        }
      } else {
        console.warn(`  Warning: referenced asset not found: ${filename}`);
      }
    }
  }

  console.log("Assets copied.");
}

// Recursively scan page data for /api/assets/ references
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

// Recursively find all .json files in a local directory
async function getLocalPageFiles(
  dir: string,
  prefix = ""
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(
        ...(await getLocalPageFiles(resolve(dir, entry.name), relative))
      );
    } else if (entry.name.endsWith(".json")) {
      files.push(relative);
    }
  }

  return files;
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

// Main
async function main() {
  console.log("=== Static Export ===\n");

  // Clean previous export
  if (existsSync(EXPORT_DIR)) {
    await rm(EXPORT_DIR, { recursive: true });
  }

  await buildBundles();
  const referencedAssets = await renderPages();
  await copyAssets(referencedAssets);

  console.log(`\nExport complete! Output in: ${EXPORT_DIR}`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
