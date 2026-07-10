import React from "react";
import { Title as MantineTitle } from "@mantine/core";

import { TitleOrder } from "@mantine/core";

const Title = ({
  label = "Very important Header",
  size = 1 as TitleOrder,
  alignment = "center",
  color = "dark",
}) => {
  return (
    <MantineTitle
      order={size}
      style={{
        textAlign: alignment,
        whiteSpace: "normal",
        wordBreak: "break-word",
      }}
      c={color}
      textWrap="wrap"
    >
      {label}
    </MantineTitle>
  );
};

export default Title;

export const metadata = {
  name: "Title",
  category: "Content",
  defaultProps: {
    label: "Very important Header",
    size: 1,
    alignment: "center",
    color: "dark",
  },
  editableProps: {
    label: "string",
    size: {
      type: "number",
      options: [1, 2, 3, 4, 5, 6],
    },
    alignment: {
      type: "enum",
      options: ["left", "center", "right"],
    },
    color: {
      type: "enum",
      options: ["dark", "white"],
    },
  },
};
