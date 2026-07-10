import { useEffect, useRef } from "react";
import { useComponentRegistry } from "@derneuere/visual-react";
import type { EditingExtensionProps } from "@derneuere/visual-react";

/**
 * Register custom editing extensions with the component registry.
 *
 * An editing extension is a React component that receives
 * `EditingExtensionProps` and augments the editor UI for a specific
 * component type (e.g. a custom property dialog or selector).
 * Add entries to the array below to register your own:
 *
 *   const extensions = [
 *     { name: "MyPropertyDialog", Component: MyPropertyDialog },
 *   ];
 */
const extensions: { name: string; Component: React.ComponentType<EditingExtensionProps> }[] = [];

export function ExtensionLoader() {
  const { registerEditingExtensions } = useComponentRegistry();
  const registered = useRef(false);

  useEffect(() => {
    if (!registered.current) {
      registered.current = true;
      if (extensions.length > 0) {
        registerEditingExtensions(extensions);
      }
    }
  });

  return null;
}
