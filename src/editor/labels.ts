// Editor chrome labels — a shallow string map with English defaults so
// consumers can localize the bundled editor without forking it:
//
//   <Editor canvasSrc="/canvas" labels={{ publish: "Veröffentlichen" }} />
//
// Coverage: the 0.4.0 canvas-only chrome (TopBar, LeftSidebar, palette,
// layer tree + its context menu, component picker modal, RightSidebar,
// property panel, canvas iframe title). The legacy page-management pieces
// carried over from earlier releases (Navigation, CreatePageModal,
// TreeFileHandler, SaveAsTemplateModal, DeletePageConfirmModal) keep their
// hardcoded English strings for now.
import React from "react";

export interface EditorLabels {
  // TopBar
  undo: string;
  redo: string;
  saveDraft: string;
  publish: string;
  exportSite: string;
  editMode: string;
  desktopPreview: string;
  mobilePreview: string;
  // LeftSidebar
  pagesTab: string;
  buildTab: string;
  componentsHeading: string;
  layersHeading: string;
  // Layer tree
  addComponent: string;
  emptyTree: string;
  insertComponent: string;
  duplicate: string;
  delete: string;
  moveUp: string;
  moveDown: string;
  moveOut: string;
  moveInto: string;
  expand: string;
  collapse: string;
  // Component picker modal
  pickerTitle: string;
  pickerSearchPlaceholder: string;
  pickerEmpty: string;
  // RightSidebar / property panel
  noSelection: string;
  noSelectionHint: string;
  propertiesOtherTab: string;
  selectComponentPrompt: string;
  // Canvas
  canvasTitle: string;
}

export const defaultEditorLabels: EditorLabels = {
  undo: "Undo (Ctrl+Z)",
  redo: "Redo (Ctrl+Shift+Z)",
  saveDraft: "Save Draft",
  publish: "Publish",
  exportSite: "Export Site",
  editMode: "Edit",
  desktopPreview: "Desktop",
  mobilePreview: "Mobile",
  pagesTab: "Pages",
  buildTab: "Build",
  componentsHeading: "Components",
  layersHeading: "Layers",
  addComponent: "Add",
  emptyTree: "No components on this page",
  insertComponent: "Insert component",
  duplicate: "Duplicate",
  delete: "Delete",
  moveUp: "Move up",
  moveDown: "Move down",
  moveOut: "Move out of parent",
  moveInto: "Move into previous sibling",
  expand: "Expand",
  collapse: "Collapse",
  pickerTitle: "Add component",
  pickerSearchPlaceholder: "Search components...",
  pickerEmpty: "No matching components found",
  noSelection: "Nothing selected",
  noSelectionHint:
    "Click a component in the canvas or in the layer tree to edit it.",
  propertiesOtherTab: "Other",
  selectComponentPrompt: "Select a component to edit",
  canvasTitle: "Canvas",
};

const EditorLabelsContext =
  React.createContext<EditorLabels>(defaultEditorLabels);

export interface EditorLabelsProviderProps {
  /** Partial override — anything omitted falls back to the English default. */
  labels?: Partial<EditorLabels>;
  children: React.ReactNode;
}

export function EditorLabelsProvider({
  labels,
  children,
}: EditorLabelsProviderProps) {
  const value = React.useMemo(
    () => ({ ...defaultEditorLabels, ...labels }),
    [labels]
  );
  return React.createElement(
    EditorLabelsContext.Provider,
    { value },
    children
  );
}

/** The merged label map (defaults + the Editor's `labels` prop). */
export function useEditorLabels(): EditorLabels {
  return React.useContext(EditorLabelsContext);
}
