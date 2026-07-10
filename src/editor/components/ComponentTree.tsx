import React, { useState, useCallback, useEffect } from "react";
import { ScrollArea, Text, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconChevronRight,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconArrowNarrowLeft,
  IconArrowNarrowRight,
} from "@tabler/icons-react";
import { useEditor } from "../hooks";
import { useComponentRegistry } from "../../registry/hooks";
import {
  moveInstanceUp,
  moveInstanceDown,
  moveInstanceOut,
  moveInstanceInto,
} from "../../utils/treeUtils";
import type { Instance } from "../../registry/types";

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

function ComponentTree() {
  const { selectedInstanceId, setSelectedInstanceId } = useEditor();
  const {
    currentPage,
    setCurrentPage,
    hasChildren,
    getChildren,
    getComponentProps,
    pagePath,
  } = useComponentRegistry();

  const [expandedNodes, setExpandedNodes] = useState<Set<string | number>>(
    () => collectContainerIds(currentPage, hasChildren, getChildren)
  );

  // Reset expansion when page changes
  useEffect(() => {
    setExpandedNodes(collectContainerIds(currentPage, hasChildren, getChildren));
  }, [pagePath]);

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

  // Move a node out of its parent container: remove from parent, insert after parent
  const handleMoveOut = useCallback(
    (instanceId: string | number) => {
      setCurrentPage(
        (prev) =>
          moveInstanceOut(prev, instanceId, hasChildren, getChildren) ?? prev
      );
    },
    [setCurrentPage, hasChildren, getChildren]
  );

  // Move a node into the previous sibling container (as its last child)
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
        <div
          className="tree-node"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedInstanceId(instance.props.instanceId);
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
              (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f5f9";
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

          {/* Move buttons */}
          <span
            className="tree-node-actions"
            style={{ display: "flex", gap: 0, flexShrink: 0 }}
          >
            <Tooltip label="Move out of parent" openDelay={600}>
              <ActionIcon
                size={16}
                variant="transparent"
                color="gray"
                disabled={!canMoveOut}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveOut(instance.props.instanceId);
                }}
              >
                <IconArrowNarrowLeft size={11} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Move up" openDelay={600}>
              <ActionIcon
                size={16}
                variant="transparent"
                color="gray"
                disabled={index === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMove(instance.props.instanceId, "up");
                }}
              >
                <IconArrowUp size={11} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Move down" openDelay={600}>
              <ActionIcon
                size={16}
                variant="transparent"
                color="gray"
                disabled={index === siblingCount - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMove(instance.props.instanceId, "down");
                }}
              >
                <IconArrowDown size={11} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Move into previous sibling" openDelay={600}>
              <ActionIcon
                size={16}
                variant="transparent"
                color="gray"
                disabled={!canMoveInto}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveInto(instance.props.instanceId);
                }}
              >
                <IconArrowNarrowRight size={11} />
              </ActionIcon>
            </Tooltip>
          </span>
        </div>

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
    <ScrollArea style={{ height: "100%" }} px={4} py={4}>
      <style>{`
        .tree-node .tree-node-actions { opacity: 0; transition: opacity 0.1s; }
        .tree-node:hover .tree-node-actions { opacity: 1; }
      `}</style>
      {currentPage.length === 0 ? (
        <Text size="xs" c="dimmed" ta="center" py="md">
          No components on this page
        </Text>
      ) : (
        currentPage.map((instance, i) =>
          renderNode(instance, 0, i, currentPage)
        )
      )}
    </ScrollArea>
  );
}

export default ComponentTree;
