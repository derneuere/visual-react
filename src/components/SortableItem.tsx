import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { useEditor } from "../editor/hooks";
import { useComponentRegistry } from "../registry/hooks";
import { Instance } from "../registry/types";
import { useStaticMode } from "../static/hooks";
import {
  IconCopy,
  IconClipboard,
  IconCopyPlus,
  IconGripVertical,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import "./SortableItem.css";

export interface SortableItemProps {
  id: string | number;
  instance: Instance;
  children: React.ReactNode;
  notEditable?: boolean;
}

const DndSortableItem: React.FC<SortableItemProps> = ({
  id,
  instance,
  children,
  notEditable,
}) => {
  const { listeners, setNodeRef, attributes, setActivatorNodeRef, isDragging } =
    useSortable({
      id,
      data: { instanceId: id },
      animateLayoutChanges: () => false,
    });

  const {
    selectedInstanceId,
    setSelectedInstanceId,
    setModalOpen,
    setIsAbove,
    draggedInstanceId,
    clipboard,
    setClipboard,
  } = useEditor();

  const {
    deleteNode,
    duplicateNode,
    pasteNode,
    validateInstance,
  } = useComponentRegistry();

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseOver = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHovered(true);
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsHovered(false);
  };

  const openModal = (e: React.MouseEvent, isAbove: boolean) => {
    e.stopPropagation();
    setModalOpen(true);
    setSelectedInstanceId(id);
    setIsAbove(isAbove);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInstanceId(id);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedInstanceId(id);
  };

  const deleteNodeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNode(id);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setClipboard(instance);
  };

  const handlePaste = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!clipboard) return;
    pasteNode(clipboard, id, "below");
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateNode(id);
  };

  const isBeingDragged = isDragging || draggedInstanceId === id;
  const { dropTarget } = useEditor();
  const isDropTarget = dropTarget?.id === id;
  const dropPosition = dropTarget?.position;

  // Validation badge
  const validationResults = validateInstance(id);
  const errorCount = validationResults.filter((v) => v.severity === "error").length;

  const isSelected = selectedInstanceId === id && !notEditable;
  const showControls = (isHovered || isSelected) && !notEditable && !isBeingDragged;
  const showHover = isHovered && !isSelected && !notEditable && !isBeingDragged;

  return (
    <article
      ref={setNodeRef}
      data-testid={`sortable-item-${id}`}
      className={`sortable-item ${isBeingDragged ? "dragging" : ""} ${
        isDropTarget ? `drop-target drop-${dropPosition}` : ""
      } ${showHover ? "hovered" : ""} ${isSelected ? "selected" : ""}`}
      onMouseOver={notEditable ? undefined : handleMouseOver}
      onMouseOut={notEditable ? undefined : handleMouseOut}
      onClick={notEditable ? undefined : handleClick}
      {...attributes}
    >
      {showControls && (
        <div className="control-panel">
          <span className="instance-id">
            {instance.id}
            {errorCount > 0 && (
              <span className="validation-badge">{errorCount}</span>
            )}
          </span>
          <div className="actions">
            <button
              onClick={handleCopy}
              data-testid="copy-button"
              aria-label="Copy widget"
              className="action-button"
              title="Copy"
            >
              <IconCopy size={14} />
            </button>
            {clipboard && (
              <button
                onClick={handlePaste}
                data-testid="paste-button"
                aria-label="Paste widget"
                className="action-button"
                title="Paste"
              >
                <IconClipboard size={14} />
              </button>
            )}
            <button
              onClick={handleDuplicate}
              data-testid="duplicate-button"
              aria-label="Duplicate widget"
              className="action-button"
              title="Duplicate"
            >
              <IconCopyPlus size={14} />
            </button>
            <span
              ref={setActivatorNodeRef}
              {...listeners}
              data-testid="drag-handle"
              role="button"
              aria-label="Drag to reorder"
              className="drag-handle"
            >
              <IconGripVertical size={14} />
            </span>
            <button
              onClick={handleEditClick}
              data-testid="edit-button"
              aria-label="Edit item"
              className="edit-button"
            >
              <IconPencil size={14} />
            </button>
            <button
              onClick={deleteNodeClick}
              data-testid="delete-button"
              aria-label="Delete item"
              className="delete-button"
            >
              <IconTrash size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Plus buttons for adding above or below */}
      {showControls && (
        <>
          <button
            onClick={(e) => openModal(e, true)}
            data-testid="add-above-button"
            className="add-button add-above"
          >
            +
          </button>
          <button
            onClick={(e) => openModal(e, false)}
            data-testid="add-below-button"
            className="add-button add-below"
          >
            +
          </button>
        </>
      )}

      {children}
    </article>
  );
};

export const SortableItem: React.FC<SortableItemProps> = (props) => {
  const isStatic = useStaticMode();
  if (isStatic) return <div>{props.children}</div>;
  return <DndSortableItem {...props} />;
};
