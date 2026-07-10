import React from "react";
import { Group, Text, Space, Burger, Menu, Image } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link } from "@tanstack/react-router";
import svg from "../../assets/france.svg";
import styles from "./Header.module.css";

const Header = () => {
  const [opened, { toggle }] = useDisclosure();

  return (
    <header className={styles.header}>
      <Link
        to="/"
        style={{
          textDecoration: "none",
          color: "black",
        }}
      >
        <Group>
          <Image src={svg} alt="France" w={40} h={40} />
          <div>
            <Text size="lg" fw={1000}>
              Lagerberichte
            </Text>
            <Text size="sm">Kriegsgefangenengeschichte</Text>
            <Text size="sm">in Frankreich</Text>
          </div>
        </Group>
      </Link>
      <Group className={styles.navGroup}>
        <Text className={styles.navItem}>
          <Link
            to="/antrag-stellen"
            style={{
              textDecoration: "none",
              color: "black",
            }}
          >
            Antrag stellen
          </Link>
        </Text>
        <Space w="xl" visibleFrom="xl" />
        <Text className={styles.navItem}>
          <Link
            to="/deep-map"
            style={{
              textDecoration: "none",
              color: "black",
            }}
          >
            Deep Map
          </Link>
        </Text>
        <Space w="xl" visibleFrom="xl" />
        <Text className={styles.navItem}>
          <Link
            to="/ueber-uns"
            style={{
              textDecoration: "none",
              color: "black",
            }}
          >
            Über das Projekt
          </Link>
        </Text>
      </Group>
      <Menu
        className={styles.mobileMenu}
        shadow="md"
        width={200}
        opened={opened}
        onChange={toggle}
      >
        <Menu.Target>
          <Burger opened={opened} aria-label="Toggle navigation" />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>Antrag stellen</Menu.Item>
          <Menu.Item>Deep Map</Menu.Item>
          <Menu.Item>Über das Projekt</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </header>
  );
};

export default Header;

export const metadata = {
  name: "Header",
  description: "The header of the Memory Link website",
  defaultProps: [],
  editableProps: [],
};
