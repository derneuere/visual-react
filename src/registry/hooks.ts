import { useContext } from "react";
import { ComponentRegistryContextValue } from "./provider";
import { ComponentRegistryContext } from "./context";

// Custom hook for consuming the context
export const useComponentRegistry = (): ComponentRegistryContextValue => {
  const context = useContext(ComponentRegistryContext);
  if (!context) {
    throw new Error(
      "useComponentRegistry must be used within a ComponentRegistryProvider"
    );
  }
  return context;
};