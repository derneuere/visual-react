import React from "react";
import { Button as MantineButton } from "@mantine/core";

const Button = ({
  label = "Click me",
  variant = "default",
  link = { url: "", title: "", target: "_self" },
}) => {
  const getVariantStyles = () => {
    if (variant === "primary") {
      return {
        gradient: { from: "cyan", to: "blue" },
        variant: "gradient",
      };
    }
    if (variant === "secondary") {
      return {
        color: "gray",
        variant: "light",
      };
    }
    return { variant: "outline" };
  };

  const styles = getVariantStyles();
  const href = typeof link === "string" ? link : link?.url || "";
  const target = typeof link === "string" ? "_self" : link?.target || "_self";

  return (
    <MantineButton
      {...styles}
      size="sm"
      radius="md"
      component="a"
      style={{ transition: "all 0.2s ease-in-out" }}
      href={href}
      target={target}
    >
      {label}
    </MantineButton>
  );
};

export default Button;

export const metadata = {
  name: "Button",
  category: "Interactive",
  defaultProps: {
    label: "Click me",
    isPrimary: false,
    variant: "default",
    link: { url: "", title: "", target: "_self" },
  },
  editableProps: {
    label: "string",
    isPrimary: "boolean",
    variant: {
      type: "enum",
      options: ["default", "primary", "secondary"],
    },
    link: "link",
  },
  propertyGroups: [
    { title: "Content", properties: ["label", "link"] },
    { title: "Style", properties: ["isPrimary", "variant"] },
  ],
  validate: (props: Record<string, any>) => {
    const results: { severity: "error" | "warning" | "info"; message: string; field?: string }[] = [];
    if (!props.label) {
      results.push({ severity: "error", message: "Label is required", field: "label" });
    }
    if (props.link?.url && !props.link.url.startsWith("http") && !props.link.url.startsWith("/")) {
      results.push({ severity: "warning", message: "Link should be a full URL (starting with http) or an internal path (starting with /)", field: "link" });
    }
    return results;
  },
};
