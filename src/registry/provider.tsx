import React, { useState, ReactNode } from "react";
import type {
  ComponentMetadata,
  Instance,
  ComponentRegistry,
  ComponentRegistryEntry,
  FieldType,
  FieldValue,
  ValidationResult,
  EditingExtensionProps,
  EditingExtensionRegistry,
} from "./types";
import type { PageMeta, PageData } from "../storage/types";
import { ComponentRegistryContext } from "./context";
import {
  addItemToParent,
  addItemRelativeToNode,
  deepCloneInstance,
  findAndReplaceNode,
  findNode,
  removeNode,
} from "../utils/treeUtils";
import {
  applyHistoryChange,
  clearHistory as clearHistoryState,
  createHistory,
  redoHistory,
  undoHistory,
  DEFAULT_HISTORY_LIMIT,
} from "../utils/history";

const isComponentListField = (value: FieldType): boolean => {
  return value === "componentlist" ||
    (typeof value === "object" && value !== null && value.type === "componentlist");
};

const hasComponentListField = (metadata: ComponentMetadata) => {
  if (!metadata || !metadata.editableProps) {
    return false;
  }
  return Object.values(metadata.editableProps).some(isComponentListField);
};

const getComponentListFields = (metadata: ComponentMetadata): string[] => {
  if (!metadata || !metadata.editableProps) {
    return [];
  }
  return Object.entries(metadata.editableProps)
    .filter(([, value]) => isComponentListField(value))
    .map(([key]) => key);
};

// Context value type
export interface ComponentRegistryContextValue {
  registerComponent: (
    id: string,
    Component: React.ComponentType<ReactNode>,
    metadata: ComponentMetadata
  ) => void;
  registerComponents: (components: {
    id: string;
    Component: React.ComponentType<ReactNode>;
    metadata: ComponentMetadata;
  }[]) => void;
  getComponentById: (id: string) => ComponentRegistryEntry | undefined;
  getAllRegisteredComponents: () => string[];
  getComponentProps: (id: string) => ComponentMetadata | null;
  currentPage: Instance[];
  setCurrentPage: React.Dispatch<React.SetStateAction<Instance[]>>;
  addChild: (
    parentId: number | string,
    id: string,
    defaultProps?: Record<string, FieldType>
  ) => void;
  updateInstanceProps: (
    instanceId: number | string,
    newProps: Record<string, FieldValue>
  ) => void;
  downloadTree: () => void;
  deleteNode: (instanceId: number | string) => void;
  hasChildren: (instance: Instance) => boolean;
  getChildren: (instance: Instance) => string[] | null;
  switchPage: (pagePath: string) => void;
  isCurrentPageChanged: boolean;
  pagePath: string;
  setPage: (data: PageData) => void;
  pageMeta: PageMeta | null;
  setPageMeta: (meta: PageMeta) => void;
  validateInstance: (instanceId: number | string) => ValidationResult[];
  getFieldRestrictions: (componentId: string, fieldName: string) => string[] | null;
  duplicateNode: (instanceId: number | string) => void;
  pasteNode: (source: Instance, targetId: number | string, position: "above" | "below") => void;
  findInstance: (instanceId: number | string | null) => Instance | null;
  registerEditingExtension: (name: string, Component: React.ComponentType<EditingExtensionProps>) => void;
  registerEditingExtensions: (extensions: { name: string; Component: React.ComponentType<EditingExtensionProps> }[]) => void;
  getEditingExtension: (name: string) => { Component: React.ComponentType<EditingExtensionProps> } | undefined;
  /** Undo/redo over the page tree (see useEditorHistory). */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

// Provider props type
interface ComponentRegistryProviderProps {
  children: ReactNode;
  initialRegistry?: ComponentRegistry;
  initialPage?: Instance[];
  /** Max undo-stack depth for tree mutations (default 100). */
  historyLimit?: number;
}

// How long (ms) rapid same-instance+fields updateInstanceProps calls keep
// collapsing into one undo step (typing = one undo).
const PROP_COALESCE_WINDOW_MS = 500;

export const ComponentRegistryProvider: React.FC<
  ComponentRegistryProviderProps
> = ({
  children,
  initialRegistry,
  initialPage,
  historyLimit = DEFAULT_HISTORY_LIMIT,
}) => {
  const [registry, setRegistry] = useState<ComponentRegistry>(initialRegistry ?? {});
  const [extensionRegistry, setExtensionRegistry] = useState<EditingExtensionRegistry>({});
  // The page tree lives inside a bounded undo/redo history: EVERY tree
  // mutation funnels through applyChange below (setCurrentPage is the public
  // face; updateInstanceProps/deleteNode/duplicateNode/pasteNode/addChild
  // all build on it), so undo/redo covers any editor UI on top.
  const [history, setHistory] = useState(() =>
    createHistory<Instance[]>(initialPage ?? [])
  );
  const currentPage = history.present;
  const [pagePath, setPagePath] = useState<string>("currentpage");
  const [loadedPage, setLoadedPage] = useState<Instance[]>(initialPage ?? []);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);

  /**
   * Apply a tree change through the history. `coalesceKey` (non-null) lets
   * rapid successive changes with the same key collapse into one undo step.
   */
  const applyChange = (
    action: React.SetStateAction<Instance[]>,
    coalesceKey?: string
  ) => {
    setHistory((h) => {
      const next =
        typeof action === "function"
          ? (action as (prev: Instance[]) => Instance[])(h.present)
          : action;
      return applyHistoryChange(h, next, {
        coalesceKey,
        coalesceWindowMs: PROP_COALESCE_WINDOW_MS,
        limit: historyLimit,
      });
    });
  };

  const setCurrentPage: React.Dispatch<React.SetStateAction<Instance[]>> = (
    action
  ) => applyChange(action);

  const undo = () => setHistory((h) => undoHistory(h));
  const redo = () => setHistory((h) => redoHistory(h));
  const clearHistory = () => setHistory((h) => clearHistoryState(h));
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const setPage = (data: PageData) => {
    // A fresh page load is not an undoable change: reset the history so
    // undo never crosses page boundaries.
    setHistory(createHistory(data.content));
    setLoadedPage(data.content);
    setPageMeta(data.meta);
  };

  const isCurrentPageChanged =
    JSON.stringify(loadedPage) !== JSON.stringify(currentPage);

  // Component loading has been moved to the client code
  // through the ComponentLoader component

  const registerComponents = (
    components: {
      id: string;
      Component: React.ComponentType<ReactNode>;
      metadata: ComponentMetadata;
    }[]
  ) => {
    setRegistry((prevRegistry) => {
      const newEntries = components.reduce(
        (acc, { id, Component, metadata }) => ({
          ...acc,
          [id]: { Component, metadata },
        }),
        {}
      );
      return { ...prevRegistry, ...newEntries };
    });
  };

  const registerComponent = (
    id: string,
    Component: React.ComponentType<ReactNode>,
    metadata: ComponentMetadata
  ) => {
    setRegistry((prevRegistry) => ({
      ...prevRegistry,
      [id]: { Component, metadata },
    }));
  };

  const getComponentById = (id: string) => {
    return registry[id];
  };

  const getComponentProps = (id: string) => {
    const Component = getComponentById(id);
    if (!Component) return null;
    const metadata = Component.metadata;
    return metadata;
  };

  const getAllRegisteredComponents = () => Object.keys(registry);

  const addChild = (
    parentId: number | string,
    id: string,
    defaultProps: Record<string, FieldType> = {}
  ) => {
    setCurrentPage((prevPage) => {
      const newChild: Instance = {
        id,
        props: { instanceId: crypto.randomUUID(), ...defaultProps },
      };
      return addItemToParent(
        prevPage,
        parentId,
        newChild,
        hasChildren,
        getChildren
      );
    });
  };

  const updateInstanceProps = (
    instanceId: number | string,
    newProps: Record<string, FieldValue>
  ) => {
    // Coalesce rapid updates to the SAME instance + field set into one undo
    // step (typing into a text input = one undo, not one per keystroke).
    const coalesceKey = `props:${String(instanceId)}:${Object.keys(newProps)
      .sort()
      .join(",")}`;
    applyChange((prevPage) => {
      const prevNode = findNode(prevPage, instanceId, hasChildren, getChildren);
      if (!prevNode) {
        return prevPage;
      }
      const node = { ...prevNode, props: { ...prevNode.props, ...newProps } };
      return findAndReplaceNode(
        prevPage,
        instanceId,
        node,
        hasChildren,
        getChildren
      );
    }, coalesceKey);
  };

  const downloadTree = () => {
    const treeData = JSON.stringify(currentPage, null, 2);
    const blob = new Blob([treeData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tree.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteNode = (instanceId: number | string) => {
    setCurrentPage(
      (prevPage) =>
        removeNode(prevPage, instanceId, hasChildren, getChildren) || prevPage
    );
  };

  const hasChildren = (instance: Instance) => {
    const metadata = getComponentProps(instance.id);
    if (!metadata) return false;
    return hasComponentListField(metadata);
  };

  const getChildren = (instance: Instance) => {
    const metadata = getComponentProps(instance.id);
    if (!metadata) return null;
    return getComponentListFields(metadata);
  };

  const switchPage = (pagePath: string) => {
    setPagePath(pagePath);
    // Undo must not cross page boundaries (the subsequent setPage resets the
    // history anyway, but a consumer may swap trees via setCurrentPage too).
    setHistory((h) => clearHistoryState(h));
  };

  const validateInstance = (instanceId: number | string): ValidationResult[] => {
    const instance = findNode(currentPage, instanceId, hasChildren, getChildren);
    if (!instance) return [];
    const metadata = getComponentProps(instance.id);
    if (!metadata?.validate) return [];
    return metadata.validate(instance.props);
  };

  const getFieldRestrictions = (componentId: string, fieldName: string): string[] | null => {
    const metadata = getComponentProps(componentId);
    if (!metadata) return null;
    const field = metadata.editableProps[fieldName];
    if (typeof field === "object" && field.type === "componentlist" && field.only) {
      return field.only;
    }
    return null;
  };

  const findInstance = (instanceId: number | string | null): Instance | null => {
    return findNode(currentPage, instanceId, hasChildren, getChildren);
  };

  const duplicateNode = (instanceId: number | string) => {
    const instance = findNode(currentPage, instanceId, hasChildren, getChildren);
    if (!instance) return;
    const cloned = deepCloneInstance(instance, hasChildren, getChildren);
    setCurrentPage((prevPage) =>
      addItemRelativeToNode(prevPage, instanceId, cloned, "below", hasChildren, getChildren)
    );
  };

  const pasteNode = (source: Instance, targetId: number | string, position: "above" | "below") => {
    const cloned = deepCloneInstance(source, hasChildren, getChildren);
    setCurrentPage((prevPage) =>
      addItemRelativeToNode(prevPage, targetId, cloned, position, hasChildren, getChildren)
    );
  };

  const registerEditingExtension = (
    name: string,
    Component: React.ComponentType<EditingExtensionProps>
  ) => {
    setExtensionRegistry((prev) => ({
      ...prev,
      [name]: { Component },
    }));
  };

  const registerEditingExtensions = (
    extensions: { name: string; Component: React.ComponentType<EditingExtensionProps> }[]
  ) => {
    setExtensionRegistry((prev) => {
      const newEntries = extensions.reduce<EditingExtensionRegistry>(
        (acc, { name, Component }) => ({ ...acc, [name]: { Component } }),
        {}
      );
      return { ...prev, ...newEntries };
    });
  };

  const getEditingExtension = (name: string) => {
    return extensionRegistry[name];
  };

  return (
    <ComponentRegistryContext.Provider
      value={{
        registerComponent,
        registerComponents,
        getComponentById,
        getAllRegisteredComponents,
        getComponentProps,
        currentPage,
        setCurrentPage,
        addChild,
        updateInstanceProps,
        downloadTree,
        deleteNode,
        hasChildren,
        getChildren,
        pagePath,
        switchPage,
        isCurrentPageChanged,
        setPage,
        pageMeta,
        setPageMeta,
        validateInstance,
        getFieldRestrictions,
        duplicateNode,
        pasteNode,
        findInstance,
        registerEditingExtension,
        registerEditingExtensions,
        getEditingExtension,
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory,
      }}
    >
      {children}
    </ComponentRegistryContext.Provider>
  );
};

export default ComponentRegistryProvider;
