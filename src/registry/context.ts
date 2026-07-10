import { createContext } from "react";
import type { ComponentRegistryContextValue } from "./provider";

// Context creation
export const ComponentRegistryContext =
  createContext<ComponentRegistryContextValue | undefined>(undefined);