import { createContext } from "react";
import { StorageAdapter } from "./types";

export const StorageAdapterContext = createContext<StorageAdapter | null>(null);
