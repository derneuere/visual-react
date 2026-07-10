// ComponentPalette — the draggable component palette of the canvas-only
// editor (0.4.0). Every registered component (grouped by metadata.category)
// renders as a usePaletteDraggable entry: the hook guarantees the
// { source: "palette", widgetKey } drag-data contract that useEditorDnd's
// palette-add branch resolves, so dragging an entry onto the canvas iframe
// (or a layer-tree row) inserts a new instance at the indicator position.
import React from "react";
import { Text } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { useComponentRegistry } from "../../registry/hooks";
import { usePaletteDraggable } from "../../headless/dnd";

interface PaletteItemProps {
  widgetKey: string;
  name: string;
}

function PaletteItem({ widgetKey, name }: PaletteItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } =
    usePaletteDraggable(widgetKey);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`palette-${widgetKey}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        border: "1px solid var(--mantine-color-gray-3)",
        borderRadius: 6,
        background: "#fff",
        fontSize: 13,
        fontWeight: 500,
        cursor: "grab",
        userSelect: "none",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <IconGripVertical size={14} style={{ color: "#adb5bd", flexShrink: 0 }} />
    </div>
  );
}

export function ComponentPalette() {
  const { getAllRegisteredComponents, getComponentProps } =
    useComponentRegistry();

  // Group by metadata.category (same grouping as the picker modal).
  const groups = React.useMemo(() => {
    const map = new Map<string, Array<{ key: string; name: string }>>();
    for (const id of getAllRegisteredComponents()) {
      const meta = getComponentProps(id);
      const category = meta?.category || "Other";
      const entry = { key: id, name: meta?.name || id };
      const bucket = map.get(category);
      if (bucket) bucket.push(entry);
      else map.set(category, [entry]);
    }
    return Array.from(map.entries());
    // The registry context recreates its getters per render; the component
    // list itself only changes when components register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAllRegisteredComponents().join("|")]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 8 }}>
      {groups.map(([category, items]) => (
        <div
          key={category}
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ fontSize: 10 }}>
            {category}
          </Text>
          {items.map((item) => (
            <PaletteItem key={item.key} widgetKey={item.key} name={item.name} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default ComponentPalette;
