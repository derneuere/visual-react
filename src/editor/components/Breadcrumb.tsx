import React, { useMemo } from "react";
import { useEditor } from "../hooks";
import { useComponentRegistry } from "../../registry/hooks";
import { findNode, findParent } from "../../utils/treeUtils";
import { Instance } from "../../registry/types";
import { IconChevronRight } from "@tabler/icons-react";

export function Breadcrumb() {
  const { selectedInstanceId, setSelectedInstanceId } = useEditor();
  const { currentPage, hasChildren, getChildren, getComponentProps } =
    useComponentRegistry();

  const path = useMemo(() => {
    if (!selectedInstanceId) return [];

    const result: Instance[] = [];
    let currentId: number | string | null = selectedInstanceId;

    // Add the selected node itself
    const selectedNode = findNode(currentPage, currentId, hasChildren, getChildren);
    if (selectedNode) result.unshift(selectedNode);

    // Walk up parents
    while (currentId) {
      const parentResult = findParent(currentPage, currentId, hasChildren, getChildren);
      if (!parentResult?.node) break;
      result.unshift(parentResult.node);
      currentId = parentResult.node.props.instanceId;
    }

    return result;
  }, [selectedInstanceId, currentPage, hasChildren, getChildren]);

  if (!selectedInstanceId || path.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 2,
        padding: "4px 8px",
        fontSize: 12,
        color: "#64748b",
        background: "#f8fafc",
        borderRadius: 6,
        minHeight: 28,
      }}
    >
      {path.map((node, index) => {
        const meta = getComponentProps(node.id);
        const name = meta?.name || node.id;
        const isLast = index === path.length - 1;

        return (
          <React.Fragment key={node.props.instanceId}>
            {index > 0 && (
              <IconChevronRight size={10} style={{ color: "#cbd5e1", flexShrink: 0 }} />
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setSelectedInstanceId(node.props.instanceId);
              }}
              style={{
                cursor: "pointer",
                fontWeight: isLast ? 600 : 400,
                color: isLast ? "#1e293b" : "#64748b",
                borderRadius: 3,
                padding: "1px 4px",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "#e2e8f0";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              {name}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
