// instanceFields — pure field-descriptor computation behind useInstanceFields.
//
// Turns a component's metadata + an instance's current props into an ordered
// list of TYPED field descriptors, so a custom property panel reduces to a
// `fieldType -> input component` map. Kept free of React for unit testing;
// the hook in useInstanceFields.ts adds the registry lookup and `setValue`.

import type {
  ComponentMetadata,
  FieldType,
  FieldValue,
  Instance,
  ValidationResult,
} from "../registry/types";

/**
 * Normalized FieldType discriminant: the object forms collapse onto their
 * `.type`, the string shorthands map to themselves. Switch a property panel
 * on THIS instead of the raw FieldType union.
 */
export type FieldTypeName =
  | "string"
  | "text"
  | "boolean"
  | "number"
  | "image"
  | "date"
  | "datetime"
  | "link"
  | "stringlist"
  | "enum"
  | "multienum"
  | "slider"
  | "color"
  | "componentlist"
  | "objectlist";

/** One editable field of an instance, ready for rendering. */
export interface InstanceField {
  /** Prop key in `instance.props` / `metadata.editableProps`. */
  key: string;
  /** Normalized discriminant — map this to your input component. */
  fieldType: FieldTypeName;
  /** The raw FieldType from the metadata (for extra config like objectlist fields). */
  raw: FieldType;
  /** Display label (fieldMetadata.label, falling back to the key). */
  label: string;
  description?: string;
  warning?: string;
  /** enum / multienum / color / number-with-options choices. */
  options?: Array<string | number>;
  /** slider bounds. */
  min?: number;
  max?: number;
  step?: number;
  /** rich-text toolbar restriction ({ type: "text", toolbar }). */
  toolbar?: string[];
  /** Title of the propertyGroup containing this field (null = ungrouped). */
  group: string | null;
  /**
   * Structural fields hold child instances (componentlist) — they are
   * managed by the tree/canvas, not a property input. UIs typically skip
   * descriptors with `structural: true`.
   */
  structural: boolean;
  /** conditionalProperties resolved against the instance's current props. */
  visible: boolean;
  /** Message of the first error-severity validation result for this field. */
  error?: string;
  /** All validation results targeting this field (any severity). */
  validation: ValidationResult[];
  /** Current value from `instance.props`. */
  value: FieldValue;
}

/** Normalize a raw FieldType to its discriminant name. */
export function fieldTypeName(field: FieldType): FieldTypeName {
  if (typeof field === "string") return field as FieldTypeName;
  return field.type as FieldTypeName;
}

/**
 * Resolve conditionalProperties for one prop against the instance's current
 * props (same semantics as the bundled editor's EditingTab).
 */
export function isPropertyVisible(
  metadata: ComponentMetadata,
  prop: string,
  instance: Instance
): boolean {
  if (!metadata.conditionalProperties) return true;
  const condition = metadata.conditionalProperties.find(
    (c) => c.property === prop
  );
  if (!condition?.showIf) return true;

  const fieldValue = instance.props[condition.showIf.field];
  if (
    condition.showIf.equals !== undefined &&
    fieldValue !== condition.showIf.equals
  ) {
    return false;
  }
  if (
    condition.showIf.notEquals !== undefined &&
    fieldValue === condition.showIf.notEquals
  ) {
    return false;
  }
  if (
    condition.showIf.oneOf &&
    !condition.showIf.oneOf.includes(fieldValue)
  ) {
    return false;
  }
  return true;
}

/** Title of the first propertyGroup listing `prop`, or null. */
function groupOf(metadata: ComponentMetadata, prop: string): string | null {
  for (const group of metadata.propertyGroups ?? []) {
    if ("properties" in group && group.properties.includes(prop)) {
      return group.title;
    }
  }
  return null;
}

/**
 * Compute the ordered field descriptors for an instance (order =
 * `metadata.editableProps` entry order). Pure — pass the validation results
 * you already have (e.g. from `validateInstance`).
 */
export function computeInstanceFields(
  metadata: ComponentMetadata,
  instance: Instance,
  validationResults: ValidationResult[] = []
): InstanceField[] {
  return Object.entries(metadata.editableProps).map(([key, raw]) => {
    const name = fieldTypeName(raw);
    const fieldMeta = metadata.fieldMetadata?.[key];
    const validation = validationResults.filter((v) => v.field === key);
    const error = validation.find((v) => v.severity === "error")?.message;

    const field: InstanceField = {
      key,
      fieldType: name,
      raw,
      label: fieldMeta?.label ?? key,
      description: fieldMeta?.description,
      warning: fieldMeta?.warning,
      group: groupOf(metadata, key),
      structural: name === "componentlist",
      visible: isPropertyVisible(metadata, key, instance),
      error,
      validation,
      value: instance.props[key] as FieldValue,
    };

    if (typeof raw === "object") {
      if ("options" in raw && Array.isArray(raw.options)) {
        field.options = raw.options;
      }
      if (raw.type === "slider") {
        field.min = raw.min;
        field.max = raw.max;
        field.step = raw.step;
      }
      if (raw.type === "text" && raw.toolbar) {
        field.toolbar = [...raw.toolbar];
      }
    }

    return field;
  });
}
