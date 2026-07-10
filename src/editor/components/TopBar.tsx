// TopBar — the editor's top action bar (0.4.0).
//
// Left to right: undo/redo, the view-mode switch (Edit | Desktop | Mobile —
// device-true previews on the same canvas iframe), Save Draft / Publish /
// Export. The old in-document "Previewing" switch is gone: previewing is now
// a canvas view mode.
import {
  Group,
  Button,
  ActionIcon,
  Tooltip,
  SegmentedControl,
} from "@mantine/core";

import { useComponentRegistry } from "../../registry/hooks";
import { useEditorHistory } from "../../headless/useEditorHistory";
import { useStorageAdapter } from "../../storage/hooks";
import {
  IconSend,
  IconFileExport,
  IconDeviceFloppy,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPencil,
  IconDeviceDesktop,
  IconDeviceMobile,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PageData, PageMeta } from "../../storage/types";
import type { EditorViewMode } from "../types";
import { useEditorLabels } from "../labels";

export interface TopBarProps {
  /** Current canvas view mode (owned by the Editor). */
  viewMode: EditorViewMode;
  onViewModeChange: (mode: EditorViewMode) => void;
  /** Endpoint the "Export Site" button POSTs to. Default: "/api/export". */
  exportUrl?: string;
  /**
   * Full override for the export action. When set, it replaces the built-in
   * fetch-and-download behavior entirely (exportUrl is ignored).
   */
  onExport?: () => Promise<void>;
}

const TopBar = ({
  viewMode,
  onViewModeChange,
  exportUrl = "/api/export",
  onExport,
}: TopBarProps) => {
  const { isCurrentPageChanged, pagePath, currentPage, pageMeta, setPageMeta } =
    useComponentRegistry();
  const storage = useStorageAdapter();
  const queryClient = useQueryClient();
  const labels = useEditorLabels();

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

  const { undo, redo, canUndo, canRedo } = useEditorHistory();
  const editing = viewMode === "edit";

  const exportSite = useMutation({
    mutationFn: async () => {
      if (onExport) {
        await onExport();
        return;
      }
      const response = await fetch(exportUrl, { method: "POST" });
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
      {/* Undo/redo — disabled in preview modes (read-only, like the
          keyboard shortcuts) */}
      <Group gap={4}>
        <Tooltip label={labels.undo}>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Undo"
            onClick={undo}
            disabled={!canUndo || !editing}
          >
            <IconArrowBackUp size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={labels.redo}>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Redo"
            onClick={redo}
            disabled={!canRedo || !editing}
          >
            <IconArrowForwardUp size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* View mode: structural editing vs device-true preview on ONE
          never-remounting canvas iframe. */}
      <SegmentedControl
        size="xs"
        value={viewMode}
        onChange={(value) => onViewModeChange(value as EditorViewMode)}
        data={[
          {
            value: "edit",
            label: (
              <Group gap={6} wrap="nowrap" data-testid="viewmode-edit">
                <IconPencil size={14} />
                <span>{labels.editMode}</span>
              </Group>
            ),
          },
          {
            value: "desktop",
            label: (
              <Group gap={6} wrap="nowrap" data-testid="viewmode-desktop">
                <IconDeviceDesktop size={14} />
                <span>{labels.desktopPreview}</span>
              </Group>
            ),
          },
          {
            value: "mobile",
            label: (
              <Group gap={6} wrap="nowrap" data-testid="viewmode-mobile">
                <IconDeviceMobile size={14} />
                <span>{labels.mobilePreview}</span>
              </Group>
            ),
          },
        ]}
      />

      <Button
        leftSection={<IconDeviceFloppy size={14} />}
        variant="default"
        onClick={() => saveDraftMutation.mutate()}
        loading={saveDraftMutation.isPending}
        disabled={!isCurrentPageChanged}
      >
        {labels.saveDraft}
      </Button>
      <Button
        leftSection={<IconSend size={14} />}
        variant="filled"
        onClick={() => publishMutation.mutate()}
        loading={publishMutation.isPending}
        disabled={!isCurrentPageChanged}
      >
        {labels.publish}
      </Button>
      <Button
        leftSection={<IconFileExport size={14} />}
        variant="default"
        onClick={() => exportSite.mutate()}
        loading={exportSite.isPending}
      >
        {labels.exportSite}
      </Button>
    </Group>
  );
};

export default TopBar;
