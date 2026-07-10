import React from "react";
import { Space as MantineSpace } from "@mantine/core";

const Space = ({ size = "md" }) => {
  return <MantineSpace h={size} />;
};

export default Space;

export const metadata = {
  name: "Space",
  defaultProps: {
    size: "md",
  },
  editableProps: {
    size: {
      type: "enum",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
};
