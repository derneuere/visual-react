import React from "react";
import { useAuth } from "@derneuere/visual-react";
import { Login } from "./Login";
import { Center, Loader } from "@mantine/core";

export function EditorLoginGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center style={{ width: "100vw", height: "100vh" }}>
        <Loader />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => {}} />;
  }

  return <>{children}</>;
}
