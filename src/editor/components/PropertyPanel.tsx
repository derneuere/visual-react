// PropertyPanel — the property editor of the canvas-only editor (0.4.0).
// Replaces the old EditingTab: field resolution (ordering, labels,
// descriptions/warnings, enum/slider/color config, conditional visibility,
// validation errors, value + undo-aware write-back) comes from the headless
// useInstanceFields hook; this component is only the
// `fieldType -> Mantine input` map.
//
// Kept from the old panel: RichTextEditor for "text" fields, AssetExplorer
// for "image" fields, propertyGroups tabs incl. registered editing
// extensions, the objectlist card editor, and the validation alert list.
// `componentlist` descriptors carry `structural: true` and are skipped —
// nesting is managed on the canvas / layer tree (select the child to edit
// its props).
import React from "react";
import {
  NumberInput,
  TextInput,
  Checkbox,
  Select,
  MultiSelect,
  TagsInput,
  Box,
  Card,
  Stack,
  Text,
  Group,
  Tabs,
  Alert,
  Slider,
} from "@mantine/core";
import type {
  Instance,
  LinkValue,
  ValidationResult,
} from "../../registry/types";
import { useEditor } from "../hooks";
import { useComponentRegistry } from "../../registry/hooks";
import {
  useInstanceFields,
  type EditableInstanceField,
} from "../../headless/useInstanceFields";
import { RichTextEditor } from "../../components/RichTextEditor";
import AssetExplorer from "./AssetExplorer";
import { useEditorLabels } from "../labels";

const colorSwatch = (color: string) => (
  <span
    style={{
      display: "inline-block",
      width: 14,
      height: 14,
      borderRadius: "50%",
      background: color,
      border: "1px solid rgba(0, 0, 0, 0.15)",
      flexShrink: 0,
    }}
  />
);

function FieldInput({
  field,
  instanceId,
}: {
  field: EditableInstanceField;
  instanceId: number | string;
}) {
  const { key, label, description, warning, value, setValue, error } = field;

  const withWarning = (input: React.ReactNode) => {
    if (!warning) return <React.Fragment key={key}>{input}</React.Fragment>;
    return (
      <React.Fragment key={key}>
        {input}
        <Alert color="yellow" variant="light" p="xs" mt={4}>
          <Text size="xs">{warning}</Text>
        </Alert>
      </React.Fragment>
    );
  };

  switch (field.fieldType) {
    case "string":
      return withWarning(
        <TextInput
          label={label}
          description={description}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Enter ${label}`}
          error={error}
        />
      );

    case "text":
      return withWarning(
        <div>
          <Text size="sm">{label}</Text>
          {description && (
            <Text size="xs" c="dimmed" mb={4}>
              {description}
            </Text>
          )}
          <RichTextEditor
            key={String(instanceId) + "richtext" + key}
            value={typeof value === "string" ? value : ""}
            onChange={(html) => setValue(html)}
            toolbar={
              field.toolbar as React.ComponentProps<
                typeof RichTextEditor
              >["toolbar"]
            }
          />
        </div>
      );

    case "number": {
      // Enumerated numbers ({ type: "number", options }) render as a Select.
      if (field.options) {
        return withWarning(
          <Select
            label={label}
            description={description}
            value={(value ?? field.options[0]).toString()}
            onChange={(v) => setValue(Number(v))}
            data={field.options.map((option) => ({
              value: option.toString(),
              label: option.toString(),
            }))}
            error={error}
          />
        );
      }
      return withWarning(
        <NumberInput
          label={label}
          description={description}
          value={typeof value === "number" ? value : 0}
          onChange={(v) => setValue(typeof v === "number" ? v : Number(v))}
          placeholder={`Enter ${label}`}
          error={error}
        />
      );
    }

    case "boolean":
      return withWarning(
        <Checkbox
          label={label}
          description={description}
          checked={Boolean(value)}
          onChange={(e) => setValue(e.target.checked)}
        />
      );

    case "date":
      return withWarning(
        <TextInput
          type="date"
          label={label}
          description={description}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          error={error}
        />
      );

    case "datetime": {
      const displayValue =
        typeof value === "string"
          ? value.replace("Z", "").replace(/\+.*$/, "")
          : "";
      return withWarning(
        <TextInput
          type="datetime-local"
          label={label}
          description={description}
          value={displayValue}
          onChange={(e) =>
            setValue(
              e.target.value ? new Date(e.target.value).toISOString() : ""
            )
          }
          error={error}
        />
      );
    }

    case "link": {
      const linkValue: LinkValue =
        value && typeof value === "object"
          ? (value as unknown as LinkValue)
          : { url: "", title: "", target: "_self" };
      return withWarning(
        <Card withBorder padding="xs">
          <Text size="sm" fw={500} mb="xs">
            {label}
          </Text>
          {description && (
            <Text size="xs" c="dimmed" mb="xs">
              {description}
            </Text>
          )}
          <Stack gap="xs">
            <TextInput
              label="URL"
              value={linkValue.url || ""}
              onChange={(e) => setValue({ ...linkValue, url: e.target.value })}
              placeholder="https://..."
              error={error}
            />
            <TextInput
              label="Title"
              value={linkValue.title || ""}
              onChange={(e) =>
                setValue({ ...linkValue, title: e.target.value })
              }
              placeholder="Link title"
            />
            <Select
              label="Target"
              value={linkValue.target || "_self"}
              onChange={(v) =>
                setValue({ ...linkValue, target: v as "_blank" | "_self" })
              }
              data={[
                { value: "_self", label: "Same window" },
                { value: "_blank", label: "New window" },
              ]}
            />
          </Stack>
        </Card>
      );
    }

    case "stringlist":
      return withWarning(
        <TagsInput
          label={label}
          description={description}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => setValue(v)}
          placeholder="Type and press Enter"
        />
      );

    case "enum":
      return withWarning(
        <Select
          label={label}
          description={description}
          value={(value as string) || String(field.options?.[0] ?? "")}
          onChange={(v) => setValue(v)}
          data={(field.options ?? []).map((option) => ({
            value: String(option),
            label: String(option),
          }))}
          error={error}
        />
      );

    case "multienum":
      return withWarning(
        <MultiSelect
          label={label}
          description={description}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => setValue(v)}
          data={(field.options ?? []).map((option) => ({
            value: String(option),
            label: String(option),
          }))}
          placeholder="Select options"
        />
      );

    case "image":
      return withWarning(
        <div>
          <AssetExplorer
            label={label}
            value={typeof value === "string" ? value : ""}
            onChange={(v: string) => setValue(v)}
          />
          {description && (
            <Text size="xs" c="dimmed" mt={4}>
              {description}
            </Text>
          )}
        </div>
      );

    case "slider": {
      const min = field.min ?? 0;
      const current = typeof value === "number" ? value : min;
      return withWarning(
        <div>
          <Text size="sm" mb={4}>
            {label}: {current}
          </Text>
          {description && (
            <Text size="xs" c="dimmed" mb={4}>
              {description}
            </Text>
          )}
          <Slider
            value={current}
            onChange={(v) => setValue(v)}
            min={min}
            max={field.max ?? 100}
            step={field.step ?? 1}
            label={(v) => `${v}`}
          />
        </div>
      );
    }

    case "color": {
      const current = typeof value === "string" ? value : "";
      return withWarning(
        <Select
          label={label}
          description={description}
          value={current || null}
          onChange={(v) => setValue(v)}
          data={(field.options ?? []).map((option) => ({
            value: String(option),
            label: String(option),
          }))}
          leftSection={current ? colorSwatch(current) : undefined}
          renderOption={({ option }) => (
            <Group gap="xs" wrap="nowrap">
              {colorSwatch(option.value)}
              <span>{option.label}</span>
            </Group>
          )}
          placeholder="Pick a color"
          error={error}
        />
      );
    }

    case "objectlist": {
      // { type: "objectlist", fields } — a card per entry with inputs for the
      // declared sub-fields (string / text / coordinates), same as the old
      // EditingTab.
      const config = field.raw as {
        type: "objectlist";
        fields?: Record<string, unknown>;
      };
      const items: Array<Record<string, any>> = Array.isArray(value)
        ? (value as Array<Record<string, any>>)
        : [];
      const updateItem = (index: number, updates: Record<string, unknown>) => {
        setValue(
          items.map((item, i) => (i === index ? { ...item, ...updates } : item))
        );
      };
      return withWarning(
        <Stack>
          <Text size="sm">{label}</Text>
          {items.map((dataobject, index) => (
            <Card key={index} withBorder padding="xs">
              {Object.entries(config.fields || {}).map(
                ([childProp, childConfig]) => {
                  if (childConfig === "string") {
                    return (
                      <TextInput
                        key={childProp}
                        label={childProp}
                        value={dataobject[childProp] || ""}
                        onChange={(e) =>
                          updateItem(index, { [childProp]: e.target.value })
                        }
                        placeholder={`Enter ${childProp}`}
                      />
                    );
                  }
                  if (childConfig === "text") {
                    return (
                      <div key={childProp}>
                        <Text size="sm">{childProp}</Text>
                        <RichTextEditor
                          value={dataobject[childProp] || ""}
                          onChange={(html) =>
                            updateItem(index, { [childProp]: html })
                          }
                        />
                      </div>
                    );
                  }
                  if (childConfig === "coordinates") {
                    const raw = dataobject[childProp];
                    const coords: [number, number] = Array.isArray(raw)
                      ? [Number(raw[0]) || 0, Number(raw[1]) || 0]
                      : [0, 0];
                    return (
                      <Group key={childProp}>
                        <NumberInput
                          label="Latitude"
                          value={coords[0] || 0}
                          onChange={(v) =>
                            updateItem(index, { [childProp]: [v, coords[1]] })
                          }
                          placeholder="Enter Latitude"
                        />
                        <NumberInput
                          label="Longitude"
                          value={coords[1] || 0}
                          onChange={(v) =>
                            updateItem(index, { [childProp]: [coords[0], v] })
                          }
                          placeholder="Enter Longitude"
                        />
                      </Group>
                    );
                  }
                  return null;
                }
              )}
            </Card>
          ))}
        </Stack>
      );
    }

    default:
      return null;
  }
}

function ValidationAlerts({ results }: { results: ValidationResult[] }) {
  if (!results.length) return null;
  const colorMap = { error: "red", warning: "yellow", info: "blue" } as const;
  return (
    <Stack gap="xs" mt="md">
      {results.map((result, i) => (
        <Alert
          key={i}
          color={colorMap[result.severity]}
          title={
            result.severity.charAt(0).toUpperCase() + result.severity.slice(1)
          }
        >
          {result.message}
          {result.field && (
            <Text size="xs" c="dimmed">
              {" "}
              ({result.field})
            </Text>
          )}
        </Alert>
      ))}
    </Stack>
  );
}

export function PropertyPanel() {
  const {
    getComponentProps,
    updateInstanceProps,
    validateInstance,
    getEditingExtension,
    findInstance,
  } = useComponentRegistry();
  const { selectedInstanceId } = useEditor();
  const labels = useEditorLabels();

  const instance: Instance | null = findInstance(selectedInstanceId);
  const metadata = instance ? getComponentProps(instance.id) : null;
  const fields = useInstanceFields(instance);

  if (!instance || !metadata) {
    return (
      <Text size="sm" c="dimmed">
        {labels.selectComponentPrompt}
      </Text>
    );
  }

  const instanceId = instance.props.instanceId;
  const validationResults = validateInstance(instanceId);

  const editableFields = fields.filter((f) => f.visible && !f.structural);

  const renderFields = (list: EditableInstanceField[]) =>
    list.map((field) => (
      <FieldInput key={field.key} field={field} instanceId={instanceId} />
    ));

  const renderExtension = (componentName: string) => {
    const ext = getEditingExtension(componentName);
    if (!ext) {
      return (
        <Alert color="yellow" variant="light">
          <Text size="sm">
            Extension &quot;{componentName}&quot; not registered
          </Text>
        </Alert>
      );
    }
    const ExtComponent = ext.Component;
    return (
      <ExtComponent
        instance={instance}
        updateProps={(updates) => updateInstanceProps(instanceId, updates)}
        get={(field) => instance.props[field]}
        metadata={metadata}
      />
    );
  };

  let body: React.ReactNode;
  if (metadata.propertyGroups) {
    const ungrouped = editableFields.filter((f) => f.group == null);
    body = (
      <Tabs
        defaultValue={
          metadata.propertyGroups[0]?.title || labels.propertiesOtherTab
        }
      >
        <Tabs.List>
          {metadata.propertyGroups.map((group) => (
            <Tabs.Tab key={group.title} value={group.title}>
              {group.title}
            </Tabs.Tab>
          ))}
          {ungrouped.length > 0 && (
            <Tabs.Tab value={labels.propertiesOtherTab}>
              {labels.propertiesOtherTab}
            </Tabs.Tab>
          )}
        </Tabs.List>

        {metadata.propertyGroups.map((group) => (
          <Tabs.Panel key={group.title} value={group.title} pt="md">
            <Stack gap="md">
              {"component" in group &&
                group.component &&
                renderExtension(group.component)}
              {"properties" in group &&
                group.properties &&
                renderFields(
                  editableFields.filter((f) => f.group === group.title)
                )}
            </Stack>
          </Tabs.Panel>
        ))}

        {ungrouped.length > 0 && (
          <Tabs.Panel value={labels.propertiesOtherTab} pt="md">
            <Stack gap="md">{renderFields(ungrouped)}</Stack>
          </Tabs.Panel>
        )}
      </Tabs>
    );
  } else {
    body = <Stack gap="md">{renderFields(editableFields)}</Stack>;
  }

  return (
    <Card shadow="sm" padding="md" withBorder data-testid="property-panel">
      <Stack gap="sm">
        <div>
          <Text size="md" fw={700} c="dark">
            {metadata.name || instance.id}
          </Text>
          {metadata.description && (
            <Text size="xs" c="dimmed">
              {metadata.description}
            </Text>
          )}
        </div>
        <Box component="form">
          {body}
          <ValidationAlerts results={validationResults} />
        </Box>
      </Stack>
    </Card>
  );
}

export default PropertyPanel;
