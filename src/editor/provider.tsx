import React, { useState } from "react";
import { EditorContext } from "./context";
import type { EditorProviderProps } from "./types";
import { Instance } from "../registry/types";

// Provider component
export const EditorProvider: React.FC<EditorProviderProps> = ({ children }) => {
  const [selectedInstanceId, setSelectedInstanceId] = useState<
    number | string | null
  >(null);
  const [draggedInstanceId, setDraggedInstanceId] = useState<
    number | string | null
  >(null);
  const [dropTarget, setDropTarget] = useState<{
    id: number | string | null;
    fieldName: string | null;
    position?: 'above' | 'below' | 'into';
  } | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  const [isModalOpen, setModalOpen] = React.useState(false);
  const [isAbove, setIsAbove] = React.useState(false);
  const [clipboard, setClipboard] = useState<Instance | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);

  return (
    <EditorContext.Provider
      value={{
        selectedInstanceId,
        setSelectedInstanceId,
        draggedInstanceId,
        setDraggedInstanceId,
        dropTarget,
        setDropTarget,
        isPreview,
        setIsPreview,
        isModalOpen,
        setModalOpen,
        isAbove,
        setIsAbove,
        clipboard,
        setClipboard,
        editModalOpen,
        setEditModalOpen,
        pageSettingsOpen,
        setPageSettingsOpen,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
};