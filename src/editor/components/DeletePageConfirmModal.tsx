import { useState } from "react";
import { Modal, Text, Button, Group, Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStorageAdapter } from "../../storage/hooks";

interface DeletePageConfirmModalProps {
  opened: boolean;
  onClose: () => void;
  pagePath: string | null;
  onNavigate: (pagePath: string) => void;
}

export function DeletePageConfirmModal({
  opened,
  onClose,
  pagePath,
  onNavigate,
}: DeletePageConfirmModalProps) {
  const storage = useStorageAdapter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!pagePath) return;

    setLoading(true);
    setError(null);

    try {
      await storage.deletePage(pagePath);
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      onNavigate("index");
      onClose();
    } catch (err) {
      setError("Failed to delete page. Please try again.");
      console.error("Error deleting page:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete Page" centered>
      <Text mb="md">
        Are you sure you want to delete <strong>{pagePath}</strong>? This action
        cannot be undone.
      </Text>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          variant="light"
          mb="md"
        >
          {error}
        </Alert>
      )}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={handleDelete} loading={loading}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
