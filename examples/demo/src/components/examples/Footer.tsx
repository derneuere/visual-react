import React from "react";
import { Grid, Text, Anchor, Stack, Image, Space, Group } from "@mantine/core";
import DRKLogo from "../../assets/logo-drk-suchdienst.svg";
import FULogo from "../../assets/fu-logo.png";
import HistoryLogo from "../../assets/public-history-master_logo.png";

const Footer = () => {
  return (
    <footer style={{ backgroundColor: "#3C74CA", padding: "4rem 10rem" }}>
      <Stack>
        <Text c="white">In Kooperation mit</Text>
        <Text c="white" fw={700}>
          Deutsches Rotes Kreuz
        </Text>
        <Grid
          justify="flex-start"
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
          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Text c="white">Generalsekretariat</Text>
            <Text c="white">Suchdienst-Standort München</Text>
            <Text c="white">Chiemgaustraße 109</Text>
            <Text c="white">81549 München</Text>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Text c="white">Telefon: 089 / 68 07 73 - 0</Text>
            <Text c="white">Telefax: 089 / 68 07 45 92</Text>
            <Text c="white">
              E-Mail:{" "}
              <Anchor c="white" href="mailto:info@drk-suchdienst.de">
                info@drk-suchdienst.de
              </Anchor>
            </Text>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 4 }}>
            <Text c="white">
              <Anchor c="white" href="/antrag-stellen">
                Antrag stellen
              </Anchor>
            </Text>
            <Text c="white">
              <Anchor c="white" href="/ueber-uns">
                Kontakt
              </Anchor>
            </Text>
            <Text c="white">
              <Anchor c="white" href="/deep-map">
                Deep Map
              </Anchor>
            </Text>
          </Grid.Col>
          <Grid.Col span="content">
            <Group>
              <Image fit="contain" h={100} src={DRKLogo}></Image>
              <Space w={10}></Space>
            </Group>
          </Grid.Col>
          <Grid.Col span="content">
            <Group>
              <Image fit="contain" h={100} src={HistoryLogo}></Image>
              <Space w={10}></Space>
            </Group>
          </Grid.Col>
          <Grid.Col span="content">
            <Group>
              <Image fit="contain" h={100} src={FULogo}></Image>
              <Space w={10}></Space>
            </Group>
          </Grid.Col>
        </Grid>
      </Stack>
    </footer>
  );
};

export default Footer;

export const metadata = {
  title: "Footer",
  description: "Footer component with DRK information",
  defaultProps: {},
  editableProps: {},
};
