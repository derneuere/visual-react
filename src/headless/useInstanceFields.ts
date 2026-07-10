import { useMemo } from "react";
import type { FieldValue, Instance } from "../registry/types";
import { useComponentRegistry } from "../registry/hooks";
import {
  computeInstanceFields,
  type InstanceField,
} from "./instanceFields";

/** An {@link InstanceField} plus its write-back setter. */
export interface EditableInstanceField extends InstanceField {
  /** Write the value back (updateInstanceProps under the hood). */
  setValue: (value: FieldValue) => void;
}

/**
 * Ordered, typed field descriptors for an instance — the headless property
 * panel. Covers every FieldType (incl. color / objectlist / componentlist;
 * componentlist descriptors carry `structural: true` so UIs can skip them),
 * resolves conditionalProperties into `visible`, attaches the instance's
 * validation results per field, and pairs each value with a `setValue` that
 * writes through `updateInstanceProps` (so edits participate in undo/redo
 * and coalesce while typing).
 *
 * The consumer maps `fieldType` to its own input component:
 *
 *   const fields = useInstanceFields(instance);
 *   return fields
 *     .filter((f) => f.visible && !f.structural)
 *     .map((f) => <FieldInput key={f.key} field={f} />);
 *
 * Returns [] when `instance` is null or its component is not registered.
 */
export function useInstanceFields(
  instance: Instance | null
): EditableInstanceField[] {
  const { getComponentProps, updateInstanceProps, validateInstance } =
    useComponentRegistry();

  const metadata = instance ? getComponentProps(instance.id) : null;
  const validationResults =
    instance && metadata ? validateInstance(instance.props.instanceId) : [];

  return useMemo(() => {
    if (!instance || !metadata) return [];
    const instanceId = instance.props.instanceId;
    return computeInstanceFields(metadata, instance, validationResults).map(
      (field) => ({
        ...field,
        setValue: (value: FieldValue) =>
          updateInstanceProps(instanceId, { [field.key]: value }),
      })
    );
    // updateInstanceProps is stable per provider render; instance/metadata/
    // validation drive the recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, metadata, JSON.stringify(validationResults)]);
}
