import { createContext } from "react";
import { EditorContextValue } from "./types";

// Context creation
export const EditorContext = createContext<EditorContextValue | null>(null);