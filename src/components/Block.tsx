import React from "react";
import { UniqueIdentifier, useDroppable } from "@dnd-kit/core";
import { ComponentRenderer } from "./ComponentRenderer";

import { useComponentRegistry } from "../registry";
import { Instance } from "../registry/types";
import { findNode } from "../utils";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEditor } from "../editor/hooks";
import { useStaticMode } from "../static/hooks";

interface BlockProps {
  items: Instance[];
  parentId: string;
  itemsField?: string;
  style?: any;
}

const StaticBlock = ({ items, style }: BlockProps) => {
  return (
    <div style={{ minHeight: 50, ...style }}>
      <ComponentRenderer items={items} notEditable />
    </div>
  );
};

const DndBlock = ({
  items,
  parentId,
  itemsField,
  style,
}: BlockProps) => {
  const droppableId = itemsField ? parentId + itemsField : parentId;
  const fieldName = itemsField ? itemsField : "children";

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      instanceId: parentId,
      fieldName,
    },
  });

  const { currentPage, hasChildren, getChildren } = useComponentRegistry();

  const { draggedInstanceId, isPreview, dropTarget, setDropTarget } =
    useEditor();

  const isDragDisabled =
    draggedInstanceId === parentId ||
    !!findNode(
      findNode(currentPage, draggedInstanceId, hasChildren, getChildren)?.props
        .children ?? [],
      parentId,
      hasChildren,
      getChildren
    );

  // Update drop target state when hovering over this container's droppable zone.
  // Only set "into" if updateDropTargetIndicator hasn't already targeted this element
  // (e.g. with above/below for section reordering). This prevents the Block from
  // overriding the above/below position that enables section reordering.
  React.useEffect(() => {
    if (isOver && draggedInstanceId) {
      // Only set "into" if this element isn't already targeted by drag indicator
      if (dropTarget?.id !== parentId || dropTarget?.fieldName !== fieldName) {
        setDropTarget({
          id: parentId,
          fieldName,
          position: "into",
        });
      }
    } else if (
      !isOver &&
      dropTarget?.id === parentId &&
      dropTarget?.fieldName === fieldName
    ) {
      setDropTarget(null);
    }
  }, [
    isOver,
    draggedInstanceId,
    parentId,
    fieldName,
    setDropTarget,
    dropTarget,
  ]);

  // Check if this dropzone is the current drop target
  const isDropTarget =
    dropTarget?.id === parentId && dropTarget?.fieldName === fieldName;

  // Check if this container is the current drop target with 'into' position
  const isIntoTarget = isDropTarget && dropTarget?.position === "into";

  return (
    <div
      ref={setNodeRef}
      style={{
        outline: "none",
        backgroundColor: isIntoTarget
          ? "rgba(34, 197, 94, 0.05)"
          : "transparent",
        minHeight: 50,
        ...style,
      }}
    >
      <SortableContext
        id={parentId.toString()}
        items={items.map(
          (item: Instance) => item.props.instanceId as UniqueIdentifier
        )}
        strategy={verticalListSortingStrategy}
      >
        <ComponentRenderer
          items={items}
          notEditable={isPreview || isDragDisabled}
        />
      </SortableContext>
    </div>
  );
};

export const Block = (props: BlockProps) => {
  const isStatic = useStaticMode();
  if (isStatic) return <StaticBlock {...props} />;
  return <DndBlock {...props} />;
};

export default Block;
