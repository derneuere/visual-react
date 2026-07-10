// Storage configuration
// This can be set to 'local' or 'github' to switch between storage modes
export type StorageMode = 'local' | 'github';

// Default to local storage mode
export const DEFAULT_STORAGE_MODE: StorageMode = 'local';

// Get the default storage configuration.
// The library ships prebuilt, so it deliberately reads NO environment
// variables (nothing gets baked into dist at build time). Consumers
// configure storage explicitly, e.g. via GitHubStorageAdapter props.
export function getStorageConfig() {
  return {
    mode: DEFAULT_STORAGE_MODE,
    // Local storage directory
    localPagesDir: "pages",
    // GitHub configuration (fill in explicitly in your app)
    github: {
      apiBase: "https://api.github.com",
      owner: "",
      repo: "",
      token: "",
    }
  };
}

// Check if we should use local storage
export function useLocalStorage(): boolean {
  return getStorageConfig().mode === 'local';
}

// Helper functions
export function extractFolderAndFilename(pagePath: string) {
  if (typeof pagePath !== "string") {
    throw new Error("Invalid input: pagePath must be a string");
  }

  const lastSlashIndex = pagePath.lastIndexOf("/");
  const folder = lastSlashIndex > 0 ? pagePath.slice(0, lastSlashIndex) : "/";
  const filename = pagePath.slice(lastSlashIndex + 1);

  if (!filename) {
    throw new Error("Invalid input: pagePath must include a filename");
  }

  return { folder, filename };
}