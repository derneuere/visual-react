// ComponentTree — hierarchical layer tree of the current page (0.4.0).
//
// The tree walks currentPage via the registry's hasChildren/getChildren so
// nesting renders recursively. Clicking a node selects it. Per-node
// affordances: move up/down, move out of / into a sibling container (the
// shared treeUtils helpers), duplicate + delete, and a right-click context
// menu (insert component / duplicate / delete). Rows are drop targets via
// useTreeDroppable, sharing the { instanceId, fieldName } data contract with
// the canvas proxies so useEditorDnd resolves both alike — dragging a
// palette entry (or an existing node in the future) over a row shows the
// above/below/into indicator and drops accordingly.
import React, { useState, useCallback, useEffect } from "react";
import { ScrollArea, Text, ActionIcon, Tooltip, Menu, Button } from "@mantine/core";
import {
  IconChevronRight,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconArrowNarrowLeft,
  IconArrowNarrowRight,
  IconCopy,
  IconTrash,
  IconPlus,
} from "@tabler/icons-react";
import { useEditor } from "../hooks";
import { useComponentRegistry } from "../../registry/hooks";
import {
  addItemRelativeToNode,
  addItemToParent,
  findNode,
  moveInstanceUp,
  moveInstanceDown,
  moveInstanceOut,
  moveInstanceInto,
} from "../../utils/treeUtils";
import { useTreeDroppable } from "../../headless/dnd";
import type { Instance } from "../../registry/types";
import { useEditorLabels } from "../labels";
import { ComponentPickerModal } from "./ComponentPickerModal";

// Collect all container instanceIds from the tree for initial expansion
function collectContainerIds(
  instances: Instance[],
  hasChildren: (i: Instance) => boolean,
  getChildren: (i: Instance) => string[] | null
): Set<string | number> {
  const ids = new Set<string | number>();
  const walk = (items: Instance[]) => {
    for (const inst of items) {
      if (hasChildren(inst)) {
        ids.add(inst.props.instanceId);
        const fields = getChildren(inst);
        if (fields) {
          for (const f of fields) {
            const children = inst.props[f];
            if (Array.isArray(children)) walk(children);
          }
        }
      }
    }
  };
  walk(instances);
  return ids;
}

// Wraps a tree row in a useTreeDroppable drop target and draws the shared
// drop indicator (insertion line above/below, nesting outline for "into").
function TreeRowDroppable({
  instanceId,
  children,
}: {
  instanceId: string | number;
  children: React.ReactNode;
}) {
  const { setNodeRef, position } = useTreeDroppable(instanceId);

  return (
    <div ref={setNodeRef} style={{ position: "relative" }}>
      {position === "above" && (
        <div
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            zIndex: 10,
            height: 2,
            background: "#228be6",
          }}
        />
      )}
      {position === "below" && (
        <div
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            height: 2,
            background: "#228be6",
          }}
        />
      )}
      <div
        style={{
          borderRadius: 4,
          boxShadow:
            position === "into" ? "inset 0 0 0 1px #228be6" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ComponentTree() {
  const { selectedInstanceId, setSelectedInstanceId } = useEditor();
  const {
    currentPage,
    setCurrentPage,
    hasChildren,
    getChildren,
    getComponentProps,
    duplicateNode,
    deleteNode,
    pagePath,
  } = useComponentRegistry();
  const labels = useEditorLabels();

  const [expandedNodes, setExpandedNodes] = useState<Set<string | number>>(
    () => collectContainerIds(currentPage, hasChildren, getChildren)
  );

  // Reset expansion when page changes
  useEffect(() => {
    setExpandedNodes(collectContainerIds(currentPage, hasChildren, getChildren));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePath]);

  // Context menu state: which node it targets and where to render it.
  const [contextMenu, setContextMenu] = useState<{
    instanceId: string | number;
    x: number;
    y: number;
  } | null>(null);

  // Component picker modal: the node the chosen component is inserted
  // relative to; null = append to the page root.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<string | number | null>(
    null
  );

  const openPicker = useCallback((targetId: string | number | null) => {
    setPickerTarget(targetId);
    setPickerOpen(true);
  }, []);

  // Insert the picked component: into a container target (as its last
  // child), below a leaf target (as a sibling), or appended to the page
  // root when target is null.
  const insertComponent = useCallback(
    (widgetKey: string) => {
      const metadata = getComponentProps(widgetKey);
      if (!metadata) return;
      const newItem: Instance = {
        id: widgetKey,
        props: {
          ...metadata.defaultProps,
          instanceId: crypto.randomUUID(),
        },
      };

      if (pickerTarget == null) {
        setCurrentPage((prev) => {
          const root = prev[0];
          if (!root || !hasChildren(root)) return [...prev, newItem];
          return addItemToParent(
            prev,
            root.props.instanceId,
            newItem,
            hasChildren,
            getChildren
          );
        });
        return;
      }

      const target = findNode(
        currentPage,
        pickerTarget,
        hasChildren,
        getChildren
      );
      if (!target) return;

      if (hasChildren(target)) {
        setCurrentPage((prev) =>
          addItemToParent(
            prev,
            target.props.instanceId,
            newItem,
            hasChildren,
            getChildren
          )
        );
      } else {
        setCurrentPage((prev) =>
          addItemRelativeToNode(
            prev,
            target.props.instanceId,
            newItem,
            "below",
            hasChildren,
            getChildren
          )
        );
      }
    },
    [pickerTarget, currentPage, setCurrentPage, hasChildren, getChildren, getComponentProps]
  );

  const toggleExpand = useCallback(
    (instanceId: string | number, e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(instanceId)) {
          next.delete(instanceId);
        } else {
          next.add(instanceId);
        }
        return next;
      });
    },
    []
  );

  // All tree surgery lives in the shared treeUtils helpers (single
  // implementation across the package). A null result means no-op (edge of
  // the sibling list, no parent, no container sibling) — keep the tree.
  const handleMove = useCallback(
    (instanceId: string | number, direction: "up" | "down") => {
      const move = direction === "up" ? moveInstanceUp : moveInstanceDown;
      setCurrentPage(
        (prev) => move(prev, instanceId, hasChildren, getChildren) ?? prev
      );
    },
    [setCurrentPage, hasChildren, getChildren]
  );

  const handleMoveOut = useCallback(
    (instanceId: string | number) => {
      setCurrentPage(
        (prev) =>
          moveInstanceOut(prev, instanceId, hasChildren, getChildren) ?? prev
      );
    },
    [setCurrentPage, hasChildren, getChildren]
  );

  const handleMoveInto = useCallback(
    (instanceId: string | number) => {
      setCurrentPage(
        (prev) =>
          moveInstanceInto(prev, instanceId, hasChildren, getChildren) ?? prev
      );
    },
    [setCurrentPage, hasChildren, getChildren]
  );

  const renderNode = (
    instance: Instance,
    depth: number,
    index: number,
    siblings: Instance[]
  ) => {
    const siblingCount = siblings.length;
    const isContainer = hasChildren(instance);
    const isExpanded = expandedNodes.has(instance.props.instanceId);
    const isSelected = selectedInstanceId === instance.props.instanceId;
    const meta = getComponentProps(instance.id);
    const name = meta?.name || instance.id;
    const childFields = isContainer ? getChildren(instance) : null;
    const hasMultipleFields = childFields && childFields.length > 1;

    // Disabled when the node has no parent (root level)
    const canMoveOut = depth > 0;
    // Disabled when there is no previous sibling or it is not a container
    const canMoveInto =
      index > 0 && hasChildren(siblings[index - 1]);

    return (
      <div key={instance.props.instanceId}>
        <TreeRowDroppable instanceId={instance.props.instanceId}>
          <div
            className="tree-node"
            data-testid={`tree-node-${instance.props.instanceId}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedInstanceId(instance.props.instanceId);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSelectedInstanceId(instance.props.instanceId);
              setContextMenu({
                instanceId: instance.props.instanceId,
                x: e.clientX,
                y: e.clientY,
              });
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              paddingLeft: depth * 14 + 4,
              paddingRight: 4,
              paddingTop: 2,
              paddingBottom: 2,
              cursor: "pointer",
              borderRadius: 4,
              fontSize: 12,
              backgroundColor: isSelected ? "#dbeafe" : "transparent",
              fontWeight: isSelected ? 600 : 400,
              color: isSelected ? "#1e40af" : "#334155",
            }}
            onMouseEnter={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "#f1f5f9";
            }}
            onMouseLeave={(e) => {
              if (!isSelected)
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
            }}
          >
            {/* Expand/collapse chevron */}
            {isContainer ? (
              <ActionIcon
                size={16}
                variant="transparent"
                color="gray"
                aria-label={isExpanded ? labels.collapse : labels.expand}
                onClick={(e) => toggleExpand(instance.props.instanceId, e)}
                style={{ flexShrink: 0 }}
              >
                {isExpanded ? (
                  <IconChevronDown size={12} />
                ) : (
                  <IconChevronRight size={12} />
                )}
              </ActionIcon>
            ) : (
              <span style={{ width: 16, flexShrink: 0 }} />
            )}

            {/* Component name */}
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </span>

            {/* Row actions */}
            <span
              className="tree-node-actions"
              style={{ display: "flex", gap: 0, flexShrink: 0 }}
            >
              <Tooltip label={labels.moveOut} openDelay={600}>
                <ActionIcon
                  size={16}
                  variant="transparent"
                  color="gray"
                  aria-label={labels.moveOut}
                  disabled={!canMoveOut}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveOut(instance.props.instanceId);
                  }}
                >
                  <IconArrowNarrowLeft size={11} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={labels.moveUp} openDelay={600}>
                <ActionIcon
                  size={16}
                  variant="transparent"
                  color="gray"
                  aria-label={labels.moveUp}
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(instance.props.instanceId, "up");
                  }}
                >
                  <IconArrowUp size={11} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={labels.moveDown} openDelay={600}>
                <ActionIcon
                  size={16}
                  variant="transparent"
                  color="gray"
                  aria-label={labels.moveDown}
                  disabled={index === siblingCount - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMove(instance.props.instanceId, "down");
                  }}
                >
                  <IconArrowDown size={11} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={labels.moveInto} openDelay={600}>
                <ActionIcon
                  size={16}
                  variant="transparent"
                  color="gray"
                  aria-label={labels.moveInto}
                  disabled={!canMoveInto}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveInto(instance.props.instanceId);
                  }}
                >
                  <IconArrowNarrowRight size={11} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={labels.duplicate} openDelay={600}>
                <ActionIcon
                  size={16}
                  variant="transparent"
                  color="gray"
                  aria-label={labels.duplicate}
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateNode(instance.props.instanceId);
                  }}
                >
                  <IconCopy size={11} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={labels.delete} openDelay={600}>
                <ActionIcon
                  size={16}
                  variant="transparent"
                  color="red"
                  aria-label={labels.delete}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(instance.props.instanceId);
                  }}
                >
                  <IconTrash size={11} />
                </ActionIcon>
              </Tooltip>
            </span>
          </div>
        </TreeRowDroppable>

        {/* Children */}
        {isContainer && isExpanded && childFields && (
          <>
            {hasMultipleFields
              ? childFields.map((fieldName) => {
                  const children: Instance[] =
                    instance.props[fieldName] || [];
                  return (
                    <div key={fieldName}>
                      <Text
                        size="xs"
                        c="dimmed"
                        style={{
                          paddingLeft: (depth + 1) * 14 + 20,
                          paddingTop: 2,
                          paddingBottom: 1,
                          fontSize: 10,
                          fontStyle: "italic",
                        }}
                      >
                        {fieldName}
                      </Text>
                      {children.map((child, i) =>
                        renderNode(child, depth + 2, i, children)
                      )}
                    </div>
                  );
                })
              : (instance.props[childFields[0]] || []).map(
                  (child: Instance, i: number, arr: Instance[]) =>
                    renderNode(child, depth + 1, i, arr)
                )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <style>{`
        .tree-node .tree-node-actions { opacity: 0; transition: opacity 0.1s; }
        .tree-node:hover .tree-node-actions { opacity: 1; }
      `}</style>

      {/* Header: append a component to the page root. */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          padding: "2px 4px",
          flexShrink: 0,
        }}
      >
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          leftSection={<IconPlus size={12} />}
          onClick={() => openPicker(null)}
          data-testid="tree-add-root"
        >
          {labels.addComponent}
        </Button>
      </div>

      <ScrollArea style={{ flex: 1, minHeight: 0 }} px={4} py={4}>
        {currentPage.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="md">
            {labels.emptyTree}
          </Text>
        ) : (
          currentPage.map((instance, i) =>
            renderNode(instance, 0, i, currentPage)
          )
        )}
      </ScrollArea>

      {/* Right-click context menu (insert / duplicate / delete). */}
      <Menu
        opened={contextMenu != null}
        onClose={() => setContextMenu(null)}
        position="bottom-start"
        withinPortal
        shadow="md"
      >
        <Menu.Target>
          <div
            style={{
              position: "fixed",
              left: contextMenu?.x ?? -9999,
              top: contextMenu?.y ?? -9999,
              width: 1,
              height: 1,
            }}
          />
        </Menu.Target>
        <Menu.Dropdown data-testid="tree-context-menu">
          <Menu.Item
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (contextMenu) openPicker(contextMenu.instanceId);
              setContextMenu(null);
            }}
          >
            {labels.insertComponent}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconCopy size={14} />}
            onClick={() => {
              if (contextMenu) duplicateNode(contextMenu.instanceId);
              setContextMenu(null);
            }}
          >
            {labels.duplicate}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={() => {
              if (contextMenu) deleteNode(contextMenu.instanceId);
              setContextMenu(null);
            }}
          >
            {labels.delete}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <ComponentPickerModal
        opened={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={insertComponent}
        targetInstanceId={pickerTarget}
      />
    </div>
  );
}

export default ComponentTree;
