export interface PageTreeNode {
  /** Display name (e.g., "first-post" or "blog") */
  name: string;
  /** Full path without .json extension (e.g., "blog/first-post") */
  path: string;
  /** Whether this node is a folder (has no page file itself) */
  isFolder: boolean;
  /** Child nodes */
  children: PageTreeNode[];
}

/**
 * Builds a tree structure from a flat list of page paths.
 *
 * Input:  ["index.json", "blog/post-1.json", "blog/post-2.json", "about.json"]
 * Output: [
 *   { name: "about", path: "about", isFolder: false, children: [] },
 *   { name: "blog", path: "blog", isFolder: true, children: [
 *     { name: "post-1", path: "blog/post-1", isFolder: false, children: [] },
 *     { name: "post-2", path: "blog/post-2", isFolder: false, children: [] },
 *   ]},
 *   { name: "index", path: "index", isFolder: false, children: [] },
 * ]
 */
export function buildPageTree(pagePaths: string[]): PageTreeNode[] {
  const root: PageTreeNode[] = [];

  // Map to track folders by path for deduplication
  const folderMap = new Map<string, PageTreeNode>();

  // Helper to ensure a folder chain exists and return the deepest level
  const ensureFolderChain = (segments: string[]): PageTreeNode[] => {
    let currentLevel = root;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const fullPath = segments.slice(0, i + 1).join("/");
      let folder = folderMap.get(fullPath);
      if (!folder) {
        folder = {
          name: segment,
          path: fullPath,
          isFolder: true,
          children: [],
        };
        folderMap.set(fullPath, folder);
        currentLevel.push(folder);
      }
      currentLevel = folder.children;
    }
    return currentLevel;
  };

  for (const raw of pagePaths) {
    // Folder marker (e.g., "archive/" or "blog/drafts/")
    if (raw.endsWith("/")) {
      const folderPath = raw.slice(0, -1);
      ensureFolderChain(folderPath.split("/"));
      continue;
    }

    const pagePath = raw.replace(/\.json$/, "");
    const segments = pagePath.split("/");

    // Ensure intermediate folders exist
    const parentLevel =
      segments.length > 1
        ? ensureFolderChain(segments.slice(0, -1))
        : root;

    // Add the page node
    parentLevel.push({
      name: segments[segments.length - 1],
      path: pagePath,
      isFolder: false,
      children: [],
    });
  }

  // Sort: folders first, then alphabetically
  sortTree(root);
  return root;
}

function sortTree(nodes: PageTreeNode[]) {
  nodes.sort((a, b) => {
    // Folders before pages
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    // Alphabetical within same type
    return a.name.localeCompare(b.name);
  });

  for (const node of nodes) {
    if (node.children.length > 0) {
      sortTree(node.children);
    }
  }
}

/**
 * Flattens a page tree back into a list of page paths (non-folder nodes only).
 * Used for search results where tree structure is not needed.
 */
export function flattenPageTree(nodes: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];
  for (const node of nodes) {
    if (!node.isFolder) {
      result.push(node);
    }
    if (node.children.length > 0) {
      result.push(...flattenPageTree(node.children));
    }
  }
  return result;
}

/**
 * Filters a page tree by search query. Returns matching pages as a flat list.
 */
export function filterPages(
  nodes: PageTreeNode[],
  query: string
): PageTreeNode[] {
  const lower = query.toLowerCase();
  const allPages = flattenPageTree(nodes);
  return allPages.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) ||
      p.path.toLowerCase().includes(lower)
  );
}

/**
 * Returns the parent folder of a page path, or null if the page is at the root.
 *
 * "blog/post-1"       → "blog"
 * "blog/nested/page"  → "blog/nested"
 * "about"             → null
 */
export function getParentFolder(pagePath: string): string | null {
  const idx = pagePath.lastIndexOf("/");
  return idx === -1 ? null : pagePath.substring(0, idx);
}

/**
 * Computes the new path when moving a page into a different folder.
 *
 * - targetFolder = null means root level.
 * - Returns null if the page is already in that folder.
 *
 * movePageToFolder("blog/post-1", null)        → "post-1"       (move to root)
 * movePageToFolder("post-1", "blog")           → "blog/post-1"  (move into blog)
 * movePageToFolder("blog/post-1", "archive")   → "archive/post-1"
 * movePageToFolder("blog/post-1", "blog")      → null           (already there)
 */
export function movePageToFolder(
  pagePath: string,
  targetFolder: string | null
): string | null {
  const currentFolder = getParentFolder(pagePath);
  if (currentFolder === targetFolder) return null;

  const fileName = pagePath.split("/").pop()!;
  return targetFolder ? `${targetFolder}/${fileName}` : fileName;
}

/**
 * Extracts unique folder paths from a list of page paths.
 */
export function extractFolders(pagePaths: string[]): string[] {
  const folders = new Set<string>();
  for (const raw of pagePaths) {
    // Explicit folder marker
    if (raw.endsWith("/")) {
      const folderPath = raw.slice(0, -1);
      folders.add(folderPath);
      const segments = folderPath.split("/");
      for (let i = 1; i < segments.length; i++) {
        folders.add(segments.slice(0, i).join("/"));
      }
      continue;
    }

    const pagePath = raw.replace(/\.json$/, "");
    const segments = pagePath.split("/");
    for (let i = 1; i < segments.length; i++) {
      folders.add(segments.slice(0, i).join("/"));
    }
  }
  return Array.from(folders).sort();
}
