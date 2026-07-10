import { useState } from "react";

import { useComponentRegistry } from "../../registry/hooks";
import { useStorageAdapter } from "../../storage/hooks";
import {
  Card,
  FileInput,
  Text,
  Group,
  Button,
  TextInput,
  Textarea,
  Stack,
  ActionIcon,
  SegmentedControl,
  Collapse,
} from "@mantine/core";
import {
  IconUpload,
  IconDownload,
  IconEdit,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import type { PageMeta } from "../../storage/types";
import { migratePageData } from "../../storage/migration";

const TreeFileHandler = () => {
  const {
    currentPage: tree,
    setCurrentPage: setTree,
    downloadTree,
    pagePath,
    updateInstanceProps,
    pageMeta,
    setPageMeta,
  } = useComponentRegistry();
  const storage = useStorageAdapter();

  const [newPagePath, setNewPagePath] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const renamePage = async (currentPath: string, newFilePath: string) => {
    try {
      await storage.renamePage(currentPath, newFilePath);
    } catch (error) {
      console.error("Error renaming page:", error);
    }
  };

  const handleFileUpload = (file: File | null) => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = JSON.parse(event.target?.result as string);
          const pageData = migratePageData(raw);
          setTree(pageData.content);
          setPageMeta(pageData.meta);
        } catch (error) {
          console.error("Invalid JSON file:", error);
          alert("Failed to load page: Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    }
  };

  const updateMeta = (updates: Partial<PageMeta>) => {
    if (!pageMeta) return;
    setPageMeta({ ...pageMeta, ...updates });
  };

  return (
    <Card shadow="sm" padding="lg" withBorder>
      <Stack>
        <Text size="lg" fw={700} mb="sm" c="dark">
          Page Settings
        </Text>

        {/* General */}
        {tree.length > 0 && (
          <TextInput
            label="Page Title"
            value={tree[0].props.title || ""}
            onChange={(e) => {
              updateInstanceProps(tree[0].props.instanceId, {
                title: e.target.value,
              });
              updateMeta({ title: e.target.value });
            }}
            placeholder="Enter Title"
          />
        )}

        <TextInput
          label="Rename Page"
          placeholder="Enter new page name"
          value={newPagePath}
          onChange={(e) => setNewPagePath(e.target.value)}
          rightSection={
            <ActionIcon
              variant="subtle"
              c="black"
              onClick={() =>
                renamePage(pagePath.replace(".json", ""), newPagePath)
              }
            >
              <IconEdit />
            </ActionIcon>
          }
        />

        {/* Status */}
        {pageMeta && (
          <div>
            <Text size="sm" fw={500} mb={4}>
              Status
            </Text>
            <SegmentedControl
              fullWidth
              value={pageMeta.status}
              onChange={(value) =>
                updateMeta({ status: value as PageMeta["status"] })
              }
              data={[
                { label: "Draft", value: "draft" },
                { label: "Published", value: "published" },
              ]}
            />
          </div>
        )}

        {/* SEO Section */}
        <Button
          variant="subtle"
          size="sm"
          onClick={() => setSeoOpen((o) => !o)}
          leftSection={
            seoOpen ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )
          }
          justify="flex-start"
          px={0}
        >
          SEO & Social
        </Button>
        <Collapse in={seoOpen}>
          <Stack gap="sm">
            <Textarea
              label="Meta Description"
              placeholder="Brief description for search engines"
              value={pageMeta?.description || ""}
              onChange={(e) => updateMeta({ description: e.target.value })}
              autosize
              minRows={2}
              maxRows={4}
            />
            <TextInput
              label="OG Title"
              placeholder="Title for social sharing"
              value={pageMeta?.ogTitle || ""}
              onChange={(e) => updateMeta({ ogTitle: e.target.value })}
            />
            <Textarea
              label="OG Description"
              placeholder="Description for social sharing"
              value={pageMeta?.ogDescription || ""}
              onChange={(e) => updateMeta({ ogDescription: e.target.value })}
              autosize
              minRows={2}
              maxRows={4}
            />
            <TextInput
              label="OG Image URL"
              placeholder="https://example.com/image.png"
              value={pageMeta?.ogImage || ""}
              onChange={(e) => updateMeta({ ogImage: e.target.value })}
            />
          </Stack>
        </Collapse>

        {/* Advanced Section */}
        <Button
          variant="subtle"
          size="sm"
          onClick={() => setAdvancedOpen((o) => !o)}
          leftSection={
            advancedOpen ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )
          }
          justify="flex-start"
          px={0}
        >
          Import / Export
        </Button>
        <Collapse in={advancedOpen}>
          <Group justify="center">
            <FileInput
              accept="application/json"
              onChange={(file) => handleFileUpload(file)}
              leftSection={<IconUpload size={18} />}
              placeholder="Upload Page"
            />
            <Button
              leftSection={<IconDownload size={18} />}
              variant="default"
              onClick={downloadTree}
            >
              Download Page
            </Button>
          </Group>
        </Collapse>
      </Stack>
    </Card>
  );
};

export default TreeFileHandler;
