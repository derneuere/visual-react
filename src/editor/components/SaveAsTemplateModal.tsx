import { useState } from "react";
import { Modal, TextInput, Button, Group, Stack, Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStorageAdapter } from "../../storage/hooks";
import { slugify } from "../../utils/pageDefaults";
import { createDefaultMeta } from "../../storage/migration";
import { TEMPLATES_FOLDER } from "../../templates";
import type { Instance } from "../../registry/types";

interface SaveAsTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  pageContent: Instance[];
}

export function SaveAsTemplateModal({
  opened,
  onClose,
  pageContent,
}: SaveAsTemplateModalProps) {
  const storage = useStorageAdapter();
  const queryClient = useQueryClient();
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const slug = slugify(templateName);

  const handleSave = async () => {
    if (!slug) {
      setError("Please enter a template name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const templatePath = `${TEMPLATES_FOLDER}/${slug}`;
      await storage.savePage(templatePath, {
        meta: createDefaultMeta(templateName),
        content: pageContent,
      });
      await queryClient.invalidateQueries({ queryKey: ["pages"] });
      handleClose();
    } catch (err) {
      setError("Failed to save template. Please try again.");
      console.error("Error saving template:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTemplateName("");
    setError(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Save as Template" centered>
      <Stack gap="md">
        <TextInput
          label="Template Name"
          placeholder="My Template"
          value={templateName}
          onChange={(e) => setTemplateName(e.currentTarget.value)}
          description={slug ? `Will be saved as: _templates/${slug}` : undefined}
        />

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading} disabled={!slug}>
            Save Template
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
