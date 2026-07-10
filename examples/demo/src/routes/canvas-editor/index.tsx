import React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/canvas-editor/")({
  component: () => (
    <Navigate to="/canvas-editor/$" params={{ _splat: "index" }} />
  ),
});
