import { Modal, Text } from "@mantine/core";
import { useEditor } from "../hooks";
import EditingTab from "./EditingTab";
import { Breadcrumb } from "./Breadcrumb";

export function EditComponentModal() {
  const { editModalOpen, setEditModalOpen, selectedInstanceId } = useEditor();

  return (
    <Modal
      opened={editModalOpen && !!selectedInstanceId}
      onClose={() => setEditModalOpen(false)}
      title={
        <Text size="lg" fw={700} c="dark">
          Edit Component
        </Text>
      }
      size="xl"
    >
      <Breadcrumb />
      <div style={{ marginTop: 12 }}>
        <EditingTab inModal />
      </div>
    </Modal>
  );
}
