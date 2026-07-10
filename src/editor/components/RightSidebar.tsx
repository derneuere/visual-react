// RightSidebar — selection breadcrumb + property panel for the selected
// instance (0.4.0). Shows the page-settings panel (TreeFileHandler) when
// Navigation opened it, and an empty-state hint when nothing is selected.
import { Stack, Text } from "@mantine/core";
import { IconClick } from "@tabler/icons-react";
import { useEditor } from "../hooks";
import { Breadcrumb } from "./Breadcrumb";
import PropertyPanel from "./PropertyPanel";
import TreeFileHandler from "./TreeFileHandler";
import { useEditorLabels } from "../labels";

const RightSidebar = () => {
  const { selectedInstanceId, pageSettingsOpen } = useEditor();
  const labels = useEditorLabels();

  return (
    <div
      className="vr-chrome"
      style={{
        width: "320px",
        overflowY: "auto",
        height: "100%",
        borderLeft: "1px solid #e2e8f0",
        flexShrink: 0,
      }}
    >
      <Stack gap="xs" p="xs">
        {selectedInstanceId != null ? (
          <>
            <Breadcrumb />
            <PropertyPanel />
          </>
        ) : pageSettingsOpen ? (
          <TreeFileHandler />
        ) : (
          <Stack align="center" gap={6} py="xl" px="md">
            <IconClick size={28} style={{ color: "#adb5bd" }} />
            <Text size="sm" fw={500} c="dimmed" ta="center">
              {labels.noSelection}
            </Text>
            <Text size="xs" c="dimmed" ta="center">
              {labels.noSelectionHint}
            </Text>
          </Stack>
        )}
      </Stack>
    </div>
  );
};

export default RightSidebar;
