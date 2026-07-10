import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Alert,
  SimpleGrid,
  Card,
  Text,
  ThemeIcon,
  ActionIcon,
  Menu,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconFile,
  IconLayout,
  IconArticle,
  IconBookmark,
  IconFolder,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStorageAdapter } from "../../storage/hooks";
import { slugify } from "../../utils/pageDefaults";
import { extractFolders } from "../../utils/pageTreeUtils";
import { createDefaultMeta } from "../../storage/migration";
import type { Instance } from "../../registry/types";
import type { PageData } from "../../storage/types";
import {
  builtInTemplates,
  TEMPLATES_FOLDER,
  type PageTemplate,
} from "../../templates";

interface CreatePageModalProps {
  opened: boolean;
  onClose: () => void;
  pages: string[];
  onNavigate: (pagePath: string) => void;
  defaultFolder?: string;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "Blank Page": <IconFile size={24} />,
  "Landing Page": <IconLayout size={24} />,
  "Blog Post": <IconArticle size={24} />,
};

function assignFreshIds(content: Instance[]): Instance[] {
  return content.map((instance) => {
    const newProps: Instance["props"] = { ...instance.props, instanceId: crypto.randomUUID() };
    // Recursively handle children arrays
    for (const key of Object.keys(instance.props)) {
      const val = instance.props[key];
      if (Array.isArray(val) && val.length > 0 && val[0]?.id && val[0]?.props) {
        newProps[key] = assignFreshIds(val as Instance[]);
      }
    }
    return { ...instance, props: newProps };
  });
}

export function CreatePageModal({
  opened,
  onClose,
  pages,
  onNavigate,
  defaultFolder,
}: CreatePageModalProps) {
  const storage = useStorageAdapter();
  const queryClient = useQueryClient();

  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [pageName, setPageName] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userTemplates, setUserTemplates] = useState<PageTemplate[]>([]);

  // Load user-saved templates from _templates/ folder
  useEffect(() => {
    if (!opened) return;
    const loadUserTemplates = async () => {
      try {
        const templatePages = pages
          .filter((p) => p.replace(".json", "").startsWith(TEMPLATES_FOLDER + "/"))
          .map((p) => p.replace(".json", ""));

        const templates: PageTemplate[] = [];
        for (const path of templatePages) {
          try {
            const data = await storage.loadPage(path);
            const name = path.replace(TEMPLATES_FOLDER + "/", "");
            templates.push({
              name,
              description: "Saved template",
              content: data.content,
            });
          } catch {
            // Skip broken templates
          }
        }
        setUserTemplates(templates);
      } catch {
        // Ignore errors loading templates
      }
    };
    loadUserTemplates();
  }, [opened, pages, storage]);

  // Sync defaultFolder when modal opens
  useEffect(() => {
    if (opened) {
      setFolder(defaultFolder ?? null);
    }
  }, [opened, defaultFolder]);

  const allTemplates = useMemo(
    () => [...builtInTemplates, ...userTemplates],
    [userTemplates]
  );

  const slug = slugify(pageName);
  const fullPath = folder ? `${folder}/${slug}` : slug;
  const nonTemplatePages = pages.filter(
    (p) => !p.replace(".json", "").startsWith(TEMPLATES_FOLDER + "/")
  );
  const pageExists = nonTemplatePages.some(
    (p) => p.replace(".json", "") === fullPath
  );

  const handleCreate = async () => {
    if (!slug) {
      setError("Please enter a page name.");
      return;
    }
    if (pageExists) {
      setError("A page with this path already exists.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const templateContent = selectedTemplate
        ? assignFreshIds(selectedTemplate.content)
        : assignFreshIds(builtInTemplates[0].content);

      // Set the page title on the root Page component
      const content = templateContent.map((item, i) =>
        i === 0
          ? { ...item, props: { ...item.props, title: pageName } }
          : item
      );

      const pageData: PageData = {
        meta: createDefaultMeta(pageName),
        content,
      };

      await storage.savePage(fullPath, pageData);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      onNavigate(fullPath);
      handleClose();
    } catch (err) {
      setError("Failed to create page. Please try again.");
      console.error("Error creating page:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setPageName("");
    setFolder(null);
    setError(null);
    onClose();
  };

  const existingFolders = extractFolders(nonTemplatePages);

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Create New Page"
      centered
      size="lg"
    >
      <Stack gap="md">
        {/* Template Picker */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            Choose a template
          </Text>
          <SimpleGrid cols={3} spacing="sm">
            {allTemplates.map((template) => {
              const isSelected = selectedTemplate?.name === template.name;
              const isBuiltIn = builtInTemplates.includes(template);
              return (
                <Card
                  key={template.name}
                  shadow={isSelected ? "md" : "xs"}
                  padding="sm"
                  withBorder
                  style={{
                    cursor: "pointer",
                    borderColor: isSelected
                      ? "var(--mantine-color-blue-5)"
                      : undefined,
                    borderWidth: isSelected ? 2 : 1,
                  }}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <Stack align="center" gap={6}>
                    <ThemeIcon
                      size="lg"
                      variant="light"
                      color={isSelected ? "blue" : "gray"}
                    >
                      {isBuiltIn
                        ? (TEMPLATE_ICONS[template.name] || <IconFile size={24} />)
                        : <IconBookmark size={24} />}
                    </ThemeIcon>
                    <Text size="xs" fw={500} ta="center" lineClamp={1}>
                      {template.name}
                    </Text>
                    <Text size="xs" c="dimmed" ta="center" lineClamp={2}>
                      {template.description}
                    </Text>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </div>

        {/* Page Details */}
        <TextInput
          label="Page Name"
          placeholder="My New Page"
          value={pageName}
          onChange={(e) => setPageName(e.currentTarget.value)}
          description={slug ? `URL: /editor/${fullPath}` : undefined}
          error={pageExists ? "This path is already taken" : undefined}
        />

        <TextInput
          label="Folder (optional)"
          description="Leave empty for root, or type a folder name (e.g. blog)"
          placeholder="e.g. blog"
          value={folder ?? ""}
          onChange={(e) => {
            const val = slugify(e.currentTarget.value.replace(/\s+/g, "-"));
            setFolder(val || null);
          }}
          rightSection={
            existingFolders.length > 0 ? (
              <Menu shadow="md" width={180} position="bottom-end">
                <Menu.Target>
                  <ActionIcon size="sm" variant="subtle" color="gray">
                    <IconFolder size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Existing folders</Menu.Label>
                  {existingFolders.map((f) => (
                    <Menu.Item key={f} onClick={() => setFolder(f)}>
                      {f}/
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            ) : undefined
          }
        />

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            loading={loading}
            disabled={!slug || pageExists}
          >
            Create Page
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
