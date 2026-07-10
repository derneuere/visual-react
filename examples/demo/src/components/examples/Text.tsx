import React from "react";
import { Text as MantineText } from "@mantine/core";

const Text = ({
  content = "Default text content",
  size = "md",
  color = "black",
  alignment = "left",
}) => {
  return (
    <MantineText
      size={size}
      style={{ color, textAlign: alignment }}
      dangerouslySetInnerHTML={{ __html: content }}
    ></MantineText>
  );
};

export default Text;

export const metadata = {
  name: "Text",
  category: "Content",
  defaultProps: {
    content: "Default text content",
    size: "md",
    color: "black",
    alignment: "left",
  },
  editableProps: {
    content: "text",
    size: {
      type: "enum",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
    color: {
      type: "color",
      options: ["black", "gray", "blue", "red", "green", "yellow"],
    },
    alignment: {
      type: "enum",
      options: ["left", "center", "right"],
    },
  },
};
