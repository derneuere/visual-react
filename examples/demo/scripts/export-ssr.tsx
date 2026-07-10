import React from "react";
import { renderToString } from "react-dom/server";
import { buildRegistry, PageRenderer } from "./export-shared";
import type { Instance } from "@derneuere/visual-react";

const registry = buildRegistry();

export function renderPage(pageData: Instance[]): string {
  return renderToString(
    <PageRenderer pageData={pageData} registry={registry} />
  );
}

export { registry };
