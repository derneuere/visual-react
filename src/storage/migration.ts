import type { PageData, PageMeta } from "./types";

/**
 * Creates a default PageMeta object.
 */
export function createDefaultMeta(title = "Untitled"): PageMeta {
  const now = new Date().toISOString();
  return {
    title,
    slug: "",
    status: "published",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Migrates raw page JSON to PageData format.
 * If the data is already in PageData format (has `meta` and `content`), returns as-is.
 * If the data is a legacy Instance[] array, wraps it in PageData with default meta.
 */
export function migratePageData(raw: unknown): PageData {
  // Already in new format
  if (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "content" in raw &&
    "meta" in raw
  ) {
    return raw as PageData;
  }

  // Legacy format: Instance[]
  if (Array.isArray(raw)) {
    const title = raw[0]?.props?.title || "Untitled";
    return {
      meta: createDefaultMeta(title),
      content: raw,
    };
  }

  // Fallback
  return {
    meta: createDefaultMeta(),
    content: [],
  };
}
