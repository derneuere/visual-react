import React, { useState } from "react";
import {
  Image as MantineImage,
  Card,
  Group,
  Text,
  ActionIcon,
} from "@mantine/core";
import { IconInfoCircle, IconX } from "@tabler/icons-react";

const Image = ({
  src = "https://images.pexels.com/photos/29879483/pexels-photo-29879483/free-photo-of-karussell-aus-holz-weihnachtsdekoration.jpeg",
  alt = "Placeholder image",
  width = "150",
  height = "150",
  fit = "cover",
  radius = 0,
  information,
  colorOfInformationIcon = "white",
}) => {
  const [showInfoText, setShowInfoText] = useState(false);
  const infoCard = (
    <Card
      radius="md"
      padding="lg"
      bg="transparent"
      style={{
        width: "25rem",
        border: "none",
        boxShadow: "none",
        backdropFilter: "blur(5px) grayscale(0.5)",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
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
    <div style={{ position: "relative" }}>
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
        >
          {infoCard}
        </div>
      )}
      <MantineImage
        src={src}
        alt={alt}
        height={height}
        style={{ width: width }}
        fit={fit}
        radius={radius}
        title={alt}
      />
      <ActionIcon
        variant="subtle"
        color={colorOfInformationIcon}
        style={{ position: "absolute", bottom: 5, right: 5, zIndex: 1 }}
        onClick={() => setShowInfoText(!showInfoText)}
      >
        <IconInfoCircle></IconInfoCircle>
      </ActionIcon>
    </div>
  );
};

export default Image;

export const metadata = {
  name: "Image",
  category: "Media",
  defaultProps: {
    src: "https://images.pexels.com/photos/29879483/pexels-photo-29879483/free-photo-of-karussell-aus-holz-weihnachtsdekoration.jpeg",
    alt: "Placeholder image",
    width: "100%",
    height: "150",
    fit: "cover",
    radius: 0,
    information: "",
    colorOfInformationIcon: "white",
  },
  editableProps: {
    src: "image",
    alt: "string",
    width: "string",
    height: "string",
    fit: {
      type: "enum",
      options: ["contain", "cover", "fill", "none", "scale-down"],
    },
    radius: "number",
    information: "text",
    colorOfInformationIcon: "string",
  },
};
