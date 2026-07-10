import { Instance } from "../registry/types";
import type { DropPosition } from "./dropPosition";

/**
 * Sentinel parent id addressing the top level of the tree in
 * {@link addItemToParent}. Because it is matched before any node lookup,
 * instance ids must never be the literal string "root" — such a node could
 * never be addressed as a parent.
 */
export const ROOT_PARENT_ID = "root";

let cloneCounter = 0;
const generateUniqueId = () => Date.now() + ++cloneCounter;

export const deepCloneInstance = (
  instance: Instance,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): Instance => {
  const cloned: Instance = {
    id: instance.id,
    props: { ...instance.props, instanceId: generateUniqueId() },
  };

  if (hasChildren(instance)) {
    const childFields = getChildren(instance);
    if (childFields) {
      for (const field of childFields) {
        const children = instance.props[field];
        if (Array.isArray(children)) {
          cloned.props[field] = children.map((child: Instance) =>
            deepCloneInstance(child, hasChildren, getChildren)
          );
        }
      }
    }
  }

  return cloned;
};

export const countNodes = (
  tree: Instance[],
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): number => {
  if (!tree || tree.length === 0) return 0;

  return tree.reduce((count, node) => {
    let childrenCount = 0;

    if (hasChildren(node)) {
      const childrenFieldNames = getChildren(node);
      if (childrenFieldNames) {
        childrenCount = childrenFieldNames.reduce((fieldCount, fieldName) => {
          const childNodes = node.props[fieldName];
          return (
            fieldCount +
            (childNodes ? countNodes(childNodes, hasChildren, getChildren) : 0)
          );
        }, 0);
      }
    }

    return count + 1 + childrenCount; // 1 for the current node + count of its children
  }, 0);
};

export const findParent = (
  nodes: Instance[],
  targetId: number | string,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): { node: Instance | null; field: string | null } | null => {
  if (!targetId) return null;

  for (const node of nodes) {
    if (hasChildren(node)) {
      const childrenFieldNames = getChildren(node);
      if (!childrenFieldNames) continue;

      for (const fieldName of childrenFieldNames) {
        const childNodes = node.props[fieldName];
        if (!childNodes) continue;
        if (
          childNodes.some(
            (child: Instance) => child.props.instanceId === targetId
          )
        ) {
          return { node: node, field: fieldName };
        }
        // recursively check deeper children
        const result = findParent(
          childNodes,
          targetId,
          hasChildren,
          getChildren
        );
        if (result) return result;
      }
    }
  }
  return null;
};

export const isDescendent = (
  tree: Instance[],
  ancestorId: number | string,
  descendantId: number | string,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): boolean => {
  if (!tree || !ancestorId || !descendantId) return false;

  for (const node of tree) {
    if (node.props.instanceId === ancestorId) {
      // Check if the descendant exists in this node's subtree
      const descendant = findNode(
        [node],
        descendantId,
        hasChildren,
        getChildren
      );
      return !!descendant;
    }

    if (hasChildren(node)) {
      const childrenFieldNames = getChildren(node);
      if (childrenFieldNames) {
        for (const fieldName of childrenFieldNames) {
          const childNodes = node.props[fieldName];
          if (childNodes) {
            const isDescendantInSubtree = isDescendent(
              childNodes,
              ancestorId,
              descendantId,
              hasChildren,
              getChildren
            );
            if (isDescendantInSubtree) return true;
          }
        }
      }
    }
  }

  return false;
};

export const findNode = (
  nodes: Instance[],
  targetId: number | string | null,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): Instance | null => {
  if (!targetId) return null;

  for (const node of nodes) {
    if (node.props.instanceId === targetId) return node;

    if (hasChildren(node)) {
      const childrenFieldNames = getChildren(node);
      if (childrenFieldNames) {
        for (const fieldName of childrenFieldNames) {
          const childNodes = node.props[fieldName];
          if (childNodes) {
            const result = findNode(
              childNodes,
              targetId,
              hasChildren,
              getChildren
            );
            if (result) return result;
          }
        }
      }
    }
  }

  return null;
};

export const removeNode = (
  tree: Instance[],
  instanceId: number | string,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): Instance[] | null => {
  if (!tree) return null;

  return tree
    .map((node) => {
      if (node.props.instanceId === instanceId) {
        return null; // remove the node
      }
      if (hasChildren(node)) {
        const childrenFieldNames = getChildren(node);
        if (childrenFieldNames) {
          const updatedChildren = childrenFieldNames.reduce(
            (acc, fieldName) => {
              return {
                ...acc,
                [fieldName]:
                  removeNode(
                    node.props[fieldName],
                    instanceId,
                    hasChildren,
                    getChildren
                  ) || [],
              };
            },
            {}
          );

          return {
            ...node,
            props: {
              ...node.props,
              ...updatedChildren,
            },
          };
        }
      }
      return node;
    })
    .filter(Boolean) as Instance[]; // filter out null nodes
};

export const findAndReplaceNode = (
  tree: Instance[],
  targetId: number | string,
  newNode: Instance,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): Instance[] => {
  if (!tree) return [];

  return tree.map((node) => {
    if (node.props.instanceId === targetId) {
      return newNode; // replace the target node
    }

    if (hasChildren(node)) {
      const childrenFieldNames = getChildren(node);
      if (childrenFieldNames) {
        const updatedChildren = childrenFieldNames.reduce((acc, fieldName) => {
          const childNodes = node.props[fieldName];
          return {
            ...acc,
            [fieldName]: childNodes
              ? findAndReplaceNode(
                  childNodes,
                  targetId,
                  newNode,
                  hasChildren,
                  getChildren
                )
              : childNodes,
          };
        }, {});

        return {
          ...node,
          props: {
            ...node.props,
            ...updatedChildren,
          },
        };
      }
    }

    return node;
  });
};

/**
 * Append `newItem` to a parent's first child field.
 *
 * Root contract: passing {@link ROOT_PARENT_ID} ("root") as `parentId`
 * appends `newItem` as a new top-level node of the tree. This sentinel is
 * checked BEFORE any node lookup, so it always addresses the tree's top
 * level — never an instance whose id happens to be "root" (instance ids must
 * not use that value, see {@link ROOT_PARENT_ID}).
 */
export const addItemToParent = (
  tree: Instance[],
  parentId: number | string,
  newItem: Instance,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): Instance[] => {
  if (parentId === ROOT_PARENT_ID) {
    return [...tree, newItem];
  }

  const parent = findNode(tree, parentId, hasChildren, getChildren);
  if (!parent) return tree;

  const childrenFields = getChildren(parent);
  if (!childrenFields || childrenFields.length === 0) return tree;

  // Use the first child field by default
  const targetField = childrenFields[0];

  return tree.map((node) => {
    if (node.props.instanceId === parentId) {
      return {
        ...node,
        props: {
          ...node.props,
          [targetField]: [...(node.props[targetField] || []), newItem],
        },
      };
    }

    if (hasChildren(node)) {
      const childrenFieldNames = getChildren(node);
      if (childrenFieldNames) {
        const updatedChildren = childrenFieldNames.reduce((acc, fieldName) => {
          const childNodes = node.props[fieldName];
          return {
            ...acc,
            [fieldName]: childNodes
              ? addItemToParent(
                  childNodes,
                  parentId,
                  newItem,
                  hasChildren,
                  getChildren
                )
              : childNodes,
          };
        }, {});

        return {
          ...node,
          props: {
            ...node.props,
            ...updatedChildren,
          },
        };
      }
    }

    return node;
  });
};

/**
 * Move an existing instance relative to another (the editor's drag semantics:
 * above/below reorder as siblings — also on containers —, "into" nests).
 * Serves the dnd-kit path (Editor.handleDragEnd) and any custom drag surface
 * (e.g. an iframe-canvas drop handler).
 *
 * `fieldName` is the container child field a drop zone represents; the
 * generic "children" default resolves to the container's first child field.
 *
 * Same-parent and cross-parent moves insert identically: the node is removed
 * first, then spliced into the post-removal sibling list at the indicator
 * slot (above = before the target, below = after), so the drop always lands
 * where the indicator promised regardless of drag direction. "into" a
 * container APPENDS to the end of the container's child field.
 *
 * Returns the new tree, or null when the move is a no-op/invalid (missing
 * nodes, self-drop, drop onto a descendant, unresolvable insert parent).
 * The input tree is never mutated.
 */
export const moveInstance = (
  tree: Instance[],
  activeInstanceId: number | string,
  targetInstanceId: number | string,
  position: DropPosition,
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null,
  fieldName?: string | null
): Instance[] | null => {
  const activeNode = findNode(tree, activeInstanceId, hasChildren, getChildren);
  const overNode = findNode(tree, targetInstanceId, hasChildren, getChildren);

  // No-op if either node is missing, dropping onto itself, or onto a descendant.
  if (
    !activeNode ||
    !overNode ||
    activeNode.props.instanceId === overNode.props.instanceId ||
    isDescendent(
      tree,
      activeNode.props.instanceId,
      overNode.props.instanceId,
      hasChildren,
      getChildren
    )
  ) {
    return null;
  }

  // Remove the dragged node from its current position.
  const updatedTree = removeNode(
    tree,
    activeNode.props.instanceId,
    hasChildren,
    getChildren
  );
  if (!updatedTree) return null;

  // Resolve the parent to insert under:
  //   above/below on a container -> that container's parent (reorder siblings)
  //   into a container            -> the container itself
  //   non-container               -> its parent
  const insertAsSibling =
    hasChildren(overNode) && (position === "above" || position === "below");
  const insertIntoContainer = hasChildren(overNode) && !insertAsSibling;

  const overNodeInUpdatedTree = findNode(
    updatedTree,
    overNode.props.instanceId,
    hasChildren,
    getChildren
  );

  const overParentResult = !insertIntoContainer
    ? findParent(
        updatedTree,
        overNode.props.instanceId,
        hasChildren,
        getChildren
      )
    : overNodeInUpdatedTree
      ? {
          node: overNodeInUpdatedTree,
          field: fieldName || getChildren(overNodeInUpdatedTree)?.[0] || null,
        }
      : null;
  const overParent = overParentResult?.node;

  // Insert-parent resolvability in the PRE-removal tree (mirrors the resolve
  // above; guards against drops whose target parent only exists post-removal).
  const prevOverParentResult = !insertIntoContainer
    ? findParent(tree, overNode.props.instanceId, hasChildren, getChildren)
    : {
        node: overNode,
        field: fieldName || getChildren(overNode)?.[0] || null,
      };
  const prevOverParent = prevOverParentResult?.node;

  if (!overParent || !overParentResult?.field) return null;

  const overParentChildren = overParent.props[overParentResult.field];
  if (!overParentChildren) return null;

  if (
    !prevOverParent ||
    !prevOverParentResult?.field ||
    !hasChildren(overParent) ||
    !hasChildren(prevOverParent)
  ) {
    return null;
  }

  // overParent lives in updatedTree (removeNode rebuilds every container and
  // child array), so mutating its child field never touches the input tree.
  const newChildren = [...overParentChildren];

  if (insertIntoContainer) {
    // "into" a container: APPEND to the end of its child field. (Previously
    // the target was looked up among its own children, yielding index -1 and
    // a splice(-1) that inserted before the last child.)
    newChildren.push(activeNode);
  } else {
    let overIndex = newChildren.findIndex(
      (child: Instance) => child.props.instanceId === overNode.props.instanceId
    );
    if (overIndex < 0) return null;
    if (position === "below") {
      overIndex = overIndex + 1;
    }
    newChildren.splice(overIndex, 0, activeNode);
  }

  overParent.props[overParentResult.field] = newChildren;

  // Sanity check: node count must be invariant across the move.
  if (
    countNodes(updatedTree, hasChildren, getChildren) !==
    countNodes(tree, hasChildren, getChildren)
  ) {
    console.error("Tree structure is invalid after move");
    return null;
  }

  return findAndReplaceNode(
    updatedTree,
    overParent.props.instanceId,
    overParent,
    hasChildren,
    getChildren
  );
};

export const addItemRelativeToNode = (
  tree: Instance[],
  targetId: number | string,
  newItem: Instance,
  position: "above" | "below",
  hasChildren: (instance: Instance) => boolean,
  getChildren: (instance: Instance) => string[] | null
): Instance[] => {
  const parentInfo = findParent(tree, targetId, hasChildren, getChildren);
  if (!parentInfo || !parentInfo.node) return tree;

  const parent = parentInfo.node;
  const field = parentInfo.field;

  if (!field || !parent.props[field]) return tree;

  const children = [...parent.props[field]];
  const index = children.findIndex(
    (child) => child.props.instanceId === targetId
  );
  if (index === -1) return tree;

  const insertIndex = position === "above" ? index : index + 1;
  children.splice(insertIndex, 0, newItem);

  return findAndReplaceNode(
    tree,
    parent.props.instanceId,
    {
      ...parent,
      props: {
        ...parent.props,
        [field]: children,
      },
    },
    hasChildren,
    getChildren
  );
};