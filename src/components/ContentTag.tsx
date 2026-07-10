import React, { useCallback, useRef, useState } from "react";
import { useStaticMode } from "../static/hooks";
import { useEditor } from "../editor/hooks";
import { useComponentRegistry } from "../registry/hooks";

export interface ContentTagProps {
  instanceId: string | number;
  field: string;
  element?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function ContentTag({
  instanceId,
  field,
  element = "div",
  className,
  style,
  children,
}: ContentTagProps) {
  const isStatic = useStaticMode();
  const { isPreview } = useEditor();
  const {
    updateInstanceProps,
    getComponentProps,
    findInstance,
  } = useComponentRegistry();

  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef<HTMLElement>(null);

  const instance = findInstance(instanceId);
  const metadata = instance ? getComponentProps(instance.id) : null;
  const fieldType = metadata?.editableProps?.[field];
  const value = instance?.props?.[field] ?? "";

  const isEditable = !isStatic && !isPreview;
  const isHtmlField = fieldType === "text";

  const handleBlur = useCallback(() => {
    if (!ref.current || !instance) return;

    const newValue = isHtmlField
      ? ref.current.innerHTML
      : ref.current.textContent || "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateInstanceProps(instanceId, { [field]: newValue } as any);
  }, [instanceId, field, isHtmlField, instance, updateInstanceProps]);

  const editableStyle: React.CSSProperties = isEditable
    ? {
        outline: isHovered ? "2px dashed #93c5fd" : "none",
        outlineOffset: 2,
        minHeight: "1em",
        cursor: "text",
        ...style,
      }
    : { ...style };

  if (!isEditable) {
    if (isHtmlField) {
      return React.createElement(element, {
        className,
        style,
        dangerouslySetInnerHTML: { __html: value },
      });
    }
    return React.createElement(element, { className, style }, children ?? value);
  }

  if (isHtmlField) {
    return React.createElement(element, {
      ref,
      className,
      style: editableStyle,
      contentEditable: true,
      suppressContentEditableWarning: true,
      dangerouslySetInnerHTML: { __html: value },
      onBlur: handleBlur,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
    });
  }

  return React.createElement(
    element,
    {
      ref,
      className,
      style: editableStyle,
      contentEditable: true,
      suppressContentEditableWarning: true,
      onBlur: handleBlur,
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
    },
    children ?? value
  );
}
