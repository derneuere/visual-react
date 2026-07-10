import React, { useEffect, useRef } from "react";
import { useComponentRegistry } from "../registry/hooks";

interface ComponentLoaderProps {
  importer: Record<string, () => Promise<any>>; // Glob import function
}

/**
 * ComponentLoader dynamically loads and registers components from a given importer.
 *
 * @param {Record<string, () => Promise<any>>} importer - A map of dynamic imports
 */
export const ComponentLoader: React.FC<ComponentLoaderProps> = ({
  importer,
}) => {
  const { registerComponents } =
    useComponentRegistry();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadComponents = async () => {
      const entries = Object.entries(importer);
      const modules = await Promise.all(
        entries.map(async ([filePath, importFn]) => {
          const module = await importFn();
          const componentName =
            filePath.split("/").pop()?.replace(".tsx", "") || "";
          const { default: Component, metadata } = module as {
            default: React.ComponentType<any>;
            metadata?: any;
          };
          return { id: componentName, Component, metadata };
        })
      );

      registerComponents(modules);
    };

    loadComponents();
  }, [importer, registerComponents]);

  return null;
};

export default ComponentLoader;
