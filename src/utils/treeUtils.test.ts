import { describe, it, expect } from "vitest";
import {
  findParent,
  findAndReplaceNode,
  findNode,
  removeNode,
  moveInstance,
  addItemToParent,
  countNodes,
  ROOT_PARENT_ID,
} from "./treeUtils";
import type { Instance } from "../registry/types";

// Helper to create a leaf instance
const leaf = (id: string | number, componentId = "Leaf"): Instance => ({
  id: componentId,
  props: { instanceId: id },
});

// Helper to create a container instance
const container = (
  id: string | number,
  children: Instance[],
  componentId = "Container"
): Instance => ({
  id: componentId,
  props: { instanceId: id, children },
});

// Mimic the hasChildren / getChildren helpers used in the editor.
// These test helpers assume components use a single "children" field, which is
// the common case for leaf/container components in these tests.
const hasChildren = (instance: Instance) =>
  Array.isArray(instance.props.children);

const getChildren = (instance: Instance): string[] | null =>
  Array.isArray(instance.props.children) ? ["children"] : null;

// ---------------------------------------------------------------------------
// Logic extracted from ComponentTree.moveInstanceOut / moveInstanceInto
// so we can unit-test it without React.
// ---------------------------------------------------------------------------

function moveOut(
  tree: Instance[],
  instanceId: string | number
): Instance[] {
  const parentResult = findParent(tree, instanceId, hasChildren, getChildren);
  if (!parentResult || !parentResult.node) return tree;

  const { node: parent, field } = parentResult;
  if (!field) return tree;

  const siblings: Instance[] = parent.props[field] || [];
  const instance = siblings.find((c) => c.props.instanceId === instanceId);
  if (!instance) return tree;

  const newSiblings = siblings.filter((c) => c.props.instanceId !== instanceId);
  const updatedParent: Instance = {
    ...parent,
    props: { ...parent.props, [field]: newSiblings },
  };

  const grandparentResult = findParent(
    tree,
    parent.props.instanceId,
    hasChildren,
    getChildren
  );

  if (!grandparentResult || !grandparentResult.node) {
    // Parent is root-level — insert instance right after parent
    const parentIndex = tree.findIndex(
      (c) => c.props.instanceId === parent.props.instanceId
    );
    const step1 = findAndReplaceNode(
      tree,
      parent.props.instanceId,
      updatedParent,
      hasChildren,
      getChildren
    );
    const result = [...step1];
    result.splice(parentIndex + 1, 0, instance);
    return result;
  } else {
    const { node: grandparent, field: grandparentField } = grandparentResult;
    if (!grandparentField) return tree;
    const parentIndex = (grandparent.props[grandparentField] || []).findIndex(
      (c: Instance) => c.props.instanceId === parent.props.instanceId
    );

    const step1 = findAndReplaceNode(
      tree,
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
  }
}

function moveInto(
  tree: Instance[],
  instanceId: string | number,
  siblings: Instance[]
): Instance[] {
  const index = siblings.findIndex((c) => c.props.instanceId === instanceId);
  if (index <= 0) return tree;

  const prevSibling = siblings[index - 1];
  if (!hasChildren(prevSibling)) return tree;

  const childFields = getChildren(prevSibling);
  if (!childFields || childFields.length === 0) return tree;
  const targetField = childFields[0];

  const instance = siblings[index];
  const updatedPrevSibling: Instance = {
    ...prevSibling,
    props: {
      ...prevSibling.props,
      [targetField]: [...(prevSibling.props[targetField] || []), instance],
    },
  };

  const newSiblings = siblings
    .filter((c) => c.props.instanceId !== instanceId)
    .map((c) =>
      c.props.instanceId === prevSibling.props.instanceId
        ? updatedPrevSibling
        : c
    );

  const parentResult = findParent(tree, instanceId, hasChildren, getChildren);

  if (!parentResult || !parentResult.node) {
    return newSiblings;
  } else {
    const { node: parent, field } = parentResult;
    if (!field) return tree;
    const updatedParent: Instance = {
      ...parent,
      props: { ...parent.props, [field]: newSiblings },
    };
    return findAndReplaceNode(
      tree,
      parent.props.instanceId,
      updatedParent,
      hasChildren,
      getChildren
    );
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("moveOut (move child out of parent)", () => {
  it("moves a nested child to root level, placed after its former parent", () => {
    //  tree: [Container(id=1, children=[A, B, C])]
    const a = leaf("a");
    const b = leaf("b");
    const c = leaf("c");
    const root = container(1, [a, b, c]);
    const tree: Instance[] = [root];

    const result = moveOut(tree, "b");

    // Root now has 2 items: Container and B
    expect(result).toHaveLength(2);
    expect(result[0].props.instanceId).toBe(1);
    expect(result[1].props.instanceId).toBe("b");

    // Container should now only have A and C
    const updated = result[0];
    expect(updated.props.children).toHaveLength(2);
    expect(updated.props.children[0].props.instanceId).toBe("a");
    expect(updated.props.children[1].props.instanceId).toBe("c");
  });

  it("inserts the moved node after its former parent at root level", () => {
    const a = leaf("a");
    const cont = container(1, [a]);
    const x = leaf("x");
    const tree: Instance[] = [cont, x];

    const result = moveOut(tree, "a");

    expect(result).toHaveLength(3);
    expect(result[0].props.instanceId).toBe(1); // container
    expect(result[1].props.instanceId).toBe("a"); // moved node
    expect(result[2].props.instanceId).toBe("x");
  });

  it("moves a deeply nested child up one level (not all the way to root)", () => {
    // tree: [OuterContainer(id=outer, children=[InnerContainer(id=inner, children=[A])])]
    const a = leaf("a");
    const inner = container("inner", [a]);
    const outer = container("outer", [inner]);
    const tree: Instance[] = [outer];

    const result = moveOut(tree, "a");

    // Outer container's children should now be [inner, a]
    expect(result).toHaveLength(1);
    const outerUpdated = result[0];
    expect(outerUpdated.props.children).toHaveLength(2);
    expect(outerUpdated.props.children[0].props.instanceId).toBe("inner");
    expect(outerUpdated.props.children[1].props.instanceId).toBe("a");
    // Inner container should be empty
    expect(outerUpdated.props.children[0].props.children).toHaveLength(0);
  });

  it("does nothing for a root-level node (no parent)", () => {
    const a = leaf("a");
    const b = leaf("b");
    const tree: Instance[] = [a, b];

    const result = moveOut(tree, "a");
    expect(result).toEqual(tree);
  });
});

describe("moveInto (move node into previous sibling container)", () => {
  it("moves a root-level node into the previous sibling container", () => {
    // tree: [Container(id=1, children=[X]), B]
    const x = leaf("x");
    const cont = container(1, [x]);
    const b = leaf("b");
    const tree: Instance[] = [cont, b];

    const result = moveInto(tree, "b", tree);

    // Root should now just be [Container] with B as last child
    expect(result).toHaveLength(1);
    const updatedCont = result[0];
    expect(updatedCont.props.children).toHaveLength(2);
    expect(updatedCont.props.children[0].props.instanceId).toBe("x");
    expect(updatedCont.props.children[1].props.instanceId).toBe("b");
  });

  it("moves a nested node into the previous sibling container within the same parent", () => {
    // tree: [Outer(children=[Inner(children=[X]), B])]
    const x = leaf("x");
    const inner = container("inner", [x]);
    const b = leaf("b");
    const outer = container("outer", [inner, b]);
    const tree: Instance[] = [outer];

    const outerChildren = outer.props.children as Instance[];
    const result = moveInto(tree, "b", outerChildren);

    expect(result).toHaveLength(1);
    const outerUpdated = result[0];
    expect(outerUpdated.props.children).toHaveLength(1); // only inner left
    const innerUpdated = outerUpdated.props.children[0];
    expect(innerUpdated.props.children).toHaveLength(2);
    expect(innerUpdated.props.children[1].props.instanceId).toBe("b");
  });

  it("does nothing if there is no previous sibling", () => {
    const a = leaf("a");
    const tree: Instance[] = [a];

    const result = moveInto(tree, "a", tree);
    expect(result).toEqual(tree);
  });

  it("does nothing if previous sibling is not a container", () => {
    const a = leaf("a");
    const b = leaf("b");
    const tree: Instance[] = [a, b];

    const result = moveInto(tree, "b", tree);
    expect(result).toEqual(tree);
  });
});

// ---------------------------------------------------------------------------
// Sanity check for the treeUtils used by the new callbacks
// ---------------------------------------------------------------------------

describe("findNode", () => {
  it("finds a node at any depth", () => {
    const a = leaf("a");
    const inner = container("inner", [a]);
    const tree = [inner];
    expect(findNode(tree, "a", hasChildren, getChildren)).toBe(a);
  });
});

describe("removeNode", () => {
  it("removes a node from the tree", () => {
    const a = leaf("a");
    const b = leaf("b");
    const tree = [a, b];
    const result = removeNode(tree, "a", hasChildren, getChildren);
    expect(result).toHaveLength(1);
    expect(result![0].props.instanceId).toBe("b");
  });
});

// ---------------------------------------------------------------------------
// moveInstance — drag-and-drop move semantics
// ---------------------------------------------------------------------------

const ids = (nodes: Instance[]) => nodes.map((n) => n.props.instanceId);

describe("moveInstance", () => {
  describe("same-parent moves honor the drop indicator", () => {
    // These document the fix over the old arrayMove-based editor logic, which
    // ignored above/below inside the same container.

    it("moves a node down, 'above' the target", () => {
      const tree = [container(1, [leaf("a"), leaf("b"), leaf("c"), leaf("d")])];
      const result = moveInstance(tree, "a", "c", "above", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["b", "a", "c", "d"]);
    });

    it("moves a node down, 'below' the target", () => {
      const tree = [container(1, [leaf("a"), leaf("b"), leaf("c"), leaf("d")])];
      const result = moveInstance(tree, "a", "c", "below", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["b", "c", "a", "d"]);
    });

    it("moves a node down to the LAST position (old To-Do bug)", () => {
      const tree = [container(1, [leaf("a"), leaf("b"), leaf("c")])];
      const result = moveInstance(tree, "a", "c", "below", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["b", "c", "a"]);
    });

    it("moves a node up, 'above' the target", () => {
      const tree = [container(1, [leaf("a"), leaf("b"), leaf("c"), leaf("d")])];
      const result = moveInstance(tree, "c", "a", "above", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["c", "a", "b", "d"]);
    });

    it("moves a node up, 'below' the target", () => {
      const tree = [container(1, [leaf("a"), leaf("b"), leaf("c"), leaf("d")])];
      const result = moveInstance(tree, "c", "a", "below", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["a", "c", "b", "d"]);
    });
  });

  describe("cross-parent moves", () => {
    it("moves a leaf from one container above a leaf in another", () => {
      const tree = [
        container("c1", [leaf("a"), leaf("b")]),
        container("c2", [leaf("x"), leaf("y")]),
      ];
      const result = moveInstance(tree, "a", "y", "above", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["b"]);
      expect(ids(result![1].props.children)).toEqual(["x", "a", "y"]);
    });

    it("reorders top-level containers via above/below on a container", () => {
      const tree = [
        container("c1", [leaf("a")]),
        container("c2", [leaf("b")]),
        container("c3", [leaf("c")]),
      ];
      // above/below on a container reorders it as a sibling — but at the top
      // level there is no parent container, so the move is rejected (null).
      // (Top-level reordering is only defined when sections share a parent.)
      const nested = [container("page", tree)];
      const result = moveInstance(nested, "c3", "c1", "above", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["c3", "c1", "c2"]);
    });
  });

  describe("'into' a container APPENDS (fixed splice(-1) quirk)", () => {
    it("appends to the end of a non-empty container", () => {
      // Old behavior: splice(-1) inserted before the last child.
      const tree = [container("c1", [leaf("x"), leaf("y")]), leaf("b")];
      const result = moveInstance(tree, "b", "c1", "into", hasChildren, getChildren);
      expect(ids(result!)).toEqual(["c1"]);
      expect(ids(result![0].props.children)).toEqual(["x", "y", "b"]);
    });

    it("moves into an empty container", () => {
      const tree = [container("c1", []), leaf("b")];
      const result = moveInstance(tree, "b", "c1", "into", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["b"]);
    });

    it("appends when moving within the same container via 'into'", () => {
      const tree = [container("c1", [leaf("a"), leaf("b"), leaf("c")])];
      const result = moveInstance(tree, "a", "c1", "into", hasChildren, getChildren);
      expect(ids(result![0].props.children)).toEqual(["b", "c", "a"]);
    });

    it("respects a specialized child field via fieldName", () => {
      const twoField: Instance = {
        id: "Split",
        props: { instanceId: "split", left: [leaf("l1")], right: [leaf("r1")] },
      };
      const tree: Instance[] = [twoField, leaf("b")];
      const has = (i: Instance) =>
        Array.isArray(i.props.left) ||
        Array.isArray(i.props.right) ||
        Array.isArray(i.props.children);
      const get = (i: Instance): string[] | null => {
        const fields = ["left", "right", "children"].filter((f) =>
          Array.isArray(i.props[f])
        );
        return fields.length ? fields : null;
      };
      const result = moveInstance(tree, "b", "split", "into", has, get, "right");
      expect(ids(result![0].props.left)).toEqual(["l1"]);
      expect(ids(result![0].props.right)).toEqual(["r1", "b"]);
    });
  });

  describe("invalid moves return null", () => {
    it("rejects dropping a node onto itself", () => {
      const tree = [container(1, [leaf("a"), leaf("b")])];
      expect(moveInstance(tree, "a", "a", "below", hasChildren, getChildren)).toBeNull();
    });

    it("rejects dropping a container onto its own descendant", () => {
      const tree = [container("outer", [container("inner", [leaf("a")])])];
      expect(
        moveInstance(tree, "outer", "a", "above", hasChildren, getChildren)
      ).toBeNull();
      expect(
        moveInstance(tree, "outer", "inner", "into", hasChildren, getChildren)
      ).toBeNull();
    });

    it("rejects missing active or target nodes", () => {
      const tree = [container(1, [leaf("a")])];
      expect(moveInstance(tree, "ghost", "a", "above", hasChildren, getChildren)).toBeNull();
      expect(moveInstance(tree, "a", "ghost", "above", hasChildren, getChildren)).toBeNull();
    });

    it("rejects sibling moves relative to a top-level node (no parent to splice into)", () => {
      const tree = [container("c1", [leaf("a")]), leaf("b")];
      expect(moveInstance(tree, "a", "b", "above", hasChildren, getChildren)).toBeNull();
    });
  });

  describe("invariants", () => {
    it("keeps the node count constant across a move", () => {
      const tree = [
        container("c1", [leaf("a"), container("c2", [leaf("b")])]),
        container("c3", [leaf("c")]),
      ];
      const before = countNodes(tree, hasChildren, getChildren);
      const result = moveInstance(tree, "a", "c", "below", hasChildren, getChildren);
      expect(result).not.toBeNull();
      expect(countNodes(result!, hasChildren, getChildren)).toBe(before);
    });

    it("does not mutate the input tree", () => {
      const tree = [container("c1", [leaf("a"), leaf("b")]), container("c2", [leaf("x")])];
      const snapshot = JSON.parse(JSON.stringify(tree));
      moveInstance(tree, "a", "x", "below", hasChildren, getChildren);
      moveInstance(tree, "a", "c2", "into", hasChildren, getChildren);
      moveInstance(tree, "b", "a", "above", hasChildren, getChildren);
      expect(tree).toEqual(snapshot);
    });
  });
});

// ---------------------------------------------------------------------------
// addItemToParent — root addressing contract
// ---------------------------------------------------------------------------

describe("addItemToParent root contract", () => {
  it("appends as a top-level node when parentId is ROOT_PARENT_ID", () => {
    const tree = [container("c1", [leaf("a")])];
    const result = addItemToParent(tree, ROOT_PARENT_ID, leaf("new"), hasChildren, getChildren);
    expect(ids(result)).toEqual(["c1", "new"]);
  });

  it("the 'root' sentinel wins over any node lookup (ids must not be 'root')", () => {
    // Documents why instance ids must never be the literal string "root":
    // the sentinel is matched before any lookup, so such a node could never
    // be addressed as a parent.
    const tree = [container("root", [leaf("a")])];
    const result = addItemToParent(tree, "root", leaf("new"), hasChildren, getChildren);
    expect(ids(result)).toEqual(["root", "new"]);
    expect(ids(result[0].props.children)).toEqual(["a"]);
  });

  it("appends to the first child field of a nested parent", () => {
    const tree = [container("c1", [container("c2", [leaf("a")])])];
    const result = addItemToParent(tree, "c2", leaf("new"), hasChildren, getChildren);
    expect(ids(result[0].props.children[0].props.children)).toEqual(["a", "new"]);
  });

  it("returns the tree unchanged for an unknown parent", () => {
    const tree = [container("c1", [leaf("a")])];
    const result = addItemToParent(tree, "ghost", leaf("new"), hasChildren, getChildren);
    expect(result).toEqual(tree);
  });
});
