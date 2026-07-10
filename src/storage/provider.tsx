import { ReactNode } from "react";
import { StorageAdapterContext } from "./context";
import { StorageAdapter } from "./types";

export interface StorageAdapterProviderProps {
  adapter: StorageAdapter;
  children: ReactNode;
}

export function StorageAdapterProvider({
  adapter,
  children,
}: StorageAdapterProviderProps) {
  return (
    <StorageAdapterContext.Provider value={adapter}>
      {children}
    </StorageAdapterContext.Provider>
  );
}
