import React from "react";
import {
  Group,
  Title,
  Text,
  Center,
  Stack,
  Timeline as MantineTimeline,
} from "@mantine/core";
import "./Timeline.css";
import { useMediaQuery } from "@mantine/hooks";
const Timeline = ({ events }) => {
  const matches = useMediaQuery("(max-width: 1068px)");

  const middle = Math.floor(events.length / 2);

  const [selectedEvent, setSelectedEvent] = React.useState(middle);

  // switch to horizontal layout on small screens
  if (matches) {
    return (
      <MantineTimeline bulletSize={24} lineWidth={2}>
        {events.map((event) => (
          <MantineTimeline.Item
            title={
              <Text fw={700} size="lg">
                {event.date}
              </Text>
            }
          >
            <Text dangerouslySetInnerHTML={{ __html: event.description }} />
          </MantineTimeline.Item>
        ))}
      </MantineTimeline>
    );
  }

  return (
    <div>
      <Stack h={275}>
        <Center>
          <Title order={1}>{events[selectedEvent].date}</Title>
        </Center>
        <Center>
          <div style={{ maxWidth: "50%" }}>
            <Text
              className="overlay-text"
              dangerouslySetInnerHTML={{
                __html: events[selectedEvent].description,
              }}
            />
          </div>
        </Center>
      </Stack>
      <Group justify="space-between" className="strike-through-div" gap="xs">
        {events.map((event, i) => {
          return i == selectedEvent ? (
            <div key={event.date} className="div-large-tick"></div>
          ) : (
            <div
              key={event.date}
              className="div-container"
              onClick={() => {
                setSelectedEvent(i);
              }}
            >
              <Text fw={500} size="xl" c={"lightblue"}>
                {event.date}
              </Text>
            </div>
          );
        })}
      </Group>
    </div>
  );
};

export default Timeline;

export const metadata = {
  name: "Timeline",
  category: "Content",
  defaultProps: {
    events: [
      { date: "1923", description: "Event 1" },
      { date: "1925", description: "Event 2" },
      { date: "1931", description: "Event 3" },
      {
        date: "1933",
        description:
          "Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat,",
      },
      { date: "1935", description: "Event 5" },
      { date: "1937", description: "Event 6" },
      { date: "1939", description: "Event 7" },
    ],
  },
  editableProps: {
    events: {
      type: "objectlist",
      fields: {
        date: "string",
        description: "text",
      },
    },
  },
};
