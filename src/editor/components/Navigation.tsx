import React, { useState, useMemo } from "react";

import { useComponentRegistry } from "../../registry/hooks";
import { useStorageAdapter } from "../../storage/hooks";
import {
  Text,
  Group,
  NavLink,
  ActionIcon,
  Menu,
  ScrollArea,
  TextInput,
  Stack,
  Badge,
  Modal,
  Button,
} from "@mantine/core";
import {
  IconPlus,
  IconDots,
  IconCopy,
  IconTrash,
  IconPencil,
  IconCheck,
  IconX,
  IconSearch,
  IconFolder,
  IconFolderPlus,
  IconBookmark,
  IconArrowMoveUp,
  IconFolderSymlink,
  IconFilePlus,
  IconSettings,
} from "@tabler/icons-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor } from "../hooks";
import { CreatePageModal } from "./CreatePageModal";
import { DeletePageConfirmModal } from "./DeletePageConfirmModal";
import { slugify } from "../../utils/pageDefaults";
import {
  buildPageTree,
  filterPages,
  extractFolders,
  getParentFolder,
  movePageToFolder,
  type PageTreeNode,
} from "../../utils/pageTreeUtils";
import type { PageMeta } from "../../storage/types";
import { createDefaultMeta } from "../../storage/migration";
import { TEMPLATES_FOLDER } from "../../templates";
import { SaveAsTemplateModal } from "./SaveAsTemplateModal";

interface NavigationProps {
  onNavigate?: (path: string) => void;
}

function Navigation({ onNavigate: onNavigateProp }: NavigationProps) {
  const { pagePath, currentPage } = useComponentRegistry();
  const { setSelectedInstanceId, setPageSettingsOpen } = useEditor();
  const storage = useStorageAdapter();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["pages"],
    queryFn: () => storage.listPages(),
  });

  const allPages = useMemo(() => data || [], [data]);

  // Filter out _templates/ pages and folders from the navigation
  const pages = useMemo(
    () =>
      allPages.filter((p) => {
        const normalized = p.replace(/\.json$/, "").replace(/\/$/, "");
        return !normalized.startsWith(TEMPLATES_FOLDER + "/") && normalized !== TEMPLATES_FOLDER;
      }),
    [allPages]
  );

  // Build the tree from flat page paths (excluding templates)
  const pageTree = useMemo(() => buildPageTree(pages), [pages]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Folder collapse state
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set()
  );

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInFolder, setCreateInFolder] = useState<string | undefined>(
    undefined
  );
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  // Folder creation state
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderInside, setCreateFolderInside] = useState<string | undefined>(undefined);

  // Inline rename state
  const [renamingPage, setRenamingPage] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = useMemo(
    () => (isSearching ? filterPages(pageTree, searchQuery) : []),
    [pageTree, searchQuery, isSearching]
  );

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const navigateTo = (path: string) => {
    if (onNavigateProp) {
      onNavigateProp(`/editor/${path}`);
    } else {
      window.location.href = `/editor/${path}`;
    }
  };

  // Cache of page meta for visited pages (for status badges)
  const [metaCache, setMetaCache] = useState<Map<string, PageMeta>>(new Map());

  const handleDuplicate = async (sourcePagePath: string) => {
    try {
      const sourceData = await storage.loadPage(sourcePagePath);
      const baseName = sourcePagePath + "-copy";
      let newName = baseName;
      let counter = 1;

      const existingSlugs = pages.map((p: string) => p.replace(".json", ""));
      while (existingSlugs.includes(newName)) {
        newName = `${baseName}-${counter}`;
        counter++;
      }

      const newTitle = `${sourceData.meta.title || sourcePagePath} (Copy)`;
      const duplicatedContent = sourceData.content.map((item, i) =>
        i === 0
          ? {
              ...item,
              props: {
                ...item.props,
                instanceId: crypto.randomUUID(),
                title: newTitle,
              },
            }
          : item
      );

      await storage.savePage(newName, {
        meta: {
          ...createDefaultMeta(newTitle),
          status: "draft",
        },
        content: duplicatedContent,
      });
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      navigateTo(newName);
    } catch (error) {
      console.error("Error duplicating page:", error);
    }
  };

  // Load meta for a page to show status badge
  const loadPageMeta = async (slug: string) => {
    if (metaCache.has(slug)) return;
    try {
      const data = await storage.loadPage(slug);
      setMetaCache((prev) => new Map(prev).set(slug, data.meta));
    } catch {
      // Silently ignore — badge just won't show
    }
  };

  const handleStartRename = (slug: string) => {
    setRenamingPage(slug);
    // For nested pages, only edit the last segment by default
    const lastSegment = slug.split("/").pop() || slug;
    setRenameValue(lastSegment);
  };

  const handleConfirmRename = async () => {
    if (!renamingPage || !renameValue) return;

    const newLastSegment = slugify(renameValue);
    if (!newLastSegment) {
      setRenamingPage(null);
      return;
    }

    // Preserve folder prefix
    const segments = renamingPage.split("/");
    segments[segments.length - 1] = newLastSegment;
    const newSlug = segments.join("/");

    if (newSlug === renamingPage) {
      setRenamingPage(null);
      return;
    }

    const existingSlugs = pages.map((p: string) => p.replace(".json", ""));
    if (existingSlugs.includes(newSlug)) {
      setRenamingPage(null);
      return;
    }

    try {
      await storage.renamePage(renamingPage, newSlug);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      if (pagePath === renamingPage) {
        navigateTo(newSlug);
      }
    } catch (error) {
      console.error("Error renaming page:", error);
    } finally {
      setRenamingPage(null);
    }
  };

  const handleCancelRename = () => {
    setRenamingPage(null);
  };

  // Available folders for "Move to" menu
  const folders = useMemo(() => extractFolders(pages), [pages]);

  const handleMovePage = async (slug: string, targetFolder: string | null) => {
    const newPath = movePageToFolder(slug, targetFolder);
    if (!newPath) return;

    const existingSlugs = pages.map((p: string) => p.replace(".json", ""));
    if (existingSlugs.includes(newPath)) {
      console.error("A page already exists at", newPath);
      return;
    }

    try {
      await storage.renamePage(slug, newPath);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      if (pagePath === slug) {
        navigateTo(newPath);
      }
    } catch (error) {
      console.error("Error moving page:", error);
    }
  };

  const handleCreateFolder = async () => {
    const slug = slugify(newFolderName);
    if (!slug) return;

    const fullPath = createFolderInside ? `${createFolderInside}/${slug}` : slug;

    if (folders.includes(fullPath)) {
      // Folder already exists
      setCreateFolderOpen(false);
      setNewFolderName("");
      return;
    }

    try {
      await storage.createFolder(fullPath);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
    } catch (error) {
      console.error("Error creating folder:", error);
    } finally {
      setCreateFolderOpen(false);
      setNewFolderName("");
      setCreateFolderInside(undefined);
    }
  };

  const openCreateFolder = (insideFolder?: string) => {
    setCreateFolderInside(insideFolder);
    setNewFolderName("");
    setCreateFolderOpen(true);
  };

  const openCreateInFolder = (folderPath?: string) => {
    setCreateInFolder(folderPath);
    setCreateModalOpen(true);
  };

  // Render a single page row (used in both tree and search modes)
  const renderPageRow = (node: PageTreeNode) => {
    const { path: slug, name } = node;
    const isActive = slug === pagePath;
    const isRenaming = slug === renamingPage;

    if (isRenaming) {
      return (
        <Group key={slug} gap={4} wrap="nowrap" mb={2}>
          <TextInput
            size="xs"
            value={renameValue}
            onChange={(e) => setRenameValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmRename();
              if (e.key === "Escape") handleCancelRename();
            }}
            style={{ flex: 1 }}
            autoFocus
          />
          <ActionIcon
            size="xs"
            variant="subtle"
            color="green"
            onClick={handleConfirmRename}
          >
            <IconCheck size={12} />
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            onClick={handleCancelRename}
          >
            <IconX size={12} />
          </ActionIcon>
        </Group>
      );
    }

    // In search mode, show full path; in tree mode, show just the name
    const displayLabel = isSearching ? slug : name;
    const cachedMeta = metaCache.get(slug);
    const isDraft = cachedMeta?.status === "draft";

    // Lazily load meta for visible pages
    if (!metaCache.has(slug)) {
      loadPageMeta(slug);
    }

    return (
      <Group key={slug} gap={0} wrap="nowrap" mb={2}>
        <NavLink
          href={`/editor/${slug}`}
          onClick={(e) => {
            e.preventDefault();
            navigateTo(slug);
          }}
          label={
            <Group gap={6} wrap="nowrap">
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayLabel}
              </span>
              {isDraft && (
                <Badge size="xs" variant="light" color="yellow">
                  Draft
                </Badge>
              )}
            </Group>
          }
          active={isActive}
          variant="light"
          style={{ flex: 1, borderRadius: 4 }}
        />
        {isActive && (
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            title="Page Settings"
            style={{ flexShrink: 0 }}
            onClick={() => {
              setSelectedInstanceId(null);
              setPageSettingsOpen(true);
            }}
          >
            <IconSettings size={14} />
          </ActionIcon>
        )}
        <Menu shadow="md" width={160} position="right-start">
          <Menu.Target>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              style={{ flexShrink: 0 }}
            >
              <IconDots size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconCopy size={14} />}
              onClick={() => handleDuplicate(slug)}
            >
              Duplicate
            </Menu.Item>
            {isActive && (
              <Menu.Item
                leftSection={<IconBookmark size={14} />}
                onClick={() => setSaveTemplateOpen(true)}
              >
                Save as Template
              </Menu.Item>
            )}
            <Menu.Item
              leftSection={<IconPencil size={14} />}
              onClick={() => handleStartRename(slug)}
            >
              Rename
            </Menu.Item>
            {slug !== "index" && (() => {
              const currentFolder = getParentFolder(slug);
              const moveTargets = [
                // "Move to root" if page is nested
                ...(currentFolder !== null
                  ? [{ label: "Root", folder: null as string | null }]
                  : []),
                // All folders except the page's current folder
                ...folders
                  .filter((f) => f !== currentFolder)
                  .map((f) => ({ label: f, folder: f as string | null })),
              ];
              if (moveTargets.length === 0) return null;
              return (
                <>
                  <Menu.Divider />
                  <Menu.Label>Move to</Menu.Label>
                  {currentFolder !== null && (
                    <Menu.Item
                      leftSection={<IconArrowMoveUp size={14} />}
                      onClick={() => handleMovePage(slug, null)}
                    >
                      Root
                    </Menu.Item>
                  )}
                  {folders
                    .filter((f) => f !== currentFolder)
                    .map((f) => (
                      <Menu.Item
                        key={f}
                        leftSection={<IconFolderSymlink size={14} />}
                        onClick={() => handleMovePage(slug, f)}
                      >
                        {f}
                      </Menu.Item>
                    ))}
                </>
              );
            })()}
            {slug !== "index" && (
              <>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={() => setDeleteTarget(slug)}
                >
                  Delete
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Group>
    );
  };

  // Render a folder node with collapsible children
  const renderFolderNode = (node: PageTreeNode) => {
    const isCollapsed = collapsedFolders.has(node.path);

    return (
      <div key={node.path}>
        <Group gap={0} wrap="nowrap" mb={2}>
          <NavLink
            label={node.name}
            leftSection={<IconFolder size={14} />}
            opened={!isCollapsed}
            onClick={() => toggleFolder(node.path)}
            variant="subtle"
            style={{ flex: 1, borderRadius: 4 }}
            styles={{
              label: {
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
            }}
            // Prevent default children rendering — we handle it ourselves
            childrenOffset={0}
          />
          <Menu shadow="md" width={180} position="right-start">
            <Menu.Target>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                style={{ flexShrink: 0 }}
              >
                <IconDots size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconFilePlus size={14} />}
                onClick={() => openCreateInFolder(node.path)}
              >
                New Page Inside
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFolderPlus size={14} />}
                onClick={() => openCreateFolder(node.path)}
              >
                New Folder Inside
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
        {!isCollapsed && (
          <div style={{ paddingLeft: 12 }}>
            {renderTreeNodes(node.children)}
          </div>
        )}
      </div>
    );
  };

  // Render a list of tree nodes (recursive)
  const renderTreeNodes = (nodes: PageTreeNode[]): React.ReactNode => {
    return nodes.map((node) =>
      node.isFolder ? renderFolderNode(node) : renderPageRow(node)
    );
  };

  return (
    <>
      <Stack gap={0} h="100%">
        <Group justify="space-between" p="sm" pb="xs">
          <Text size="sm" fw={700} c="dark">
            Pages
          </Text>
          <Menu shadow="md" width={160} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="light" size="sm" title="Create new...">
                <IconPlus size={14} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconFilePlus size={14} />}
                onClick={() => openCreateInFolder(undefined)}
              >
                New Page
              </Menu.Item>
              <Menu.Item
                leftSection={<IconFolderPlus size={14} />}
                onClick={() => openCreateFolder()}
              >
                New Folder
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {pages.length > 5 && (
          <div style={{ padding: "0 8px 4px" }}>
            <TextInput
              size="xs"
              placeholder="Search pages..."
              leftSection={<IconSearch size={14} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
            />
          </div>
        )}

        <ScrollArea flex={1} px="xs" pb="xs">
          {isSearching
            ? searchResults.length > 0
              ? searchResults.map((node) => renderPageRow(node))
              : (
                <Text size="xs" c="dimmed" ta="center" py="md">
                  No pages found
                </Text>
              )
            : renderTreeNodes(pageTree)}
        </ScrollArea>
      </Stack>

      <CreatePageModal
        opened={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setCreateInFolder(undefined);
        }}
        pages={allPages}
        onNavigate={navigateTo}
        defaultFolder={createInFolder}
      />

      <DeletePageConfirmModal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        pagePath={deleteTarget}
        onNavigate={navigateTo}
      />

      <SaveAsTemplateModal
        opened={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        pageContent={currentPage}
      />

      <Modal
        opened={createFolderOpen}
        onClose={() => {
          setCreateFolderOpen(false);
          setNewFolderName("");
          setCreateFolderInside(undefined);
        }}
        title="Create Folder"
        size="sm"
      >
        <Stack gap="md">
          <TextInput
            label="Folder name"
            placeholder="my-folder"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
            }}
            autoFocus
          />
          {createFolderInside && (
            <Text size="xs" c="dimmed">
              Inside: {createFolderInside}/
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

export default Navigation;
