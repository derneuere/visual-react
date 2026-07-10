import { describe, it, expect } from "vitest";
import type { Instance } from "../registry/types";
import {
  createPageRoot,
  isPageRoot,
  unwrapPageRoot,
  pageRootMetadata,
  PAGE_ROOT_COMPONENT_ID,
  PAGE_ROOT_INSTANCE_ID,
} from "./pageRoot";
import { addItemToParent } from "../utils/treeUtils";

const widget = (instanceId: string): Instance => ({
  id: "text",
  props: { instanceId },
});

// Minimal registry semantics: only the page root is a container.
const hasChildren = (i: Instance) => i.id === PAGE_ROOT_COMPONENT_ID;
const getChildren = (i: Instance) =>
  i.id === PAGE_ROOT_COMPONENT_ID ? ["children"] : null;

describe("createPageRoot", () => {
  it("wraps flat content in a single root instance", () => {
    const content = [widget("a"), widget("b")];
    const tree = createPageRoot(content);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(PAGE_ROOT_COMPONENT_ID);
    expect(tree[0].props.instanceId).toBe(PAGE_ROOT_INSTANCE_ID);
    expect(tree[0].props.children).toBe(content);
  });

  it("accepts a custom root instance id", () => {
    const tree = createPageRoot([], "my-root");
    expect(tree[0].props.instanceId).toBe("my-root");
  });

  it('rejects the reserved "root" sentinel (ROOT_PARENT_ID interplay)', () => {
    expect(() => createPageRoot([], "root")).toThrow(/root/);
  });

  it("produces a root addressable as addItemToParent target", () => {
    // The whole point of the wrapper: "append to the page" is a normal
    // container append, NOT the ROOT_PARENT_ID top-level special case.
    const tree = createPageRoot([widget("a")]);
    const next = addItemToParent(
      tree,
      PAGE_ROOT_INSTANCE_ID,
      widget("b"),
      hasChildren,
      getChildren
    );
    expect(next).toHaveLength(1); // still one top-level node
    expect(
      (next[0].props.children as Instance[]).map((c) => c.props.instanceId)
    ).toEqual(["a", "b"]);
  });
});

describe("unwrapPageRoot", () => {
  it("returns the root's children for a wrapped tree", () => {
    const content = [widget("a")];
    expect(unwrapPageRoot(createPageRoot(content))).toBe(content);
  });

  it("returns [] for a wrapped tree whose children are missing", () => {
    const tree: Instance[] = [
      { id: PAGE_ROOT_COMPONENT_ID, props: { instanceId: "x" } },
    ];
    expect(unwrapPageRoot(tree)).toEqual([]);
  });

  it("returns unwrapped trees as-is", () => {
    const tree = [widget("a"), widget("b")];
    expect(unwrapPageRoot(tree)).toBe(tree);
    expect(unwrapPageRoot([])).toEqual([]);
  });

  it("round-trips createPageRoot", () => {
    const content = [widget("a"), widget("b")];
    expect(unwrapPageRoot(createPageRoot(content))).toEqual(content);
  });
});

describe("isPageRoot / pageRootMetadata", () => {
  it("identifies page roots by component id", () => {
    expect(isPageRoot(createPageRoot([])[0])).toBe(true);
    expect(isPageRoot(widget("a"))).toBe(false);
    expect(isPageRoot(null)).toBe(false);
  });

  it("declares a componentlist children field (container detection)", () => {
    expect(pageRootMetadata.editableProps.children).toEqual({
      type: "componentlist",
    });
    expect(pageRootMetadata.defaultProps.children).toEqual([]);
  });
});
