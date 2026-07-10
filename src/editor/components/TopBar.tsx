import { Switch, Group, Button } from "@mantine/core";

import { useEditor } from "../hooks";
import { useComponentRegistry } from "../../registry/hooks";
import { useStorageAdapter } from "../../storage/hooks";
import { IconSend, IconFileExport, IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PageData, PageMeta } from "../../storage/types";

const TopBar = () => {
  const { isCurrentPageChanged, pagePath, currentPage, pageMeta, setPageMeta } =
    useComponentRegistry();
  const storage = useStorageAdapter();
  const queryClient = useQueryClient();

  const buildPageData = (status: PageMeta["status"]): PageData => {
    const now = new Date().toISOString();
    const meta: PageMeta = {
      ...(pageMeta ?? {
        title: currentPage[0]?.props?.title || "Untitled",
        slug: pagePath,
        status: "draft",
        description: "",
        ogTitle: "",
        ogDescription: "",
        ogImage: "",
        createdAt: now,
        updatedAt: now,
      }),
      status,
      updatedAt: now,
    };
    return { meta, content: currentPage };
  };

  const publishMutation = useMutation({
    mutationFn: () => {
      const pageData = buildPageData("published");
      setPageMeta(pageData.meta);
      return storage.savePage(pagePath, pageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", pagePath] });
    },
    onError: (error) => {
      console.error("Error publishing page:", error);
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: () => {
      const pageData = buildPageData("draft");
      setPageMeta(pageData.meta);
      return storage.savePage(pagePath, pageData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page", pagePath] });
    },
    onError: (error) => {
      console.error("Error saving draft:", error);
    },
  });

  const { isPreview, setIsPreview } = useEditor();

  const exportSite = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/export", { method: "POST" });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "site-export.zip";
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      console.error("Error exporting site:", error);
    },
  });

  return (
    <Group justify="center" className="vr-chrome" style={{ padding: 10 }}>
      <Switch
        checked={isPreview}
        onChange={(event) => setIsPreview(event.currentTarget.checked)}
        label={isPreview ? "Previewing" : "Not Previewing"}
        color="teal"
      />
      <Button
        leftSection={<IconDeviceFloppy size={14} />}
        variant="default"
        onClick={() => saveDraftMutation.mutate()}
        loading={saveDraftMutation.isPending}
        disabled={!isCurrentPageChanged}
      >
        Save Draft
      </Button>
      <Button
        leftSection={<IconSend size={14} />}
        variant="filled"
        onClick={() => publishMutation.mutate()}
        loading={publishMutation.isPending}
        disabled={!isCurrentPageChanged}
      >
        Publish
      </Button>
      <Button
        leftSection={<IconFileExport size={14} />}
        variant="default"
        onClick={() => exportSite.mutate()}
        loading={exportSite.isPending}
      >
        Export Site
      </Button>
    </Group>
  );
};

export default TopBar;
