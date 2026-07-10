import { useContext } from "react";
import { StorageAdapter } from "./types";
import { StorageAdapterContext } from "./context";

export function useStorageAdapter(): StorageAdapter {
  const context = useContext(StorageAdapterContext);
  if (!context) {
    throw new Error(
      "useStorageAdapter must be used within a StorageAdapterProvider"
    );
  }
  return context;
}
