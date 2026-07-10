// ComponentPickerModal — searchable, category-grouped component picker
// (0.4.0). Replaces the old ComponentExplorerModal: instead of reading the
// SortableItem "+ above/below" state from the editor context, it is a
// controlled, target-agnostic picker — the caller decides where the chosen
// component is inserted via `onPick(widgetKey)`.
//
// When `targetInstanceId` is provided the list is narrowed by the target
// container's field restrictions (`only`) and each component's `onlyInside`
// metadata, mirroring the old modal's behavior for context-menu inserts.
import { useMemo, useState } from "react";
import { Modal, Text, Stack, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { useComponentRegistry } from "../../registry/hooks";
import { findNode, findParent } from "../../utils/treeUtils";
import { useEditorLabels } from "../labels";

export interface ComponentPickerModalProps {
  opened: boolean;
  onClose: () => void;
  /** The chosen component id; the caller inserts it and closes the modal. */
  onPick: (widgetKey: string) => void;
  /**
   * Node the insert is relative to (context-menu "insert"): restriction
   * filtering resolves against its parent container. null/undefined = append
   * to the page root, no restriction filtering.
   */
  targetInstanceId?: number | string | null;
}

export function ComponentPickerModal({
  opened,
  onClose,
  onPick,
  targetInstanceId,
}: ComponentPickerModalProps) {
  const {
    currentPage,
    getAllRegisteredComponents,
    getComponentProps,
    hasChildren,
    getChildren,
    getFieldRestrictions,
  } = useComponentRegistry();
  const labels = useEditorLabels();

  const [search, setSearch] = useState("");

  const filteredComponents = useMemo(() => {
    let components = getAllRegisteredComponents();

    if (targetInstanceId != null) {
      // The insert target: into the node itself when it is a container,
      // otherwise as a sibling inside its parent.
      const targetNode = findNode(
        currentPage,
        targetInstanceId,
        hasChildren,
        getChildren
      );
      const container =
        targetNode && hasChildren(targetNode)
          ? { node: targetNode, field: getChildren(targetNode)?.[0] ?? "children" }
          : (() => {
              const parentInfo = findParent(
                currentPage,
                targetInstanceId,
                hasChildren,
                getChildren
              );
              return parentInfo?.node
                ? { node: parentInfo.node, field: parentInfo.field ?? "children" }
                : null;
            })();

      if (container) {
        const restrictions = getFieldRestrictions(
          container.node.id,
          container.field
        );
        if (restrictions) {
          components = components.filter((id) => restrictions.includes(id));
        }
        components = components.filter((id) => {
          const meta = getComponentProps(id);
          if (!meta?.onlyInside) return true;
          return meta.onlyInside.includes(container.node.id);
        });
      }
    }

    if (search) {
      const lower = search.toLowerCase();
      components = components.filter((id) => {
        const meta = getComponentProps(id);
        return (
          id.toLowerCase().includes(lower) ||
          meta?.name?.toLowerCase().includes(lower) ||
          meta?.description?.toLowerCase().includes(lower) ||
          meta?.category?.toLowerCase().includes(lower)
        );
      });
    }

    return components;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, targetInstanceId, search, currentPage]);

  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const id of filteredComponents) {
      const meta = getComponentProps(id);
      const category = meta?.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(id);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredComponents]);

  const close = () => {
    onClose();
    setSearch("");
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={
        <Text size="lg" fw={700} c="dark">
          {labels.pickerTitle}
        </Text>
      }
      size="lg"
    >
      <TextInput
        placeholder={labels.pickerSearchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftSection={<IconSearch size={14} />}
        mb="md"
        data-autofocus
        data-testid="picker-search"
      />

      <Stack gap="md">
        {Object.entries(grouped).map(([category, ids]) => (
          <div key={category}>
            <Text size="sm" fw={600} c="dimmed" mb="xs">
              {category}
            </Text>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "8px",
              }}
            >
              {ids.map((id) => {
                const meta = getComponentProps(id);
                return (
                  <div
                    key={id}
                    data-testid={`picker-item-${id}`}
                    style={{
                      padding: "12px",
                      backgroundColor: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    onClick={() => {
                      onPick(id);
                      close();
                    }}
                  >
                    {meta?.thumbnail ? (
                      <img
                        src={meta.thumbnail}
                        alt={meta.name || id}
                        style={{
                          width: 48,
                          height: 48,
                          objectFit: "contain",
                          borderRadius: 4,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 4,
                          backgroundColor: "#cbd5e1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#334155",
                        }}
                      >
                        {(meta?.name || id).charAt(0)}
                      </div>
                    )}
                    <Text size="sm" fw={600} ta="center">
                      {meta?.name || id}
                    </Text>
                    {meta?.description && (
                      <Text size="xs" c="dimmed" ta="center" lineClamp={2}>
                        {meta.description}
                      </Text>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {filteredComponents.length === 0 && (
          <Text size="sm" c="dimmed" ta="center">
            {labels.pickerEmpty}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
