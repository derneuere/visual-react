import React from "react";

import { Block } from "@derneuere/visual-react/editor";

const alignments: Record<string, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
  stretch: "stretch",
};

const backgroundColors: Record<string, string> = {
  primary: "#3C74CA",
  secondary: "#F8FBFF",
  tertiary: "#FEFEFE",
  transparent: "transparent",
};

const boxShadowValues: Record<string, string> = {
  none: "none",
  small: "0 1px 3px rgba(0,0,0,0.12)",
  medium: "0 4px 6px rgba(0,0,0,0.1)",
  large: "0 10px 20px rgba(0,0,0,0.15)",
  xl: "0 20px 40px rgba(0,0,0,0.2)",
};

const overlayValues: Record<string, string> = {
  none: "",
  "dark-30": "rgba(0,0,0,0.3)",
  "dark-50": "rgba(0,0,0,0.5)",
  "dark-70": "rgba(0,0,0,0.7)",
  "light-30": "rgba(255,255,255,0.3)",
  "light-50": "rgba(255,255,255,0.5)",
  "light-70": "rgba(255,255,255,0.7)",
};

const Section = ({
  children = [],
  instanceId,
  alignment,
  backgroundColor,
  height,
  width,
  noPadding,
  padding,
  verticalCenter,
  gap,
  horizontalCenter,
  // New layout props
  flexDirection = "column",
  flexWrap = "nowrap",
  justifyContent: justifyContentProp = "flex-start",
  overflow,
  // New background props
  backgroundImage,
  backgroundSize = "cover",
  backgroundPosition = "center",
  backgroundOverlay = "none",
  // New border props
  borderRadius = 0,
  borderWidth = 0,
  borderColor = "#e2e8f0",
  // New effects props
  boxShadow: boxShadowProp = "none",
  opacity = 100,
}: any) => {
  // Backwards compatibility: if verticalCenter is true and justifyContent is at default, use "center"
  const resolvedJustifyContent =
    verticalCenter && justifyContentProp === "flex-start"
      ? "center"
      : justifyContentProp;

  // Build background-image CSS value with optional overlay
  let bgImageCSS: string | undefined;
  if (backgroundImage) {
    const overlayColor = overlayValues[backgroundOverlay] || "";
    bgImageCSS = overlayColor
      ? `linear-gradient(${overlayColor}, ${overlayColor}), url(${backgroundImage})`
      : `url(${backgroundImage})`;
  }

  return (
    <Block
      style={{
        padding: noPadding ? "0px" : padding,
        backgroundColor: backgroundColors[backgroundColor] || "#f7f7f7",
        display: "flex",
        flexDirection,
        flexWrap,
        alignItems: alignments[alignment] || "flex-start",
        justifyContent: resolvedJustifyContent,
        minHeight: height || "auto",
        boxSizing: "border-box",
        maxWidth: width,
        gap,
        margin: horizontalCenter ? "0 auto" : "",
        ...(overflow && overflow !== "visible" && { overflow }),
        // Background image
        ...(bgImageCSS && {
          backgroundImage: bgImageCSS,
          backgroundSize,
          backgroundPosition,
          backgroundRepeat: "no-repeat",
        }),
        // Border
        borderRadius: borderRadius > 0 ? `${borderRadius}px` : undefined,
        ...(borderWidth > 0 && {
          borderWidth: `${borderWidth}px`,
          borderStyle: "solid" as const,
          borderColor,
        }),
        // Effects
        boxShadow: boxShadowValues[boxShadowProp] || "none",
        opacity: opacity < 100 ? opacity / 100 : undefined,
      }}
      parentId={instanceId}
      items={children}
    />
  );
};

export default Section;

export const metadata = {
  name: "Section",
  category: "Layout",
  defaultProps: {
    children: [],
    alignment: "stretch",
    backgroundColor: "primary",
    height: "auto",
    width: "100%",
    noPadding: false,
    padding: "5rem",
    verticalCenter: false,
    horizontalCenter: true,
    gap: "5rem",
    // New layout
    flexDirection: "column",
    flexWrap: "nowrap",
    justifyContent: "flex-start",
    overflow: "visible",
    // New background
    backgroundImage: "",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundOverlay: "none",
    // New border
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "#e2e8f0",
    // New effects
    boxShadow: "none",
    opacity: 100,
  },
  editableProps: {
    // Layout
    flexDirection: {
      type: "enum",
      options: ["column", "row", "column-reverse", "row-reverse"],
    },
    alignment: {
      type: "enum",
      options: ["left", "center", "right", "stretch"],
    },
    justifyContent: {
      type: "enum",
      options: [
        "flex-start",
        "center",
        "flex-end",
        "space-between",
        "space-around",
        "space-evenly",
      ],
    },
    flexWrap: {
      type: "enum",
      options: ["nowrap", "wrap"],
    },
    gap: "string",
    overflow: {
      type: "enum",
      options: ["visible", "hidden", "auto", "scroll"],
    },
    // Spacing
    noPadding: "boolean",
    padding: "string",
    horizontalCenter: "boolean",
    // Size
    width: "string",
    height: "string",
    // Background
    backgroundColor: {
      type: "enum",
      options: ["primary", "secondary", "tertiary", "transparent"],
    },
    backgroundImage: "image",
    backgroundSize: {
      type: "enum",
      options: ["cover", "contain", "auto"],
    },
    backgroundPosition: {
      type: "enum",
      options: [
        "center",
        "top",
        "bottom",
        "left",
        "right",
        "top left",
        "top right",
        "bottom left",
        "bottom right",
      ],
    },
    backgroundOverlay: {
      type: "enum",
      options: [
        "none",
        "dark-30",
        "dark-50",
        "dark-70",
        "light-30",
        "light-50",
        "light-70",
      ],
    },
    // Border
    borderRadius: { type: "slider", min: 0, max: 48, step: 4 },
    borderWidth: { type: "slider", min: 0, max: 8, step: 1 },
    borderColor: {
      type: "enum",
      options: [
        "#e2e8f0",
        "#cbd5e1",
        "#94a3b8",
        "#334155",
        "#3C74CA",
        "transparent",
      ],
    },
    // Effects
    boxShadow: {
      type: "enum",
      options: ["none", "small", "medium", "large", "xl"],
    },
    opacity: { type: "slider", min: 0, max: 100, step: 5 },
    // Content
    children: "componentlist",
  },
  propertyGroups: [
    {
      title: "Layout",
      properties: [
        "flexDirection",
        "alignment",
        "justifyContent",
        "flexWrap",
        "gap",
        "overflow",
      ],
    },
    {
      title: "Spacing",
      properties: ["noPadding", "padding", "horizontalCenter"],
    },
    {
      title: "Size",
      properties: ["width", "height"],
    },
    {
      title: "Background",
      properties: [
        "backgroundColor",
        "backgroundImage",
        "backgroundSize",
        "backgroundPosition",
        "backgroundOverlay",
      ],
    },
    {
      title: "Border",
      properties: ["borderRadius", "borderWidth", "borderColor"],
    },
    {
      title: "Effects",
      properties: ["boxShadow", "opacity"],
    },
    {
      title: "Content",
      properties: ["children"],
    },
  ],
  fieldMetadata: {
    flexDirection: {
      label: "Direction",
      description: "Controls whether children stack vertically or horizontally",
    },
    alignment: {
      label: "Align Items",
      description: "How children align on the cross axis",
    },
    justifyContent: {
      label: "Distribute",
      description: "How children are distributed along the main axis",
    },
    flexWrap: {
      label: "Wrap",
      description: "Allow items to wrap to the next line",
    },
    gap: {
      label: "Gap",
      description: "Space between child elements (e.g. 1rem, 16px)",
    },
    overflow: {
      label: "Overflow",
      description: "How content that exceeds the section bounds is handled",
    },
    noPadding: {
      label: "No Padding",
    },
    padding: {
      label: "Padding",
      description: "Inner spacing (e.g. 2rem, 16px 24px)",
    },
    horizontalCenter: {
      label: "Center Horizontally",
      description: "Centers the section within its parent",
    },
    width: {
      label: "Max Width",
      description: "Maximum width of the section (e.g. 1200px, 100%)",
    },
    height: {
      label: "Min Height",
      description: "Minimum height of the section (e.g. 100vh, 400px)",
    },
    backgroundColor: {
      label: "Background Color",
    },
    backgroundImage: {
      label: "Background Image",
      description: "Sets a background image for the section",
    },
    backgroundSize: {
      label: "Image Size",
    },
    backgroundPosition: {
      label: "Image Position",
    },
    backgroundOverlay: {
      label: "Image Overlay",
      description: "Adds a color overlay to improve text readability",
    },
    borderRadius: {
      label: "Corner Radius",
      description: "Rounds the corners of the section",
    },
    borderWidth: {
      label: "Border Width",
    },
    borderColor: {
      label: "Border Color",
    },
    boxShadow: {
      label: "Shadow",
      description: "Adds a drop shadow around the section",
    },
    opacity: {
      label: "Opacity",
      warning: "Low opacity makes content harder to read",
    },
    children: {
      label: "Children",
    },
  },
  conditionalProperties: [
    {
      property: "backgroundSize",
      showIf: { field: "backgroundImage", notEquals: "" },
    },
    {
      property: "backgroundPosition",
      showIf: { field: "backgroundImage", notEquals: "" },
    },
    {
      property: "backgroundOverlay",
      showIf: { field: "backgroundImage", notEquals: "" },
    },
    {
      property: "borderColor",
      showIf: { field: "borderWidth", notEquals: 0 },
    },
    {
      property: "padding",
      showIf: { field: "noPadding", equals: false },
    },
    {
      property: "flexWrap",
      showIf: { field: "flexDirection", oneOf: ["row", "row-reverse"] },
    },
  ],
};
