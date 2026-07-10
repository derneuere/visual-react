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
import { findParent, findAndReplaceNode, findNode } from "../../utils/treeUtils";
import { arrayMove } from "@dnd-kit/sortable";
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

  const moveInstance = useCallback(
    (instanceId: string | number, direction: "up" | "down") => {
      const parentResult = findParent(
        currentPage,
        instanceId,
        hasChildren,
        getChildren
      );

      if (!parentResult) {
        // Root-level instance
        const index = currentPage.findIndex(
          (c) => c.props.instanceId === instanceId
        );
        if (index < 0) return;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= currentPage.length) return;
        setCurrentPage((prev) => arrayMove([...prev], index, targetIndex));
      } else {
        const { node: parent, field } = parentResult;
        if (!parent || !field) return;
        const siblings: Instance[] = parent.props[field];
        if (!Array.isArray(siblings)) return;
        const index = siblings.findIndex(
          (c) => c.props.instanceId === instanceId
        );
        if (index < 0) return;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) return;

        const newSiblings = arrayMove([...siblings], index, targetIndex);
        const updatedParent: Instance = {
          ...parent,
          props: { ...parent.props, [field]: newSiblings },
        };
        setCurrentPage((prev) =>
          findAndReplaceNode(
            prev,
            parent.props.instanceId,
            updatedParent,
            hasChildren,
            getChildren
          )
        );
      }
    },
    [currentPage, setCurrentPage, hasChildren, getChildren]
  );

  // Move a node out of its parent container: remove from parent, insert after parent
  const moveInstanceOut = useCallback(
    (instanceId: string | number) => {
      const parentResult = findParent(
        currentPage,
        instanceId,
        hasChildren,
        getChildren
      );
      if (!parentResult || !parentResult.node) return; // Already at root

      const { node: parent, field } = parentResult;
      if (!field) return;

      const siblings: Instance[] = parent.props[field] || [];
      const instance = siblings.find(
        (c) => c.props.instanceId === instanceId
      );
      if (!instance) return;

      const newSiblings = siblings.filter(
        (c) => c.props.instanceId !== instanceId
      );
      const updatedParent: Instance = {
        ...parent,
        props: { ...parent.props, [field]: newSiblings },
      };

      const grandparentResult = findParent(
        currentPage,
        parent.props.instanceId,
        hasChildren,
        getChildren
      );

      if (!grandparentResult || !grandparentResult.node) {
        // Parent is at root level — insert instance right after parent
        const parentIndex = currentPage.findIndex(
          (c) => c.props.instanceId === parent.props.instanceId
        );
        setCurrentPage((prev) => {
          const step1 = findAndReplaceNode(
            prev,
            parent.props.instanceId,
            updatedParent,
            hasChildren,
            getChildren
          );
          const result = [...step1];
          result.splice(parentIndex + 1, 0, instance);
          return result;
        });
      } else {
        const { node: grandparent, field: grandparentField } =
          grandparentResult;
        if (!grandparentField) return;
        const parentIndex = (
          grandparent.props[grandparentField] || []
        ).findIndex(
          (c: Instance) => c.props.instanceId === parent.props.instanceId
        );

        setCurrentPage((prev) => {
          const step1 = findAndReplaceNode(
            prev,
            parent.props.instanceId,
            updatedParent,
            hasChildren,
            getChildren
          );
          const updatedGrandparent = findNode(
            step1,
            grandparent.props.instanceId,
            hasChildren,
            getChildren
          );
          if (!updatedGrandparent) return step1;
          const grandchildren = [
            ...(updatedGrandparent.props[grandparentField] || []),
          ];
          grandchildren.splice(parentIndex + 1, 0, instance);
          const newGrandparent: Instance = {
            ...updatedGrandparent,
            props: {
              ...updatedGrandparent.props,
              [grandparentField]: grandchildren,
            },
          };
          return findAndReplaceNode(
            step1,
            grandparent.props.instanceId,
            newGrandparent,
            hasChildren,
            getChildren
          );
        });
      }
    },
    [currentPage, setCurrentPage, hasChildren, getChildren]
  );

  // Move a node into the previous sibling container (as its last child)
  const moveInstanceInto = useCallback(
    (instanceId: string | number, siblings: Instance[]) => {
      const index = siblings.findIndex(
        (c) => c.props.instanceId === instanceId
      );
      if (index <= 0) return;

      const prevSibling = siblings[index - 1];
      if (!hasChildren(prevSibling)) return;

      const childFields = getChildren(prevSibling);
      if (!childFields || childFields.length === 0) return;
      const targetField = childFields[0];

      const instance = siblings[index];
      const updatedPrevSibling: Instance = {
        ...prevSibling,
        props: {
          ...prevSibling.props,
          [targetField]: [
            ...(prevSibling.props[targetField] || []),
            instance,
          ],
        },
      };

      const newSiblings = siblings
        .filter((c) => c.props.instanceId !== instanceId)
        .map((c) =>
          c.props.instanceId === prevSibling.props.instanceId
            ? updatedPrevSibling
            : c
        );

      const parentResult = findParent(
        currentPage,
        instanceId,
        hasChildren,
        getChildren
      );

      if (!parentResult || !parentResult.node) {
        // Root level
        setCurrentPage(newSiblings);
      } else {
        const { node: parent, field } = parentResult;
        if (!field) return;
        const updatedParent: Instance = {
          ...parent,
          props: { ...parent.props, [field]: newSiblings },
        };
        setCurrentPage((prev) =>
          findAndReplaceNode(
            prev,
            parent.props.instanceId,
            updatedParent,
            hasChildren,
            getChildren
          )
        );
      }
    },
    [currentPage, setCurrentPage, hasChildren, getChildren]
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
                  moveInstanceOut(instance.props.instanceId);
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
                  moveInstance(instance.props.instanceId, "up");
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
                  moveInstance(instance.props.instanceId, "down");
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
                  moveInstanceInto(instance.props.instanceId, siblings);
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
