import React, { useState } from "react";
import {
  Center,
  Button,
  PasswordInput,
  TextInput,
  Text,
  Alert,
  Stack,
  Card,
} from "@mantine/core";
import { useAuth } from "@derneuere/visual-react";

export function Login({ onLogin }: { onLogin: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center style={{ width: "100vw", height: "100vh" }}>
      <Card
        shadow="xs"
        padding="lg"
        radius="lg"
        withBorder
        style={{ width: "25rem" }}
      >
        <Text size="lg" fw={600}>
          Login
        </Text>

        <Stack gap="md">
          <TextInput
            label="Username"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
          />

          <PasswordInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
            error={error ? true : undefined}
          />

          {error && (
            <Alert color="red" radius="md" variant="light">
              {error}
            </Alert>
          )}

          <Button onClick={handleLogin} fullWidth loading={loading}>
            Submit
          </Button>
        </Stack>
      </Card>
    </Center>
  );
}
