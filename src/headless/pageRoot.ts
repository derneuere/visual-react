// pageRoot — the transient page-root wrapper for custom editors.
//
// Problem it formalizes: treeUtils' {@link ROOT_PARENT_ID} ("root") sentinel
// addresses the TOP LEVEL of the tree, and several helpers special-case
// root-level nodes (e.g. addItemRelativeToNode is a no-op for targets
// without a parent). A canvas-style editor wants ONE uniform container
// semantics instead: wrap the flat page content in a single transient root
// instance, edit inside it, and unwrap before persisting. Every node then
// has a parent, so all tree utils take their normal container paths, and
// "append to the page" is just addItemToParent(tree, PAGE_ROOT_INSTANCE_ID, …).
//
// The root instance id is deliberately NOT "root": addItemToParent matches
// parentId === ROOT_PARENT_ID before any node lookup, so a root instance
// with that id could never be addressed as a parent — new items would land
// as top-level SIBLINGS of the wrapper, outside the content that
// unwrapPageRoot returns.
//
// The registry must know the wrapper is a container: register
// {@link pageRootMetadata} under {@link PAGE_ROOT_COMPONENT_ID} in the
// editor's (metadata-only) registry so hasChildren/getChildren descend into
// its children.

import type { ComponentMetadata, Instance } from "../registry/types";

/** Component id of the transient page-root wrapper instance. */
export const PAGE_ROOT_COMPONENT_ID = "__root__";

/** Default instance id of the transient page-root wrapper. */
export const PAGE_ROOT_INSTANCE_ID = "__page_root__";

/**
 * Metadata for the page-root wrapper. Register it in the editor registry
 * under {@link PAGE_ROOT_COMPONENT_ID} (it never appears in a palette):
 *
 *   const registry = { ...widgets, [PAGE_ROOT_COMPONENT_ID]: { metadata: pageRootMetadata } };
 */
export const pageRootMetadata: ComponentMetadata = {
  name: "Page",
  description: "Transient root container of the page.",
  defaultProps: {
    children: [],
  },
  editableProps: {
    children: { type: "componentlist" },
  },
};

/** True when `instance` is a page-root wrapper created by createPageRoot. */
export const isPageRoot = (instance: Instance | null | undefined): boolean =>
  !!instance && instance.id === PAGE_ROOT_COMPONENT_ID;

/**
 * Wrap flat page content in a single transient root instance. The result is
 * what you hand to `setPage` / `setCurrentPage`:
 *
 *   setPage({ meta, content: createPageRoot(page.content) });
 *
 * `rootInstanceId` defaults to {@link PAGE_ROOT_INSTANCE_ID}; it must never
 * be the literal string "root" (see module docs / ROOT_PARENT_ID).
 */
export function createPageRoot(
  content: Instance[],
  rootInstanceId: number | string = PAGE_ROOT_INSTANCE_ID
): Instance[] {
  if (rootInstanceId === "root") {
    throw new Error(
      'createPageRoot: rootInstanceId must not be "root" — treeUtils.addItemToParent reserves that sentinel for the tree top level (ROOT_PARENT_ID), so the wrapper could never be addressed as a parent.'
    );
  }
  return [
    {
      id: PAGE_ROOT_COMPONENT_ID,
      props: { instanceId: rootInstanceId, children: content },
    },
  ];
}

/**
 * Extract the flat page content back out of a wrapped tree (what you
 * persist). Trees that are not wrapped (first node is not a page root) are
 * returned as-is, so the function is safe to call on either shape.
 */
export function unwrapPageRoot(tree: Instance[]): Instance[] {
  const root = tree[0];
  if (!isPageRoot(root)) return tree;
  const children = root.props.children;
  return Array.isArray(children) ? (children as Instance[]) : [];
}
