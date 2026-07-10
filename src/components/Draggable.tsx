import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface DraggableProps {
  id: string;
  add: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Draggable: React.FC<DraggableProps> = ({
  id,
  add,
  children,
  style,
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { add },
  });

  const defaultStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    padding: "16px",
    margin: "8px",
    backgroundColor: "#bfdbfe",
    borderRadius: "4px",
    cursor: "grab",
    userSelect: "none",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        ...defaultStyle,
        ...style,
      }}
    >
      {children || id}
    </div>
  );
};
