import { createFileRoute } from "@tanstack/react-router";

import { DynamicPage } from "../components/pages/DynamicPage";
import { ErrorPage } from "../components/pages/ErrorPage";
import { migratePageData } from "@derneuere/visual-react";
import { STATIC_FILE_PATTERN } from "../pageUtils";

const pageQueryOptions = (_splat) => ({
  queryKey: ["page", _splat || "index"],
  queryFn: async ({ queryKey }) => {
    const [, _splat] = queryKey;
    const pagePath = _splat || "index";
    console.log("Loading page", pagePath);

    // Exclude non-page paths (static assets, API routes, etc.)
    if (
      pagePath.startsWith("api/") ||
      pagePath.startsWith("assets/") ||
      STATIC_FILE_PATTERN.test(pagePath)
    ) {
      return null;
    }

    try {
      // The loader also runs during SSR, where fetch() needs an absolute URL.
      // VITE_URL is the public origin of this app; default to the dev port.
      const baseUrl = import.meta.env.VITE_STORAGE_MODE === "django"
        ? (import.meta.env.VITE_DJANGO_URL || "http://localhost:8000")
        : (import.meta.env.VITE_URL || "http://localhost:3000");
      const response = await fetch(
        baseUrl + `/api/pages/load/${pagePath}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.error(`Page not found: ${pagePath}`);
        }
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }

      const raw = await response.json();
      return migratePageData(raw);
    } catch (error) {
      console.error(`Error loading page ${pagePath}:`, error);
      throw error;
    }
  },
});

export const Route = createFileRoute("/$")({
  component: DynamicPage,
  loader: ({ context: { queryClient }, params: { _splat } }) =>
    queryClient.ensureQueryData(pageQueryOptions(_splat)),
  errorComponent: ErrorPage,
});
