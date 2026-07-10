import React from "react";
import { FieldType, FieldMetadataEntry, Instance, LinkValue, ValidationResult } from "../../registry/types";
import { useEditor } from "../hooks";
import { useComponentRegistry } from "../../registry/hooks";
import { findNode } from "../../utils";
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
  Accordion,
  Tabs,
  Alert,
  Slider,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { IconArrowsMaximize } from "@tabler/icons-react";

import { RichTextEditor } from "../../components/RichTextEditor";
import AssetExplorer from "./AssetExplorer";

interface EditingTabProps {
  inModal?: boolean;
}

function EditingTab({ inModal = false }: EditingTabProps) {
  const {
    currentPage,
    updateInstanceProps,
    getComponentProps,
    hasChildren,
    getChildren,
    validateInstance,
    getEditingExtension,
  } = useComponentRegistry();

  const { selectedInstanceId, setEditModalOpen } = useEditor();

  const selectedInstance = findNode(
    currentPage,
    selectedInstanceId,
    hasChildren,
    getChildren
  );
  const metadata = selectedInstance && getComponentProps(selectedInstance.id);

  if (
    (!metadata && selectedInstance) ||
    (!metadata?.defaultProps && selectedInstance)
  ) {
    return null;
  }

  // Check if a property should be visible based on conditional properties
  const isPropertyVisible = (prop: string, instance: Instance): boolean => {
    if (!metadata?.conditionalProperties) return true;
    const condition = metadata.conditionalProperties.find(
      (c) => c.property === prop
    );
    if (!condition?.showIf) return true;

    const fieldValue = instance.props[condition.showIf.field];
    if (condition.showIf.equals !== undefined && fieldValue !== condition.showIf.equals) return false;
    if (condition.showIf.notEquals !== undefined && fieldValue === condition.showIf.notEquals) return false;
    if (condition.showIf.oneOf && !condition.showIf.oneOf.includes(fieldValue)) return false;
    return true;
  };

  // Helper to wrap a field with an optional warning alert
  const withWarning = (field: React.ReactNode, warning?: string) => {
    if (!warning) return field;
    return (
      <>
        {field}
        <Alert color="yellow" variant="light" p="xs" mt={4}>
          <Text size="xs">{warning}</Text>
        </Alert>
      </>
    );
  };

  const renderInputField = (
    prop: string,
    config: FieldType,
    instance: Instance,
    validationResults?: ValidationResult[]
  ) => {
    if (!instance) return null;
    const value = instance.props[prop];
    const fieldError = validationResults?.find(
      (v) => v.field === prop && v.severity === "error"
    );

    const fieldMeta: FieldMetadataEntry | undefined = metadata?.fieldMetadata?.[prop];
    const label = fieldMeta?.label || prop;
    const description = fieldMeta?.description;
    const warning = fieldMeta?.warning;

    if (config === "string") {
      return withWarning(
        <TextInput
          label={label}
          description={description}
          value={value || ""}
          onChange={(e) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: e.target.value,
            })
          }
          placeholder={`Enter ${label}`}
          error={fieldError?.message}
        />,
        warning
      );
    }

    if (config === "text" || (typeof config === "object" && config.type === "text")) {
      const toolbar = typeof config === "object" && config.type === "text" ? config.toolbar : undefined;
      return withWarning(
        <div>
          <Text size="sm">{label}</Text>
          {description && <Text size="xs" c="dimmed" mb={4}>{description}</Text>}
          <RichTextEditor
            value={value || ""}
            key={instance.props.instanceId + "richtext" + prop}
            onChange={(e) =>
              updateInstanceProps(instance.props.instanceId, {
                [prop]: e,
              })
            }
            toolbar={toolbar}
          />
        </div>,
        warning
      );
    }

    if (config === "number") {
      return withWarning(
        <NumberInput
          label={label}
          description={description}
          value={value || 0}
          onChange={(value) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: value,
            })
          }
          placeholder={`Enter ${label}`}
          error={fieldError?.message}
        />,
        warning
      );
    }

    if (config === "boolean") {
      return withWarning(
        <Checkbox
          label={label}
          description={description}
          checked={value || false}
          onChange={(e) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: e.target.checked,
            })
          }
        />,
        warning
      );
    }

    if (config === "date") {
      return withWarning(
        <TextInput
          type="date"
          label={label}
          description={description}
          value={value || ""}
          onChange={(e) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: e.target.value,
            })
          }
          error={fieldError?.message}
        />,
        warning
      );
    }

    if (config === "datetime") {
      const displayValue = value
        ? value.replace("Z", "").replace(/\+.*$/, "")
        : "";
      return withWarning(
        <TextInput
          type="datetime-local"
          label={label}
          description={description}
          value={displayValue}
          onChange={(e) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: e.target.value ? new Date(e.target.value).toISOString() : "",
            })
          }
          error={fieldError?.message}
        />,
        warning
      );
    }

    if (config === "link") {
      const linkValue: LinkValue = value || { url: "", title: "", target: "_self" };
      return withWarning(
        <Card withBorder padding="xs">
          <Text size="sm" fw={500} mb="xs">{label}</Text>
          {description && <Text size="xs" c="dimmed" mb="xs">{description}</Text>}
          <Stack gap="xs">
            <TextInput
              label="URL"
              value={linkValue.url || ""}
              onChange={(e) =>
                updateInstanceProps(instance.props.instanceId, {
                  [prop]: { ...linkValue, url: e.target.value },
                })
              }
              placeholder="https://..."
              error={fieldError?.message}
            />
            <TextInput
              label="Title"
              value={linkValue.title || ""}
              onChange={(e) =>
                updateInstanceProps(instance.props.instanceId, {
                  [prop]: { ...linkValue, title: e.target.value },
                })
              }
              placeholder="Link title"
            />
            <Select
              label="Target"
              value={linkValue.target || "_self"}
              onChange={(val) =>
                updateInstanceProps(instance.props.instanceId, {
                  [prop]: { ...linkValue, target: val as "_blank" | "_self" },
                })
              }
              data={[
                { value: "_self", label: "Same window" },
                { value: "_blank", label: "New window" },
              ]}
            />
          </Stack>
        </Card>,
        warning
      );
    }

    if (config === "stringlist") {
      return withWarning(
        <TagsInput
          label={label}
          description={description}
          value={value || []}
          onChange={(val) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: val,
            })
          }
          placeholder="Type and press Enter"
        />,
        warning
      );
    }

    if (typeof config === "object" && config.type === "enum") {
      return withWarning(
        <Select
          label={label}
          description={description}
          value={value || config.options[0]}
          onChange={(value) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: value,
            })
          }
          data={config.options.map((option) => ({
            value: option,
            label: option,
          }))}
        />,
        warning
      );
    }

    if (typeof config === "object" && config.type === "multienum") {
      return withWarning(
        <MultiSelect
          label={label}
          description={description}
          value={value || []}
          onChange={(val) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: val,
            })
          }
          data={config.options.map((option) => ({
            value: option,
            label: option,
          }))}
          placeholder="Select options"
        />,
        warning
      );
    }

    if (config === "image") {
      return withWarning(
        <div>
          <AssetExplorer
            label={label}
            value={value || ""}
            onChange={(value: string) =>
              updateInstanceProps(instance.props.instanceId, {
                [prop]: value,
              })
            }
          />
          {description && <Text size="xs" c="dimmed" mt={4}>{description}</Text>}
        </div>,
        warning
      );
    }

    if (typeof config === "object" && config.type === "number") {
      return withWarning(
        <Select
          label={label}
          description={description}
          value={(value ?? config.options[0]).toString()}
          onChange={(value) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: Number(value),
            })
          }
          data={config.options.map((option) => ({
            value: option.toString(),
            label: option.toString(),
          }))}
        />,
        warning
      );
    }

    if (typeof config === "object" && config.type === "slider") {
      return withWarning(
        <div>
          <Text size="sm" mb={4}>{label}: {value ?? config.min}</Text>
          {description && <Text size="xs" c="dimmed" mb={4}>{description}</Text>}
          <Slider
            value={value ?? config.min}
            onChange={(val) =>
              updateInstanceProps(instance.props.instanceId, {
                [prop]: val,
              })
            }
            min={config.min}
            max={config.max}
            step={config.step ?? 1}
            label={(val) => `${val}`}
          />
        </div>,
        warning
      );
    }

    if (typeof config === "object" && config.type === "color") {
      const swatch = (color: string) => (
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
      const current = typeof value === "string" ? value : "";
      return withWarning(
        <Select
          label={label}
          description={description}
          value={current || null}
          onChange={(val) =>
            updateInstanceProps(instance.props.instanceId, {
              [prop]: val,
            })
          }
          data={config.options.map((option) => ({
            value: option,
            label: option,
          }))}
          leftSection={current ? swatch(current) : undefined}
          renderOption={({ option }) => (
            <Group gap="xs" wrap="nowrap">
              {swatch(option.value)}
              <span>{option.label}</span>
            </Group>
          )}
          placeholder="Pick a color"
          error={fieldError?.message}
        />,
        warning
      );
    }

    if (
      config === "componentlist" ||
      (typeof config === "object" && config.type === "componentlist")
    ) {
      return (
        <Accordion>
          {instance.props[prop]?.map((component: any) => {
            const componentMetadata = getComponentProps(component.id);
            return (
              <Accordion.Item
                value={prop + " " + component.id}
                key={component.props.instanceId}
              >
                <Accordion.Control>
                  {prop + " " + component.id}
                </Accordion.Control>
                <Accordion.Panel>
                  {Object.entries(componentMetadata?.editableProps || {}).map(
                    ([childProp, childConfig]) => {
                      return (
                        <Group
                          key={childProp}
                          justify="apart"
                          align="center"
                          gap="md"
                        >
                          {renderInputField(childProp, childConfig, component)}
                        </Group>
                      );
                    }
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      );
    }

    if (typeof config === "object" && config.type === "objectlist") {
      const componentMetadata = getComponentProps(instance.id);
      return (
        <Stack>
          {instance.props[prop]?.map((dataobject: any, index: number) => {
            return (
              <Card key={index}>
                {Object.entries(
                  (componentMetadata?.editableProps[prop] as any)?.fields || {}
                ).map(([childProp, childConfig]) => {
                  if (childConfig === "string") {
                    return (
                      <TextInput
                        key={childProp}
                        label={childProp}
                        value={dataobject[childProp] || ""}
                        onChange={(e) =>
                          updateInstanceProps(instance.props.instanceId, {
                            [prop]: instance.props[prop].map((item: any) =>
                              item === dataobject
                                ? { ...item, [childProp]: e.target.value }
                                : item
                            ),
                          })
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
                          onChange={(e) =>
                            updateInstanceProps(instance.props.instanceId, {
                              [prop]: instance.props[prop].map((item: any) =>
                                item === dataobject
                                  ? { ...item, [childProp]: e }
                                  : item
                              ),
                            })
                          }
                        />
                      </div>
                    );
                  }
                  if (childConfig === "coordinates") {
                    return (
                      <Group key={childProp}>
                        <NumberInput
                          label="Latitude"
                          value={dataobject[childProp][0] || 0}
                          onChange={(value) =>
                            updateInstanceProps(instance.props.instanceId, {
                              [prop]: instance.props[prop].map((item: any) =>
                                item === dataobject
                                  ? {
                                      ...item,
                                      [childProp]: [
                                        value,
                                        item.coordinates[1],
                                      ],
                                    }
                                  : item
                              ),
                            })
                          }
                          placeholder={`Enter Latitude`}
                        />
                        <NumberInput
                          label="Longitude"
                          value={dataobject[childProp][1] || 0}
                          onChange={(value) =>
                            updateInstanceProps(instance.props.instanceId, {
                              [prop]: instance.props[prop].map((item: any) =>
                                item === dataobject
                                  ? {
                                      ...item,
                                      [childProp]: [
                                        item.coordinates[0],
                                        value,
                                      ],
                                    }
                                  : item
                              ),
                            })
                          }
                          placeholder={`Enter Longitude`}
                        />
                      </Group>
                    );
                  }
                  return null;
                })}
              </Card>
            );
          })}
        </Stack>
      );
    }
    return null;
  };

  // Get validation results for the selected instance
  const validationResults = selectedInstance
    ? validateInstance(selectedInstance.props.instanceId)
    : [];

  // Render a set of properties
  const renderProperties = (
    props: [string, FieldType][],
    instance: Instance
  ) => {
    return props
      .filter(([prop]) => isPropertyVisible(prop, instance))
      .map(([prop, config]) => (
        <Group key={prop} justify="apart" align="center" gap="md">
          {renderInputField(prop, config, instance, validationResults)}
        </Group>
      ));
  };

  // Render validation alerts
  const renderValidation = (results: ValidationResult[]) => {
    if (!results.length) return null;
    const colorMap = { error: "red", warning: "yellow", info: "blue" };
    return (
      <Stack gap="xs" mt="md">
        {results.map((result, i) => (
          <Alert
            key={i}
            color={colorMap[result.severity]}
            title={result.severity.charAt(0).toUpperCase() + result.severity.slice(1)}
          >
            {result.message}
            {result.field && (
              <Text size="xs" c="dimmed"> ({result.field})</Text>
            )}
          </Alert>
        ))}
      </Stack>
    );
  };

  const componentName = metadata?.name || selectedInstance?.id || "";

  const formContent = selectedInstance && metadata ? (
    <Box component="form">
      {metadata.propertyGroups ? (
        <Tabs defaultValue={metadata.propertyGroups[0]?.title || "Other"}>
          <Tabs.List>
            {metadata.propertyGroups.map((group) => (
              <Tabs.Tab key={group.title} value={group.title}>
                {group.title}
              </Tabs.Tab>
            ))}
            {/* Show "Other" tab for ungrouped props */}
            {(() => {
              const groupedProps = new Set(
                metadata.propertyGroups!.flatMap((g) =>
                  'properties' in g && g.properties ? g.properties : []
                )
              );
              const ungrouped = Object.keys(metadata.editableProps).filter(
                (p) => !groupedProps.has(p)
              );
              return ungrouped.length > 0 ? (
                <Tabs.Tab value="Other">Other</Tabs.Tab>
              ) : null;
            })()}
          </Tabs.List>

          {metadata.propertyGroups.map((group) => (
            <Tabs.Panel key={group.title} value={group.title} pt="md">
              <Stack gap="md">
                {'component' in group && group.component && (() => {
                  const ext = getEditingExtension(group.component);
                  if (ext) {
                    const ExtComponent = ext.Component;
                    return (
                      <ExtComponent
                        instance={selectedInstance}
                        updateProps={(updates) =>
                          updateInstanceProps(selectedInstance.props.instanceId, updates)
                        }
                        get={(field) => selectedInstance.props[field]}
                        metadata={metadata}
                      />
                    );
                  }
                  return (
                    <Alert color="yellow" variant="light">
                      <Text size="sm">Extension &quot;{group.component}&quot; not registered</Text>
                    </Alert>
                  );
                })()}
                {'properties' in group && group.properties &&
                  renderProperties(
                    group.properties
                      .filter((p) => p in metadata.editableProps)
                      .map((p) => [p, metadata.editableProps[p]]),
                    selectedInstance
                  )
                }
              </Stack>
            </Tabs.Panel>
          ))}

          {/* Render ungrouped props under "Other" tab */}
          {(() => {
            const groupedProps = new Set(
              metadata.propertyGroups!.flatMap((g) =>
                'properties' in g && g.properties ? g.properties : []
              )
            );
            const ungrouped = Object.entries(metadata.editableProps).filter(
              ([p]) => !groupedProps.has(p)
            );
            return ungrouped.length > 0 ? (
              <Tabs.Panel value="Other" pt="md">
                <Stack gap="md">{renderProperties(ungrouped, selectedInstance)}</Stack>
              </Tabs.Panel>
            ) : null;
          })()}
        </Tabs>
      ) : (
        <Stack gap="md">
          {renderProperties(
            Object.entries(metadata.editableProps),
            selectedInstance
          )}
        </Stack>
      )}
      {renderValidation(validationResults)}
    </Box>
  ) : (
    <Text size="sm" c="dimmed">
      Select a component to edit
    </Text>
  );

  if (inModal) {
    return <>{formContent}</>;
  }

  return (
    <Card shadow="sm" padding="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <div>
            <Text size="md" fw={700} c="dark">
              Edit Component
            </Text>
            {componentName && (
              <Text size="xs" c="dimmed">
                {componentName}
              </Text>
            )}
          </div>
          <Tooltip label="Expand to modal">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => setEditModalOpen(true)}
            >
              <IconArrowsMaximize size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {formContent}
      </Stack>
    </Card>
  );
}

export default EditingTab;
