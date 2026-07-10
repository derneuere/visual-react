import React, { useEffect, useState } from "react";
import franceGeoJSON from "../../assets/france.json";
import ReactDOMServer from "react-dom/server"; // Import ReactDOMServer at the top
import { Carousel } from "@mantine/carousel";
import {
  Card,
  Text,
  Button,
  Textarea,
  TextInput,
  Group,
  NativeSelect,
  Stack,
  Modal,
  ScrollArea,
} from "@mantine/core";
import { IconMapPin, IconPointFilled } from "@tabler/icons-react";

let MapContainer, GeoJSON, Marker, Popup, divIcon;

const Map = (props) => {
  const { marker, position, noDragging, mapHeight, mapWidth, notes } = props;

  const [isClient, setIsClient] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [modalOpened, setModalOpened] = useState(false);

  const centerPointOfFrance = [46.603354, 1.888334];

  useEffect(() => {
    (async () => {
      const leaflet = await import("react-leaflet");
      MapContainer = leaflet.MapContainer;
      GeoJSON = leaflet.GeoJSON;
      Marker = leaflet.Marker;
      Popup = leaflet.Popup;

      const L = await import("leaflet");
      divIcon = L.divIcon;

      setIsClient(true);
    })();
  }, []);

  if (!isClient) {
    return <div>Loading map...</div>;
  }

  const geoJSONStyle = {
    color: "#3C74CA",
    weight: 2,
    fillColor: "#3C74CA",
    fillOpacity: 0.3,
  };

  const handleMarkerClick = (place) => {
    setSelectedPlace(place);
  };

  // Function to generate a custom icon with dynamic color
  const getCustomIcon = (isSelected) => {
    return divIcon({
      html: ReactDOMServer.renderToStaticMarkup(
        <>
          {isSelected && <IconMapPin size={75} color="#003366" />}
          {!isSelected && (
            <IconPointFilled
              size={50}
              style={{
                color: "#003366",
              }}
            />
          )}
        </>
      ),
      className: "custom-marker",
      iconSize: isSelected ? [75, 75] : [50, 50],
      iconAnchor: isSelected ? [37.5, 75] : [25, 50],
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        maxWidth: "80rem",
      }}
    >
      <MapContainer
        center={position ? position : centerPointOfFrance}
        zoom={6}
        style={{
          height: mapHeight || "500px",
          width: mapWidth || "50%",
          backgroundColor: "transparent",
          zIndex: 0,
        }}
        zoomControl={false}
        scrollWheelZoom={false}
        touchZoom={false}
        attributionControl={false}
        dragging={noDragging ? false : true}
        doubleClickZoom={false}
      >
        <GeoJSON data={franceGeoJSON} style={geoJSONStyle}>
          {marker.map((poi, index) => (
            <Marker
              key={index}
              position={poi.coordinates}
              icon={getCustomIcon(selectedPlace === poi)}
              eventHandlers={{
                click: () => handleMarkerClick(poi),
              }}
            ></Marker>
          ))}
        </GeoJSON>
      </MapContainer>

      {selectedPlace && (
        <Card
          shadow="sm"
          padding="sm"
          withBorder
          style={{
            backgroundColor: "var(--mantine-color-dark-7))",
            width: "30rem",
            height: "30rem",
          }}
        >
          <Carousel withIndicators emblaOptions={{ loop: true }}>
            <Carousel.Slide>
              <div style={{ padding: "3rem" }}>
                <ScrollArea h={400}>
                  <Text fz="lg" fw={500}>
                    {selectedPlace.name}
                  </Text>
                  <Text
                    fz="sm"
                    mt="xs"
                    dangerouslySetInnerHTML={{
                      __html: selectedPlace.description,
                    }}
                  ></Text>
                  <Button
                    radius="md"
                    variant="outline"
                    mt="md"
                    onClick={() => setModalOpened(true)}
                  >
                    Teilen Sie ihre Erfahrungen hier!
                  </Button>
                </ScrollArea>
              </div>
            </Carousel.Slide>

            {/* Second Slide: User Notes */}
            <Carousel.Slide>
              <div style={{ padding: "3rem" }}>
                <Stack gap="sm">
                  <Text fz="lg" fw={500}>
                    Persönliche Berichte
                  </Text>
                  {notes
                    .filter((note) => selectedPlace.name.includes(note.place))
                    .map((note, index) => (
                      <Card withBorderkey={index} shadow="sm" mt="md">
                        <Text fz="md" fw={500} mt="md">
                          {note.title}
                        </Text>
                        <Text fz="sm" c="dimmed" mt={5}>
                          {note.content}
                        </Text>
                      </Card>
                    ))}
                  <Button
                    variant="outline"
                    mt="md"
                    onClick={() => setModalOpened(true)}
                  >
                    Teilen Sie ihre Erfahrungen hier!
                  </Button>
                </Stack>
              </div>
            </Carousel.Slide>
          </Carousel>
        </Card>
      )}

      {/* Modal for Third Slide */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Teile deine Informationen"
      >
        <Stack>
          <NativeSelect
            label="Lager auswählen"
            description="Wähle ein Lager"
            data={marker.map((poi) => poi.name)}
          />
          <TextInput
            label="Titel des Beitrags"
            placeholder="Füge hier deinen Titel hinzu"
          />
          <Textarea
            label="Deine Nachricht"
            placeholder="Füge hier deine Nachricht hinzu"
            style={{ height: "10rem" }}
          />
          <Group justify="right">
            <Button
              type="submit"
              onClick={() => {
                setModalOpened(false);
              }}
            >
              Beitrag freigeben
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};

export default Map;

export const metadata = {
  name: "Karte mit GeoJSON",
  description:
    "Eine Kartenkomponente mit GeoJSON-Daten für Frankreich, integriert mit einem Karussell zur Anzeige von Details zu Orten, Notizen und einem Formular für Beiträge.",
  defaultProps: {
    marker: [
      {
        name: "Poitiers",
        coordinates: [46.5802, 0.3404],
        description:
          "Ein ehemaliges Lager für deutsche Kriegsgefangene, bekannt für schwierige Arbeitsbedingungen und eine hohe Anzahl an Insassen.",
      },
      {
        name: "Dunkerque",
        coordinates: [51.0344, 2.3777],
        description:
          "Standort eines wichtigen Lagers für Kriegsgefangene, die nach dem Zweiten Weltkrieg in der Region zur Wiederherstellung der Infrastruktur eingesetzt wurden.",
      },
      {
        name: "Auxerre",
        coordinates: [47.7982, 3.573],
        description:
          "Ein kleines Lager, das deutsche Kriegsgefangene beherbergte, die in der Landwirtschaft und bei Wiederaufbauarbeiten halfen.",
      },
      {
        name: "Vitry-le-François",
        coordinates: [48.7208, 4.5849],
        description:
          "Ein zentral gelegenes Lager, in dem Kriegsgefangene hauptsächlich in der Landwirtschaft und bei der Reparatur von Kriegszerstörungen eingesetzt wurden.",
      },
    ],
    notes: [
      {
        place: "Poitiers",
        title: "Harte Arbeitsbedingungen",
        content:
          "Die Gefangenen mussten oft schwere Arbeiten unter schlechten Bedingungen verrichten. Es gab Berichte über Unterernährung und Krankheiten.",
      },
      {
        place: "Dunkerque",
        title: "Infrastrukturwiederaufbau",
        content:
          "Hier wurden Kriegsgefangene eingesetzt, um beschädigte Häfen und Straßen wieder aufzubauen. Ihre Arbeit war entscheidend für die Wiederherstellung der Region.",
      },
      {
        place: "Auxerre",
        title: "Leben im Lager",
        content:
          "Die Gefangenen wurden häufig in der Landwirtschaft eingesetzt, was ihnen im Vergleich zu anderen Lagern etwas bessere Bedingungen bot.",
      },
      {
        place: "Vitry-le-François",
        title: "Reparaturarbeiten",
        content:
          "Die Kriegsgefangenen halfen bei der Reparatur von Gebäuden und Infrastruktur, die während des Krieges zerstört wurden.",
      },
    ],
    mapHeight: "500px",
    mapWidth: "50%",
  },
  editableProps: {
    marker: {
      type: "objectlist",
      fields: {
        name: "string",
        coordinates: "coordinates",
        description: "text",
      },
    },
    notes: {
      type: "objectlist",
      fields: {
        place: "string",
        title: "string",
        content: "text",
      },
    },
    mapHeight: "string",
    mapWidth: "string",
  },
};
