import { useState } from "react";
import EditingTab from "./EditingTab";
import {ComponentExplorer} from "./ComponentExplorer";
import TreeFileHandler from "./TreeFileHandler";
import { useEditor } from "../hooks";
import { Stack, Button, Card, Text } from "@mantine/core";
import { IconCategoryPlus, IconArrowsMaximize } from "@tabler/icons-react";
import { Breadcrumb } from "./Breadcrumb";

const RightSidebar = () => {
  const { selectedInstanceId, setSelectedInstanceId, editModalOpen, setEditModalOpen, pageSettingsOpen, setPageSettingsOpen } = useEditor();

  const [showComponents, setShowComponents] = useState(false);

  return (
    <div className="vr-chrome" style={{ width: "320px", overflowY: "auto", height: "100%", borderLeft: "1px solid #e2e8f0" }}>
      <Stack gap="xs" p="xs">
        <Card shadow="sm" padding="sm" withBorder>
          <Button
            leftSection={<IconCategoryPlus size={14} />}
            variant="default"
            size="sm"
            fullWidth
            onClick={() => {
              setShowComponents(true);
              setSelectedInstanceId(null);
              setPageSettingsOpen(false);
            }}
          >
            Add Component
          </Button>
        </Card>
        {selectedInstanceId && !editModalOpen && (
          <>
            <Breadcrumb />
            <EditingTab />
          </>
        )}
        {selectedInstanceId && editModalOpen && (
          <Card shadow="sm" padding="md" withBorder>
            <Stack gap="sm" align="center">
              <Text size="sm" c="dimmed" ta="center">
                Editing in expanded view
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconArrowsMaximize size={14} />}
                onClick={() => setEditModalOpen(false)}
              >
                Back to sidebar
              </Button>
            </Stack>
          </Card>
        )}
        {!selectedInstanceId && pageSettingsOpen && <TreeFileHandler />}
        {!selectedInstanceId && !pageSettingsOpen && showComponents && (
          <ComponentExplorer />
        )}
      </Stack>
    </div>
  );
};

export default RightSidebar;
