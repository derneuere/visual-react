import React, { useState } from "react";
import { Block } from "@derneuere/visual-react/editor";
import { ActionIcon, Text, Group, Card } from "@mantine/core";
import { IconInfoCircle, IconX } from "@tabler/icons-react";

const LandingPageImageSection = ({
  children = [],
  instanceId,
  backgroundImage,
  information,
  alt,
}) => {
  const [showInfoText, setShowInfoText] = useState(false);

  const infoCard = (
    <Card
      radius="md"
      padding="lg"
      bg="transparent"
      style={{
        border: "none",
        boxShadow: "none",
        backdropFilter: "blur(5px) grayscale(0.5)",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        width: "40rem",
      }}
    >
      <Group justify="space-between">
        <Group>
          <IconInfoCircle color="white" />
          <Text ta="center" c="white" fz="lg" fw={500}>
            Bildinformation
          </Text>
        </Group>
        <ActionIcon
          variant="subtle"
          c="black"
          onClick={() => setShowInfoText(!showInfoText)}
        >
          <IconX color="white" />
        </ActionIcon>
      </Group>
      <Text
        ta="center"
        c="white"
        dangerouslySetInnerHTML={{
          __html: information,
        }}
      ></Text>
    </Card>
  );

  return (
    <div style={{ position: "relative" }} title={alt}>
      {showInfoText && (
        <div
          style={{
            backgroundColor: "transparent",
            width: "100%",
            height: "100%",
            position: "absolute",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            margin: "0 auto",
            padding: "4rem",
          }}
          aria-label={alt}
        >
          {infoCard}
        </div>
      )}
      <Block
        style={{
          backgroundImage: backgroundImage
            ? `linear-gradient(rgba(0,0,0, 0) 70%,rgba(0,0,0, 1) 100%), url(${backgroundImage})`
            : "",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          minHeight: "calc(100vh - 120px)", // Default height is 'auto' if not provided
          boxSizing: "border-box",
          maxWidth: "100%",
          justifyContent: "flex-end",
          margin: "0 auto",
          padding: "6rem",
        }}
        parentId={instanceId}
        items={showInfoText ? [] : children}
      ></Block>
      <ActionIcon
        variant="subtle"
        color="white"
        style={{ position: "absolute", bottom: 5, right: 5, zIndex: 1 }}
        onClick={() => setShowInfoText(!showInfoText)}
      >
        <IconInfoCircle></IconInfoCircle>
      </ActionIcon>
    </div>
  );
};

export default LandingPageImageSection;

export const metadata = {
  name: "LandingPageImageSection",
  defaultProps: {
    children: [],
    backgroundImage: "",
    information: "",
    alt: "",
  },
  editableProps: {
    backgroundImage: "image",
    information: "text",
    alt: "string",
    children: "componentlist",
  },
};
