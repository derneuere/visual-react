// Minimal storage adapter for the export runner script.
// We can't import from 'visual-react' directly because tsx can't handle
// CSS imports bundled into the library.

export interface Instance {
  id: string;
  props: any;
}

export interface StorageAdapter {
  listPages(): Promise<string[]>;
  loadPage(pagePath: string): Promise<Instance[]>;
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
  private apiBase = "https://api.github.com";

  constructor(options: {
    token: string;
    owner: string;
    repo: string;
    branch?: string;
    pagesPath?: string;
  }) {
    this.token = options.token;
    this.owner = options.owner;
    this.repo = options.repo;
    this.branch = options.branch ?? "main";
    this.pagesPath = options.pagesPath ?? "/";
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

  async listPages(): Promise<string[]> {
    return this.listJsonFiles(this.pagesPath);
  }

  async loadPage(pagePath: string): Promise<Instance[]> {
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
    return JSON.parse(content);
  }
}
