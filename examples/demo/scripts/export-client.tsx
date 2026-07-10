import React from "react";
import { createRoot } from "react-dom/client";
import type { Instance } from "@derneuere/visual-react";

// CSS imports MUST come before export-shared so that Mantine base styles
// appear earlier in the bundle than component CSS modules (which override them).
import "@mantine/core/styles.css";
import "@mantine/carousel/styles.css";
import "leaflet/dist/leaflet.css";
import "../../../dist/editor.css";

import { buildRegistry, PageRenderer } from "./export-shared";

const registry = buildRegistry();

// Read page data embedded in the HTML
const dataElement = document.getElementById("__PAGE_DATA__");
if (dataElement) {
  const pageData: Instance[] = JSON.parse(dataElement.textContent || "[]");
  const rootEl = document.getElementById("root");
  if (rootEl) {
    createRoot(rootEl).render(
      <PageRenderer pageData={pageData} registry={registry} />
    );
  }
}
