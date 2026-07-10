import { StorageAdapter, PageData } from "./types";
import { migratePageData } from "./migration";

export interface GitHubStorageAdapterOptions {
  /** GitHub personal access token */
  token: string;
  /** Repository owner (user or organization) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch to read/write from (default: "main") */
  branch?: string;
  /** Directory path where pages are stored (default: "/") */
  pagesPath?: string;
  /** Directory path where assets are stored (default: "/assets/") */
  assetsPath?: string;
}

interface GitHubFileEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  content?: string;
}

export class GitHubStorageAdapter implements StorageAdapter {
  private token: string;
  private owner: string;
  private repo: string;
  private branch: string;
  private pagesPath: string;
  private assetsPath: string;
  private apiBase = "https://api.github.com";

  constructor(options: GitHubStorageAdapterOptions) {
    this.token = options.token;
    this.owner = options.owner;
    this.repo = options.repo;
    this.branch = options.branch ?? "main";
    this.pagesPath = options.pagesPath ?? "/";
    this.assetsPath = options.assetsPath ?? "/assets/";
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github.v3+json",
    };
  }

  private contentsUrl(filePath: string): string {
    return `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${filePath}`;
  }

  /**
   * Recursively list all JSON files under a directory.
   */
  private async listJsonFiles(dirPath: string): Promise<string[]> {
    const response = await fetch(this.contentsUrl(dirPath), {
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const entries: GitHubFileEntry[] = await response.json();
    const results: string[] = [];

    for (const entry of entries) {
      if (entry.type === "file" && entry.name.endsWith(".json")) {
        results.push(entry.path);
      } else if (entry.type === "dir") {
        const nested = await this.listJsonFiles(entry.path);
        results.push(...nested);
      }
    }

    return results;
  }

  /**
   * Get a file's SHA (needed for updates and deletes).
   * Returns null if the file doesn't exist.
   */
  private async getFileSha(filePath: string): Promise<string | null> {
    const response = await fetch(this.contentsUrl(filePath), {
      headers: this.headers,
    });

    if (!response.ok) return null;

    const data: GitHubFileEntry = await response.json();
    return data.sha;
  }

  async listPages(): Promise<string[]> {
    return this.listJsonFiles(this.pagesPath);
  }

  async loadPage(pagePath: string): Promise<PageData> {
    const filePath = pagePath + ".json";
    const response = await fetch(this.contentsUrl(filePath), {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to load page: ${response.statusText}`);
    }

    const data: GitHubFileEntry = await response.json();
    const binary = atob(data.content!.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const content = new TextDecoder().decode(bytes);
    const raw = JSON.parse(content);
    return migratePageData(raw);
  }

  async savePage(pagePath: string, pageData: PageData): Promise<void> {
    const filePath = pagePath + ".json";
    const jsonString = JSON.stringify(pageData, null, 2);
    const bytes = new TextEncoder().encode(jsonString);
    const content = btoa(String.fromCharCode(...bytes));

    // Get existing SHA if file already exists (required for updates)
    const sha = await this.getFileSha(filePath);

    const body: Record<string, string | undefined> = {
      message: sha ? `Update ${filePath}` : `Create ${filePath}`,
      content,
      branch: this.branch,
      sha: sha ?? undefined,
    };

    const response = await fetch(this.contentsUrl(filePath), {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to save page: ${response.statusText}`);
    }
  }

  async renamePage(oldPath: string, newPath: string): Promise<void> {
    const oldFilePath = oldPath + ".json";
    const newFilePath = newPath + ".json";

    // 1. Fetch the existing file content and SHA
    const response = await fetch(this.contentsUrl(oldFilePath), {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`File not found: ${oldFilePath}`);
    }

    const existingFile: GitHubFileEntry = await response.json();

    // 2. Create the new file with the same content
    const createResponse = await fetch(this.contentsUrl(newFilePath), {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({
        message: `Rename ${oldFilePath} to ${newFilePath}`,
        content: existingFile.content!.replace(/\n/g, ""),
        branch: this.branch,
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create renamed file: ${createResponse.statusText}`);
    }

    // 3. Delete the old file
    const deleteResponse = await fetch(this.contentsUrl(oldFilePath), {
      method: "DELETE",
      headers: this.headers,
      body: JSON.stringify({
        message: `Delete ${oldFilePath} after renaming to ${newFilePath}`,
        sha: existingFile.sha,
        branch: this.branch,
      }),
    });

    if (!deleteResponse.ok) {
      throw new Error(`Failed to delete old file: ${deleteResponse.statusText}`);
    }
  }

  async createFolder(folderPath: string): Promise<void> {
    const keepPath = `${folderPath}/.keep`;
    const content = btoa("");

    const body = {
      message: `Create folder ${folderPath}`,
      content,
      branch: this.branch,
    };

    const response = await fetch(this.contentsUrl(keepPath), {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to create folder: ${response.statusText}`);
    }
  }

  async deletePage(pagePath: string): Promise<void> {
    const filePath = pagePath + ".json";
    const sha = await this.getFileSha(filePath);

    if (!sha) {
      throw new Error(`File not found: ${filePath}`);
    }

    const response = await fetch(this.contentsUrl(filePath), {
      method: "DELETE",
      headers: this.headers,
      body: JSON.stringify({
        message: `Delete ${filePath}`,
        sha,
        branch: this.branch,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete page: ${response.statusText}`);
    }
  }

  async listAssets(): Promise<string[]> {
    const response = await fetch(this.contentsUrl(this.assetsPath), {
      headers: this.headers,
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const entries: GitHubFileEntry[] = await response.json();
    return entries
      .filter((entry) => entry.type === "file")
      .map((entry) => entry.path);
  }

  getAssetUrl(assetPath: string): string {
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${assetPath}`;
  }
}
