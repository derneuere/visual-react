import { describe, it, expect } from "vitest";
import type { ComponentMetadata, Instance } from "../registry/types";
import {
  computeInstanceFields,
  fieldTypeName,
  isPropertyVisible,
} from "./instanceFields";

const metadata: ComponentMetadata = {
  name: "Kitchen Sink",
  defaultProps: {},
  editableProps: {
    title: "string",
    body: { type: "text", toolbar: ["bold", "italic"] },
    visible: "boolean",
    count: "number",
    size: { type: "number", options: [1, 2, 3] },
    photo: "image",
    day: "date",
    at: "datetime",
    cta: "link",
    tags: "stringlist",
    variant: { type: "enum", options: ["a", "b"] },
    features: { type: "multienum", options: ["x", "y"] },
    opacity: { type: "slider", min: 0, max: 100, step: 5 },
    background: { type: "color", options: ["#fff", "#000"] },
    children: { type: "componentlist" },
    legacyChildren: "componentlist",
    items: { type: "objectlist" },
  },
  fieldMetadata: {
    title: { label: "Title", description: "Main heading", warning: "Keep it short" },
  },
  propertyGroups: [
    { title: "Content", properties: ["title", "body"] },
    { title: "Style", properties: ["background", "opacity"] },
  ],
  conditionalProperties: [
    { property: "photo", showIf: { field: "visible", equals: true } },
    { property: "day", showIf: { field: "variant", oneOf: ["b"] } },
    { property: "at", showIf: { field: "variant", notEquals: "a" } },
  ],
};

const instance: Instance = {
  id: "sink",
  props: {
    instanceId: "i1",
    title: "Hello",
    visible: false,
    variant: "a",
    opacity: 40,
  },
};

describe("fieldTypeName", () => {
  it("maps string shorthands to themselves", () => {
    expect(fieldTypeName("string")).toBe("string");
    expect(fieldTypeName("componentlist")).toBe("componentlist");
  });

  it("collapses object forms onto their .type", () => {
    expect(fieldTypeName({ type: "enum", options: [] })).toBe("enum");
    expect(fieldTypeName({ type: "color", options: [] })).toBe("color");
    expect(fieldTypeName({ type: "objectlist" })).toBe("objectlist");
    expect(fieldTypeName({ type: "slider", min: 0, max: 1 })).toBe("slider");
    expect(fieldTypeName({ type: "text" })).toBe("text");
    expect(fieldTypeName({ type: "componentlist" })).toBe("componentlist");
  });
});

describe("computeInstanceFields", () => {
  const fields = computeInstanceFields(metadata, instance);
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));

  it("returns every editable prop in metadata entry order", () => {
    expect(fields.map((f) => f.key)).toEqual(
      Object.keys(metadata.editableProps)
    );
  });

  it("normalizes every FieldType (incl. color/objectlist/componentlist)", () => {
    expect(byKey.title.fieldType).toBe("string");
    expect(byKey.body.fieldType).toBe("text");
    expect(byKey.visible.fieldType).toBe("boolean");
    expect(byKey.count.fieldType).toBe("number");
    expect(byKey.size.fieldType).toBe("number");
    expect(byKey.photo.fieldType).toBe("image");
    expect(byKey.day.fieldType).toBe("date");
    expect(byKey.at.fieldType).toBe("datetime");
    expect(byKey.cta.fieldType).toBe("link");
    expect(byKey.tags.fieldType).toBe("stringlist");
    expect(byKey.variant.fieldType).toBe("enum");
    expect(byKey.features.fieldType).toBe("multienum");
    expect(byKey.opacity.fieldType).toBe("slider");
    expect(byKey.background.fieldType).toBe("color");
    expect(byKey.children.fieldType).toBe("componentlist");
    expect(byKey.legacyChildren.fieldType).toBe("componentlist");
    expect(byKey.items.fieldType).toBe("objectlist");
  });

  it("flags componentlist descriptors as structural (both spellings)", () => {
    expect(byKey.children.structural).toBe(true);
    expect(byKey.legacyChildren.structural).toBe(true);
    expect(byKey.title.structural).toBe(false);
    expect(byKey.items.structural).toBe(false);
  });

  it("carries label/description/warning from fieldMetadata", () => {
    expect(byKey.title.label).toBe("Title");
    expect(byKey.title.description).toBe("Main heading");
    expect(byKey.title.warning).toBe("Keep it short");
    // fallback: label = key
    expect(byKey.count.label).toBe("count");
  });

  it("extracts options, slider bounds and text toolbar", () => {
    expect(byKey.variant.options).toEqual(["a", "b"]);
    expect(byKey.size.options).toEqual([1, 2, 3]);
    expect(byKey.background.options).toEqual(["#fff", "#000"]);
    expect(byKey.opacity.min).toBe(0);
    expect(byKey.opacity.max).toBe(100);
    expect(byKey.opacity.step).toBe(5);
    expect(byKey.body.toolbar).toEqual(["bold", "italic"]);
    expect(byKey.title.options).toBeUndefined();
    expect(byKey.title.min).toBeUndefined();
  });

  it("assigns propertyGroups titles (null for ungrouped)", () => {
    expect(byKey.title.group).toBe("Content");
    expect(byKey.background.group).toBe("Style");
    expect(byKey.count.group).toBeNull();
  });

  it("resolves conditionalProperties into visible", () => {
    // photo: showIf visible === true, but visible is false
    expect(byKey.photo.visible).toBe(false);
    // day: showIf variant oneOf ["b"], but variant is "a"
    expect(byKey.day.visible).toBe(false);
    // at: showIf variant !== "a", but variant IS "a"
    expect(byKey.at.visible).toBe(false);
    // unconditioned fields stay visible
    expect(byKey.title.visible).toBe(true);

    const shown = computeInstanceFields(metadata, {
      ...instance,
      props: { ...instance.props, visible: true, variant: "b" },
    });
    const shownByKey = Object.fromEntries(shown.map((f) => [f.key, f]));
    expect(shownByKey.photo.visible).toBe(true);
    expect(shownByKey.day.visible).toBe(true);
    expect(shownByKey.at.visible).toBe(true);
  });

  it("reads current values from instance props", () => {
    expect(byKey.title.value).toBe("Hello");
    expect(byKey.opacity.value).toBe(40);
    expect(byKey.count.value).toBeUndefined();
  });

  it("attaches per-field validation results and the first error message", () => {
    const results = computeInstanceFields(metadata, instance, [
      { severity: "warning", message: "meh", field: "title" },
      { severity: "error", message: "too long", field: "title" },
      { severity: "error", message: "unrelated", field: "count" },
      { severity: "info", message: "global (no field)" },
    ]);
    const title = results.find((f) => f.key === "title")!;
    expect(title.validation).toHaveLength(2);
    expect(title.error).toBe("too long");
    const body = results.find((f) => f.key === "body")!;
    expect(body.validation).toEqual([]);
    expect(body.error).toBeUndefined();
  });
});

describe("isPropertyVisible", () => {
  it("defaults to visible without conditionalProperties", () => {
    const meta: ComponentMetadata = {
      name: "x",
      defaultProps: {},
      editableProps: { a: "string" },
    };
    expect(isPropertyVisible(meta, "a", instance)).toBe(true);
  });
});
