import { describe, it, expect } from "vitest";
import {
  findNode,
  removeNode,
  moveInstance,
  moveInstanceUp,
  moveInstanceDown,
  moveInstanceOut,
  moveInstanceInto,
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

const ids2 = (nodes: Instance[]) => nodes.map((n) => n.props.instanceId);

// ---------------------------------------------------------------------------
// moveInstanceUp / moveInstanceDown — sibling reorder helpers
// ---------------------------------------------------------------------------

describe("moveInstanceUp / moveInstanceDown", () => {
  it("moves a nested node up within its siblings", () => {
    const tree = [container(1, [leaf("a"), leaf("b"), leaf("c")])];
    const result = moveInstanceUp(tree, "b", hasChildren, getChildren);
    expect(ids2(result![0].props.children)).toEqual(["b", "a", "c"]);
  });

  it("moves a nested node down within its siblings", () => {
    const tree = [container(1, [leaf("a"), leaf("b"), leaf("c")])];
    const result = moveInstanceDown(tree, "b", hasChildren, getChildren);
    expect(ids2(result![0].props.children)).toEqual(["a", "c", "b"]);
  });

  it("moves a root-level node up / down within the top level", () => {
    const tree = [leaf("a"), leaf("b"), leaf("c")];
    expect(ids2(moveInstanceUp(tree, "b", hasChildren, getChildren)!)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(
      ids2(moveInstanceDown(tree, "b", hasChildren, getChildren)!)
    ).toEqual(["a", "c", "b"]);
  });

  it("returns null at the top edge (already first)", () => {
    const tree = [container(1, [leaf("a"), leaf("b")])];
    expect(moveInstanceUp(tree, "a", hasChildren, getChildren)).toBeNull();
    expect(moveInstanceUp([leaf("a"), leaf("b")], "a", hasChildren, getChildren)).toBeNull();
  });

  it("returns null at the bottom edge (already last)", () => {
    const tree = [container(1, [leaf("a"), leaf("b")])];
    expect(moveInstanceDown(tree, "b", hasChildren, getChildren)).toBeNull();
    expect(moveInstanceDown([leaf("a"), leaf("b")], "b", hasChildren, getChildren)).toBeNull();
  });

  it("returns null for a missing node", () => {
    const tree = [container(1, [leaf("a")])];
    expect(moveInstanceUp(tree, "ghost", hasChildren, getChildren)).toBeNull();
    expect(moveInstanceDown(tree, "ghost", hasChildren, getChildren)).toBeNull();
  });

  it("does not mutate the input tree", () => {
    const tree = [container(1, [leaf("a"), leaf("b"), leaf("c")])];
    const snapshot = JSON.parse(JSON.stringify(tree));
    moveInstanceUp(tree, "b", hasChildren, getChildren);
    moveInstanceDown(tree, "b", hasChildren, getChildren);
    expect(tree).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// moveInstanceOut — move child out of its parent container
// ---------------------------------------------------------------------------

describe("moveInstanceOut (move child out of parent)", () => {
  it("moves a nested child to root level, placed after its former parent", () => {
    //  tree: [Container(id=1, children=[A, B, C])]
    const a = leaf("a");
    const b = leaf("b");
    const c = leaf("c");
    const root = container(1, [a, b, c]);
    const tree: Instance[] = [root];

    const result = moveInstanceOut(tree, "b", hasChildren, getChildren)!;

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

    const result = moveInstanceOut(tree, "a", hasChildren, getChildren)!;

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

    const result = moveInstanceOut(tree, "a", hasChildren, getChildren)!;

    // Outer container's children should now be [inner, a]
    expect(result).toHaveLength(1);
    const outerUpdated = result[0];
    expect(outerUpdated.props.children).toHaveLength(2);
    expect(outerUpdated.props.children[0].props.instanceId).toBe("inner");
    expect(outerUpdated.props.children[1].props.instanceId).toBe("a");
    // Inner container should be empty
    expect(outerUpdated.props.children[0].props.children).toHaveLength(0);
  });

  it("returns null for a root-level node (no parent)", () => {
    const a = leaf("a");
    const b = leaf("b");
    const tree: Instance[] = [a, b];

    expect(moveInstanceOut(tree, "a", hasChildren, getChildren)).toBeNull();
  });

  it("returns null for a missing node", () => {
    const tree = [container(1, [leaf("a")])];
    expect(moveInstanceOut(tree, "ghost", hasChildren, getChildren)).toBeNull();
  });

  it("does not mutate the input tree", () => {
    const tree = [container("outer", [container("inner", [leaf("a")])])];
    const snapshot = JSON.parse(JSON.stringify(tree));
    moveInstanceOut(tree, "a", hasChildren, getChildren);
    expect(tree).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// moveInstanceInto — move node into its previous sibling container
// ---------------------------------------------------------------------------

describe("moveInstanceInto (move node into previous sibling container)", () => {
  it("moves a root-level node into the previous sibling container", () => {
    // tree: [Container(id=1, children=[X]), B]
    const x = leaf("x");
    const cont = container(1, [x]);
    const b = leaf("b");
    const tree: Instance[] = [cont, b];

    const result = moveInstanceInto(tree, "b", hasChildren, getChildren)!;

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

    const result = moveInstanceInto(tree, "b", hasChildren, getChildren)!;

    expect(result).toHaveLength(1);
    const outerUpdated = result[0];
    expect(outerUpdated.props.children).toHaveLength(1); // only inner left
    const innerUpdated = outerUpdated.props.children[0];
    expect(innerUpdated.props.children).toHaveLength(2);
    expect(innerUpdated.props.children[1].props.instanceId).toBe("b");
  });

  it("returns null if there is no previous sibling", () => {
    const a = leaf("a");
    const tree: Instance[] = [a];

    expect(moveInstanceInto(tree, "a", hasChildren, getChildren)).toBeNull();
  });

  it("returns null if the previous sibling is not a container", () => {
    const a = leaf("a");
    const b = leaf("b");
    const tree: Instance[] = [a, b];

    expect(moveInstanceInto(tree, "b", hasChildren, getChildren)).toBeNull();
  });

  it("returns null for a missing node", () => {
    const tree = [container(1, [leaf("a")]), leaf("b")];
    expect(moveInstanceInto(tree, "ghost", hasChildren, getChildren)).toBeNull();
  });

  it("does not mutate the input tree", () => {
    const tree = [container(1, [leaf("x")]), leaf("b")];
    const snapshot = JSON.parse(JSON.stringify(tree));
    moveInstanceInto(tree, "b", hasChildren, getChildren);
    expect(tree).toEqual(snapshot);
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
