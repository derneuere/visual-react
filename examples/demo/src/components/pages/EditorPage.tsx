import React, { useCallback, useEffect } from "react";

import { useComponentRegistry, useStorageAdapter } from "@derneuere/visual-react";
import { Editor } from "@derneuere/visual-react/editor";
import { Route } from "../../routes/editor/$";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export const EditorPage = () => {
  const { _splat } = Route.useParams();
  const { switchPage, setPage } = useComponentRegistry();
  const storage = useStorageAdapter();
  const navigate = useNavigate();

  const { data } = useSuspenseQuery({
    queryKey: ["page", _splat || "index"],
    queryFn: async () => {
      const pagePath = _splat ? _splat : "index";
      if (pagePath === "favicon.ico") return null;
      try {
        return await storage.loadPage(pagePath);
      } catch {
        // Page doesn't exist yet — return empty page data for new page creation
        return {
          meta: {
            title: "Untitled",
            slug: pagePath,
            status: "draft" as const,
            description: "",
            ogTitle: "",
            ogDescription: "",
            ogImage: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          content: [],
        };
      }
    },
  });

  useEffect(() => {
    switchPage(_splat);
    if (data) {
      setPage(data);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleNavigate = useCallback(
    (href: string) => {
      try {
        const url = new URL(href, window.location.origin);

        // Only intercept same-origin links
        if (url.origin !== window.location.origin) {
          window.open(href, "_blank");
          return;
        }

        // Strip /editor/ prefix if present (from sidebar navigation), then leading slash
        const pagePath = url.pathname.replace(/^\/editor\//, "").replace(/^\//, "") || "index";
        navigate({ to: "/editor/$", params: { _splat: pagePath } });
      } catch {
        // If URL parsing fails, treat as relative path
        const pagePath = href.replace(/^\/editor\//, "").replace(/^\//, "") || "index";
        navigate({ to: "/editor/$", params: { _splat: pagePath } });
      }
    },
    [navigate]
  );

  return <Editor onNavigate={handleNavigate} />;
};
