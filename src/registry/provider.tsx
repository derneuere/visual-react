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
}

// Provider props type
interface ComponentRegistryProviderProps {
  children: ReactNode;
  initialRegistry?: ComponentRegistry;
  initialPage?: Instance[];
}

export const ComponentRegistryProvider: React.FC<
  ComponentRegistryProviderProps
> = ({ children, initialRegistry, initialPage }) => {
  const [registry, setRegistry] = useState<ComponentRegistry>(initialRegistry ?? {});
  const [extensionRegistry, setExtensionRegistry] = useState<EditingExtensionRegistry>({});
  const [currentPage, setCurrentPage] = useState<Instance[]>(initialPage ?? []);
  const [pagePath, setPagePath] = useState<string>("currentpage");
  const [loadedPage, setLoadedPage] = useState<Instance[]>(initialPage ?? []);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);

  const setPage = (data: PageData) => {
    setCurrentPage(data.content);
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
    const prevNode = findNode(
      currentPage,
      instanceId,
      hasChildren,
      getChildren
    );
    if (!prevNode) {
      return;
    }
    const node = { ...prevNode, props: { ...prevNode.props, ...newProps } };
    setCurrentPage((prevPage) =>
      findAndReplaceNode(prevPage, instanceId, node, hasChildren, getChildren)
    );
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
      }}
    >
      {children}
    </ComponentRegistryContext.Provider>
  );
};

export default ComponentRegistryProvider;
