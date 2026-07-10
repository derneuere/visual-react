import { useMemo } from "react";
import type { Instance } from "../registry/types";
import { useComponentRegistry } from "../registry/hooks";
import { findNode, findParent } from "../utils/treeUtils";

/**
 * Ancestry of an instance, root-first and ending with the instance itself —
 * ready for a breadcrumb:
 *
 *   const path = useInstancePath(selectedInstanceId);
 *   path.map((node) => <Crumb key={node.props.instanceId} instance={node} />);
 *
 * Returns [] when `instanceId` is null or not in the current page.
 */
export function useInstancePath(
  instanceId: number | string | null
): Instance[] {
  const { currentPage, hasChildren, getChildren } = useComponentRegistry();

  return useMemo(() => {
    if (instanceId == null) return [];

    const node = findNode(currentPage, instanceId, hasChildren, getChildren);
    if (!node) return [];

    const path: Instance[] = [node];
    let currentId: number | string | null = instanceId;
    while (currentId != null) {
      const parentResult = findParent(
        currentPage,
        currentId,
        hasChildren,
        getChildren
      );
      if (!parentResult?.node) break;
      path.unshift(parentResult.node);
      currentId = parentResult.node.props.instanceId;
    }
    return path;
    // hasChildren/getChildren are recreated per provider render but only
    // depend on the registry; currentPage + instanceId drive the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, currentPage]);
}
