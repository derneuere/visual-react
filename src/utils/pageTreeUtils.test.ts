import { describe, it, expect } from "vitest";
import {
  buildPageTree,
  flattenPageTree,
  filterPages,
  extractFolders,
  getParentFolder,
  movePageToFolder,
} from "./pageTreeUtils";

describe("buildPageTree", () => {
  it("builds a flat list of pages", () => {
    const tree = buildPageTree(["index.json", "about.json"]);
    expect(tree).toEqual([
      { name: "about", path: "about", isFolder: false, children: [] },
      { name: "index", path: "index", isFolder: false, children: [] },
    ]);
  });

  it("creates intermediate folder nodes", () => {
    const tree = buildPageTree([
      "index.json",
      "blog/post-1.json",
      "blog/post-2.json",
    ]);
    expect(tree).toHaveLength(2);
    const blog = tree.find((n) => n.name === "blog");
    expect(blog).toBeDefined();
    expect(blog!.isFolder).toBe(true);
    expect(blog!.children).toHaveLength(2);
    expect(blog!.children[0].name).toBe("post-1");
  });

  it("handles deeply nested pages", () => {
    const tree = buildPageTree(["docs/api/v2/endpoints.json"]);
    expect(tree).toHaveLength(1);
    const docs = tree[0];
    expect(docs.isFolder).toBe(true);
    expect(docs.name).toBe("docs");

    const api = docs.children[0];
    expect(api.isFolder).toBe(true);

    const v2 = api.children[0];
    expect(v2.isFolder).toBe(true);

    const endpoints = v2.children[0];
    expect(endpoints.isFolder).toBe(false);
    expect(endpoints.path).toBe("docs/api/v2/endpoints");
  });

  it("sorts folders before pages, then alphabetically", () => {
    const tree = buildPageTree([
      "zebra.json",
      "alpha.json",
      "blog/post.json",
    ]);
    expect(tree[0].name).toBe("blog"); // folder first
    expect(tree[1].name).toBe("alpha");
    expect(tree[2].name).toBe("zebra");
  });

  it("deduplicates folders for multiple pages in same directory", () => {
    const tree = buildPageTree([
      "blog/a.json",
      "blog/b.json",
      "blog/c.json",
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    expect(buildPageTree([])).toEqual([]);
  });

  it("creates folder nodes from folder markers", () => {
    const tree = buildPageTree(["index.json", "archive/"]);
    expect(tree).toHaveLength(2);
    const archive = tree.find((n) => n.name === "archive");
    expect(archive).toBeDefined();
    expect(archive!.isFolder).toBe(true);
    expect(archive!.children).toHaveLength(0);
  });

  it("handles nested folder markers", () => {
    const tree = buildPageTree(["docs/drafts/"]);
    expect(tree).toHaveLength(1);
    const docs = tree[0];
    expect(docs.isFolder).toBe(true);
    expect(docs.children).toHaveLength(1);
    expect(docs.children[0].name).toBe("drafts");
    expect(docs.children[0].isFolder).toBe(true);
  });

  it("merges folder markers with page-derived folders", () => {
    const tree = buildPageTree(["blog/post-1.json", "blog/"]);
    expect(tree).toHaveLength(1);
    const blog = tree[0];
    expect(blog.isFolder).toBe(true);
    expect(blog.children).toHaveLength(1);
    expect(blog.children[0].name).toBe("post-1");
  });

  it("shows empty folder alongside pages", () => {
    const tree = buildPageTree(["index.json", "empty-folder/"]);
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("empty-folder"); // folder sorted first
    expect(tree[0].isFolder).toBe(true);
    expect(tree[0].children).toHaveLength(0);
    expect(tree[1].name).toBe("index");
  });
});

describe("flattenPageTree", () => {
  it("returns only page nodes from a tree", () => {
    const tree = buildPageTree([
      "index.json",
      "blog/post-1.json",
      "blog/post-2.json",
    ]);
    const flat = flattenPageTree(tree);
    expect(flat.every((n) => !n.isFolder)).toBe(true);
    expect(flat).toHaveLength(3);
  });

  it("returns empty for empty tree", () => {
    expect(flattenPageTree([])).toEqual([]);
  });
});

describe("filterPages", () => {
  it("filters by name", () => {
    const tree = buildPageTree(["index.json", "about.json", "blog/post.json"]);
    const results = filterPages(tree, "post");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("blog/post");
  });

  it("filters by full path", () => {
    const tree = buildPageTree(["blog/post-1.json", "news/post-1.json"]);
    const results = filterPages(tree, "blog");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("blog/post-1");
  });

  it("is case insensitive", () => {
    const tree = buildPageTree(["About.json"]);
    expect(filterPages(tree, "about")).toHaveLength(1);
    expect(filterPages(tree, "ABOUT")).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const tree = buildPageTree(["index.json"]);
    expect(filterPages(tree, "zzz")).toHaveLength(0);
  });
});

describe("extractFolders", () => {
  it("extracts unique folder paths", () => {
    const folders = extractFolders([
      "blog/post-1.json",
      "blog/post-2.json",
      "docs/api/endpoint.json",
    ]);
    expect(folders).toEqual(["blog", "docs", "docs/api"]);
  });

  it("returns empty for root-level pages", () => {
    expect(extractFolders(["index.json", "about.json"])).toEqual([]);
  });

  it("includes all intermediate folders", () => {
    const folders = extractFolders(["a/b/c/page.json"]);
    expect(folders).toEqual(["a", "a/b", "a/b/c"]);
  });

  it("includes folders from folder markers", () => {
    const folders = extractFolders(["archive/"]);
    expect(folders).toEqual(["archive"]);
  });

  it("includes intermediate folders from nested folder markers", () => {
    const folders = extractFolders(["docs/drafts/"]);
    expect(folders).toEqual(["docs", "docs/drafts"]);
  });

  it("deduplicates folders from markers and pages", () => {
    const folders = extractFolders(["blog/post.json", "blog/"]);
    expect(folders).toEqual(["blog"]);
  });
});

describe("getParentFolder", () => {
  it("returns null for root-level pages", () => {
    expect(getParentFolder("index")).toBeNull();
    expect(getParentFolder("about")).toBeNull();
  });

  it("returns the parent folder for nested pages", () => {
    expect(getParentFolder("blog/post-1")).toBe("blog");
    expect(getParentFolder("docs/api/endpoint")).toBe("docs/api");
  });

  it("returns immediate parent only", () => {
    expect(getParentFolder("a/b/c")).toBe("a/b");
  });
});

describe("movePageToFolder", () => {
  it("moves a nested page to root", () => {
    expect(movePageToFolder("blog/post-1", null)).toBe("post-1");
  });

  it("moves a root page into a folder", () => {
    expect(movePageToFolder("about", "blog")).toBe("blog/about");
  });

  it("moves a page between folders", () => {
    expect(movePageToFolder("blog/post-1", "archive")).toBe("archive/post-1");
  });

  it("moves a page into a deeply nested folder", () => {
    expect(movePageToFolder("post", "docs/api/v2")).toBe("docs/api/v2/post");
  });

  it("moves a deeply nested page to root", () => {
    expect(movePageToFolder("a/b/c/page", null)).toBe("page");
  });

  it("moves a deeply nested page to a different folder", () => {
    expect(movePageToFolder("a/b/c/page", "x")).toBe("x/page");
  });

  it("returns null if already in the target folder", () => {
    expect(movePageToFolder("blog/post-1", "blog")).toBeNull();
  });

  it("returns null if root page moved to root", () => {
    expect(movePageToFolder("about", null)).toBeNull();
  });
});
