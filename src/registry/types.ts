import { ReactNode } from "react";

export type FieldType =
  | "text"
  | "boolean"
  | "number"
  | "string"
  | "image"
  | "date"
  | "datetime"
  | "link"
  | "stringlist"
  | { type: "enum"; options: string[] }
  | { type: "multienum"; options: string[] }
  | { type: "number"; options: number[] }
  | { type: "slider"; min: number; max: number; step?: number }
  | { type: "color"; options: string[] }
  | { type: "componentlist"; only?: string[] }
  | { type: "objectlist" }
  | { type: "text"; toolbar?: ("bold" | "italic" | "link" | "heading" | "bulletList" | "orderedList" | "code" | "blockquote" | "strikethrough")[] }
  | "componentlist";

// Runtime value of a field (what gets stored in instance props)
export type FieldValue =
  | string
  | number
  | boolean
  | null
  | FieldValue[]
  | { [key: string]: FieldValue };

// Link field value
export interface LinkValue {
  url: string;
  title: string;
  target: "_blank" | "_self";
}

// Validation
export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationResult {
  severity: ValidationSeverity;
  message: string;
  field?: string;
}

export type ValidationFunction = (props: Record<string, any>) => ValidationResult[];

// Property groups for tabbed editing
// A group can have standard properties, a custom extension component, or both
export type PropertyGroup =
  | { title: string; properties: string[] }
  | { title: string; component: string }
  | { title: string; properties: string[]; component: string };

// Props interface that editing extensions receive
export interface EditingExtensionProps {
  instance: Instance;
  updateProps: (updates: Record<string, FieldValue>) => void;
  get: (fieldName: string) => FieldValue;
  metadata: ComponentMetadata;
}

// Registry for editing extensions (name -> component)
export type EditingExtensionRegistry = Record<string, {
  Component: React.ComponentType<EditingExtensionProps>;
}>;

// Conditional property visibility
export interface PropertyCondition {
  property: string;
  showIf: {
    field: string;
    equals?: any;
    notEquals?: any;
    oneOf?: any[];
  };
}

// Per-field display metadata
export interface FieldMetadataEntry {
  label?: string;
  description?: string;
  warning?: string;
}

// Metadata for a component
export interface ComponentMetadata {
  name: string;
  description?: string;
  defaultProps: Record<string, any>;
  editableProps: Record<string, FieldType>;
  fieldMetadata?: Record<string, FieldMetadataEntry>;
  propertyGroups?: PropertyGroup[];
  conditionalProperties?: PropertyCondition[];
  validate?: ValidationFunction;
  onlyInside?: string[];
  thumbnail?: string;
  category?: string;
}

// A single instance in the tree
export interface Instance {
  id: string;
  props: {
    instanceId: number | string; // Unique identifier for the instance
    [key: string]: any; // Additional properties
  };
}

// Registry entry for a registered component.
//
// `Component` is optional to support METADATA-ONLY registries: an editor that
// renders the page in a separate document (e.g. the iframe canvas) never
// renders components itself, so its registry entries only need metadata
// (defaultProps for inserts, editableProps for the property panel and
// container detection). ComponentRenderer skips entries without a Component.
export interface ComponentRegistryEntry {
  Component?: React.ComponentType<ReactNode>;
  metadata: ComponentMetadata;
}

// Registry type
export type ComponentRegistry = Record<string, ComponentRegistryEntry>;