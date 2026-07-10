import React from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/")({
  component: () => <Navigate to="/editor/index" />,
});
