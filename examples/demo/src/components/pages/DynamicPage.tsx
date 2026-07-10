import React, { useEffect } from "react";
import { useComponentRegistry, useEditor, useStorageAdapter } from "@derneuere/visual-react";
import { CurrentPage } from "@derneuere/visual-react/editor";

import { Route } from "../../routes/$";
import { useSuspenseQuery } from "@tanstack/react-query";
import { STATIC_FILE_PATTERN } from "../../pageUtils";

// Component for dynamic pages
export const DynamicPage = () => {
  const { _splat } = Route.useParams();
  const { setIsPreview } = useEditor();
  const { switchPage, setPage } = useComponentRegistry();
  const storage = useStorageAdapter();

  const { data } = useSuspenseQuery({
    queryKey: ["page", _splat || "index"],
    queryFn: () => {
      const pagePath = _splat ? _splat : "index";
      if (STATIC_FILE_PATTERN.test(pagePath)) return null;
      return storage.loadPage(pagePath);
    },
  });

  useEffect(() => {
    switchPage(_splat);
    setIsPreview(true);
    if (data) {
      setPage(data);
    }
  }, [_splat, switchPage, setIsPreview, data, setPage]);

  return <CurrentPage notEditable={false} />;
};
