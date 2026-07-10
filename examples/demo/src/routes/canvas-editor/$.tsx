import React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CanvasEditorPage } from "../../components/pages/CanvasEditorPage";

export const Route = createFileRoute("/canvas-editor/$")({
  component: CanvasEditorPage,
});
