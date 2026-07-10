import { useContext } from "react";
import { EditorContextValue } from "./types";
import { EditorContext } from "./context";

// Custom hook for consuming the context
export const useEditor = (): EditorContextValue => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditor must be used within a EditorProvider");
  }
  return context;
};