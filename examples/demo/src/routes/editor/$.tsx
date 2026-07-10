import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { EditorPage } from "../../components/pages/EditorPage";
import { EditorLoginGuard } from "../../components/LoginCheck";

function ProtectedEditorPage() {
  return (
    <EditorLoginGuard>
      <EditorPage />
    </EditorLoginGuard>
  );
}

export const Route = createFileRoute("/editor/$")({
  component: ProtectedEditorPage,
});
