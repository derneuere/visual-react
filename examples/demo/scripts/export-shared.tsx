import React from "react";
import { MantineProvider } from "@mantine/core";
import {
  StaticModeProvider,
  EditorProvider,
  ComponentRegistryProvider,
  type ComponentRegistry,
  type Instance,
} from "@derneuere/visual-react";
import { ComponentRenderer } from "@derneuere/visual-react/editor";

// Eagerly import all example components via Vite glob
const componentModules = import.meta.glob(
  "../src/components/examples/*.tsx",
  { eager: true }
) as Record<string, { default: React.ComponentType<any>; metadata?: any }>;

// Build the component registry from the glob imports
export function buildRegistry(): ComponentRegistry {
  const registry: ComponentRegistry = {};
  for (const [filePath, module] of Object.entries(componentModules)) {
    const componentName = filePath.split("/").pop()?.replace(".tsx", "") || "";
    const Component = module.default;
    const metadata = module.metadata || {
      name: componentName,
      defaultProps: {},
      editableProps: {},
    };
    registry[componentName] = { Component, metadata };
  }
  return registry;
}

// Shared page renderer used by both SSR and client hydration
export function PageRenderer({
  pageData,
  registry,
}: {
  pageData: Instance[];
  registry: ComponentRegistry;
}) {
  if (!pageData || !pageData.length) {
    return null;
  }

  return (
    <MantineProvider>
      <StaticModeProvider>
        <EditorProvider>
          <ComponentRegistryProvider
            initialRegistry={registry}
            initialPage={pageData}
          >
            <ComponentRenderer
              items={pageData[0].props.children}
              notEditable
            />
          </ComponentRegistryProvider>
        </EditorProvider>
      </StaticModeProvider>
    </MantineProvider>
  );
}
