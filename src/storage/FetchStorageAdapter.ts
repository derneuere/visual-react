import { StorageAdapter, PageData } from "./types";
import { migratePageData } from "./migration";

export interface FetchStorageAdapterOptions {
  /** Base URL for API calls (e.g., "http://localhost:3000" or "") */
  baseUrl?: string;
  /** Custom headers to include with every request */
  headers?: Record<string, string>;
  /** Custom path prefix for page API endpoints (default: "/api/pages") */
  pagesPrefix?: string;
  /** Custom path for assets listing endpoint (default: "/api/assets") */
  assetsPath?: string;
  /** Enable auth endpoints (login/checkAuth). Required for Django backend. */
  enableAuth?: boolean;
}

export class FetchStorageAdapter implements StorageAdapter {
  private baseUrl: string;
  private headers: Record<string, string>;
  private pagesPrefix: string;
  private assetsPath: string;
  login?: (username: string, password: string) => Promise<string>;
  checkAuth?: () => Promise<boolean>;

  constructor(options: FetchStorageAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.headers = options.headers ?? {};
    this.pagesPrefix = options.pagesPrefix ?? "/api/pages";
    this.assetsPath = options.assetsPath ?? "/api/assets";

    if (options.enableAuth) {
      this.login = this._login.bind(this);
      this.checkAuth = this._checkAuth.bind(this);
    }
  }

  async listPages(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}${this.pagesPrefix}/list`, {
      headers: this.headers,
    });
    if (!response.ok) throw new Error("Failed to list pages");
    return response.json();
  }

  async loadPage(pagePath: string): Promise<PageData> {
    const response = await fetch(
      `${this.baseUrl}${this.pagesPrefix}/load/${pagePath}`,
      { headers: this.headers }
    );
    if (!response.ok) throw new Error("Failed to load page");
    const raw = await response.json();
    return migratePageData(raw);
  }

  async savePage(pagePath: string, pageData: PageData): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${this.pagesPrefix}/save/${pagePath}`,
      {
        method: "POST",
        body: JSON.stringify({ pageData }),
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
      }
    );
    if (!response.ok) throw new Error("Failed to save page");
  }

  async renamePage(oldPath: string, newPath: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${this.pagesPrefix}/rename/${oldPath}`,
      {
        method: "POST",
        body: JSON.stringify({ newFilePath: newPath }),
        headers: {
          "Content-Type": "application/json",
          ...this.headers,
        },
      }
    );
    if (!response.ok) throw new Error("Failed to rename page");
  }

  async createFolder(folderPath: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${this.pagesPrefix}/create-folder/${folderPath}`,
      {
        method: "POST",
        headers: this.headers,
      }
    );
    if (!response.ok) throw new Error("Failed to create folder");
  }

  async deletePage(pagePath: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}${this.pagesPrefix}/delete/${pagePath}`,
      {
        method: "POST",
        headers: this.headers,
      }
    );
    if (!response.ok) throw new Error("Failed to delete page");
  }

  async listAssets(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}${this.assetsPath}`, {
      headers: this.headers,
    });
    if (!response.ok) throw new Error("Failed to list assets");
    return response.json();
  }

  getAssetUrl(assetPath: string): string {
    return `${this.baseUrl}/api/${assetPath}`;
  }

  setAuthToken(token: string): void {
    if (token) {
      this.headers["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.headers["Authorization"];
    }
  }

  private async _login(username: string, password: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Login failed");
    }
    const data = await response.json();
    this.setAuthToken(data.token);
    return data.token;
  }

  private async _checkAuth(): Promise<boolean> {
    if (!this.headers["Authorization"]) return false;
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/check`, {
        headers: this.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
