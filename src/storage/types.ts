import { Instance } from "../registry/types";

export interface PageMeta {
  title: string;
  slug: string;
  status: "draft" | "published";
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageData {
  meta: PageMeta;
  content: Instance[];
}

export interface StorageAdapter {
  /** List all available pages. Returns an array of page paths. */
  listPages(): Promise<string[]>;

  /** Load a page by path. Returns the page data with metadata and content. */
  loadPage(pagePath: string): Promise<PageData>;

  /** Save/create a page at the given path with metadata and content. */
  savePage(pagePath: string, pageData: PageData): Promise<void>;

  /** Rename a page from oldPath to newPath. */
  renamePage(oldPath: string, newPath: string): Promise<void>;

  /** Delete a page by path. */
  deletePage(pagePath: string): Promise<void>;

  /** Create an empty folder at the given path. */
  createFolder(folderPath: string): Promise<void>;

  /** List available assets. Returns an array of asset paths. */
  listAssets(): Promise<string[]>;

  /** Resolve an asset path to a usable URL. */
  getAssetUrl(assetPath: string): string;

  /** Authenticate with username and password. Returns an auth token. */
  login?(username: string, password: string): Promise<string>;

  /** Check if the current auth token is valid. */
  checkAuth?(): Promise<boolean>;
}
