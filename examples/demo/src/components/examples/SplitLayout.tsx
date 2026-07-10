import React from "react";
import { Grid } from "@mantine/core";

import { Block } from "@derneuere/visual-react/editor";

const SplitLayout = ({ leftChildren = [], rightChildren = [], instanceId }) => {
  return (
    <Grid
      justify="center"
      align="stretch"
      type="container"
      breakpoints={{
        xs: "100px",
        sm: "200px",
        md: "300px",
        lg: "400px",
        xl: "500px",
      }}
    >
      {/* Left Section */}
      <Grid.Col span={{ base: 12, xl: 5.5 }}>
        <Block
          style={{ height: "100%" }}
          parentId={instanceId}
          items={leftChildren}
          itemsField="leftChildren"
        ></Block>
      </Grid.Col>

      <Grid.Col span={1}></Grid.Col>

      {/* Right Section */}
      <Grid.Col span={{ base: 12, xl: 5.5 }}>
        <Block
          style={{ height: "100%" }}
          parentId={instanceId}
          items={rightChildren}
          itemsField="rightChildren"
        ></Block>
      </Grid.Col>
    </Grid>
  );
};

export default SplitLayout;

export const metadata = {
  title: "Split Layout",
  category: "Layout",
  description: "A simple layout with two sections",
  defaultProps: {
    leftChildren: [],
    rightChildren: [],
  },
  editableProps: {
    leftChildren: "componentlist",
    rightChildren: "componentlist",
  },
};
