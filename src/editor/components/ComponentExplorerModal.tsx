import React, { useState, useMemo } from "react";
import { Modal, Button, Text, Stack, TextInput } from "@mantine/core";
import { addItemRelativeToNode, findParent } from "../../utils/treeUtils";

import { useComponentRegistry } from "../../registry/hooks";
import { useEditor } from "../hooks";

export const ComponentExplorerModal: React.FC = () => {
  const {
    currentPage,
    getAllRegisteredComponents,
    getComponentProps,
    setCurrentPage,
    hasChildren,
    getChildren,
    getFieldRestrictions,
  } = useComponentRegistry();

  const allComponents = getAllRegisteredComponents();

  const { isModalOpen, setModalOpen, isAbove, selectedInstanceId } = useEditor();
  const [search, setSearch] = useState("");

  // Determine the target container and field to apply restrictions
  const filteredComponents = useMemo(() => {
    let components = allComponents;

    // Apply widget restrictions if we have a selected instance
    if (selectedInstanceId) {
      const parentInfo = findParent(
        currentPage,
        selectedInstanceId,
        hasChildren,
        getChildren
      );

      if (parentInfo?.node && parentInfo.field) {
        // Check `only` restrictions on the target field
        const restrictions = getFieldRestrictions(
          parentInfo.node.id,
          parentInfo.field
        );
        if (restrictions) {
          components = components.filter((id) => restrictions.includes(id));
        }
      }

      // Filter by `onlyInside` restrictions on each component
      components = components.filter((id) => {
        const meta = getComponentProps(id);
        if (!meta?.onlyInside) return true;
        // Check if the target container matches any allowed parent
        if (parentInfo?.node) {
          return meta.onlyInside.includes(parentInfo.node.id);
        }
        return true;
      });
    }

    // Apply search filter
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
  }, [allComponents, selectedInstanceId, search, currentPage]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const id of filteredComponents) {
      const meta = getComponentProps(id);
      const category = meta?.category || "Other";
      if (!groups[category]) groups[category] = [];
      groups[category].push(id);
    }
    return groups;
  }, [filteredComponents]);

  const handleAdd = (id: string) => {
    if (selectedInstanceId == null) return;
    const defaultProps = getComponentProps(id);
    const newItem = {
      id: id,
      props: {
        ...defaultProps?.defaultProps,
        instanceId: crypto.randomUUID(),
      },
    };

    const newTree = addItemRelativeToNode(
      currentPage,
      selectedInstanceId,
      newItem,
      isAbove ? "above" : "below",
      hasChildren,
      getChildren
    );
    setCurrentPage(newTree);
    setModalOpen(false);
    setSearch("");
  };

  return (
    <Modal
      opened={isModalOpen}
      onClose={() => {
        setModalOpen(false);
        setSearch("");
      }}
      title={
        <Text size="lg" fw={700} c="dark">
          Components
        </Text>
      }
      size="lg"
    >
      <TextInput
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        mb="md"
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
                    style={{
                      padding: "12px",
                      backgroundColor: "#bfdbfe",
                      borderRadius: "8px",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    onClick={() => handleAdd(id)}
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
                          backgroundColor: "#93c5fd",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 20,
                          fontWeight: 700,
                          color: "#1e40af",
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
            No matching components found
          </Text>
        )}
      </Stack>

      <Button onClick={() => { setModalOpen(false); setSearch(""); }} mt="md">
        Close
      </Button>
    </Modal>
  );
};
