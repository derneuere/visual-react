import React from "react";

import { Block } from "@derneuere/visual-react/editor";
import Map from "./Map";

const SectionWithMap = ({
  children = [],
  instanceId,
  alignment,
  height,
  width,
  verticalCenter,
  gap,
  horizontalCenter,
}) => {
  const alignments = {
    left: "flex-start",
    center: "center",
    right: "flex-end",
    stretch: "stretch",
  };

  return (
    <div
      style={{
        backgroundColor: "#F8FBFF",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "80rem",
          display: "flex",
        }}
      >
        <Block
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: alignments[alignment] || "flex-start",
            minHeight: height || "auto", // Default height is 'auto' if not provided
            boxSizing: "border-box",
            maxWidth: width,
            gap: gap,
            justifyContent: verticalCenter ? "center" : "",
            margin: horizontalCenter
              ? verticalCenter
                ? "auto"
                : "0 auto"
              : "",
          }}
          parentId={instanceId}
          items={children}
        ></Block>
        <Map
          marker={[]}
          position={[47.103354, 1.2]}
          noDragging={true}
          mapWidth={"40rem"}
          mapHeight={"40rem"}
        />
      </div>
    </div>
  );
};

export default SectionWithMap;

export const metadata = {
  name: "SectionWithMap",
  defaultProps: {
    children: [],
    alignment: "stretch",
    height: "auto",
    width: "100%",
    verticalCenter: false,
    horizontalCenter: true,
    gap: "5rem",
  },
  editableProps: {
    children: "componentlist",
    alignment: {
      type: "enum",
      options: ["left", "center", "right", "stretch"],
    },
    height: "string",
    width: "string",
    noPadding: "boolean",
    padding: "string",
    verticalCenter: "boolean",
    horizontalCenter: "boolean",
    gap: "string",
  },
};
