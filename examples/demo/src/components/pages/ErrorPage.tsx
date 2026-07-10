import React from "react";
import { Container, Title, Text, Button, Paper, Code, Stack } from "@mantine/core";
import { useRouterState } from "@tanstack/react-router";

interface ErrorPageProps {
  error?: Error;
  info?: React.ErrorInfo;
  resetErrorBoundary?: () => void;
  code?: number;
}

export const ErrorPage: React.FC<ErrorPageProps> = ({ 
  error, 
  resetErrorBoundary,
  code = 404 
}) => {
  const routerState = useRouterState();
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Get error details 
  const errorMessage = error?.message || "An unexpected error occurred";
  const errorStack = error?.stack;
  const errorName = error?.name || "Error";
  
  return (
    <Container size="md" style={{ padding: "50px 20px" }}>
      <Paper shadow="sm" p="xl" withBorder style={{ textAlign: "center" }}>
        <Title order={1} style={{ fontSize: "6rem", color: "#ff6b6b" }}>
          {code}
        </Title>
        <Title order={2} style={{ marginBottom: "20px" }}>
          {code === 404 ? "Page Not Found" : "Error Occurred"}
        </Title>
        
        <Text size="lg" fw={500} style={{ margin: "20px 0 10px" }}>
          {code === 404 
            ? "Oops! The page you're looking for doesn't exist."
            : `${errorName}: ${errorMessage}`
          }
        </Text>
        
        <Text c="dimmed" size="sm" style={{ marginBottom: "30px" }}>
          {code === 404 
            ? "It might have been moved, deleted, or never existed in the first place."
            : "Something went wrong while rendering this page."
          }
        </Text>
        
        {/* Show detailed error information in development mode */}
        {isDevelopment && error && (
          <Stack spacing="xs" style={{ textAlign: "left", marginBottom: "30px" }}>
            <Text fw={700}>Error Details (Development Only):</Text>
            <Paper p="sm" withBorder bg="rgba(255,107,107,0.1)">
              <Text component="div" style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight: "300px" }}>
                <Code block>{errorStack || errorMessage}</Code>
              </Text>
            </Paper>
            {routerState && (
              <Paper p="sm" withBorder>
                <Text fw={500}>Router State:</Text>
                <Code block>
                  {JSON.stringify(
                    {
                      pathname: routerState.location.pathname,
                      search: routerState.location.search,
                      hash: routerState.location.hash,
                    }, 
                    null, 
                    2
                  )}
                </Code>
              </Paper>
            )}
          </Stack>
        )}
        
        <Stack spacing="xs" align="center">
          {resetErrorBoundary && (
            <Button 
              size="md" 
              variant="outline" 
              color="blue" 
              onClick={resetErrorBoundary}
              style={{ marginRight: "10px" }}
            >
              Try Again
            </Button>
          )}
          <Button
            size="md"
            variant="filled"
            color="blue"
            onClick={() => window.location.href = "/"}
          >
            Go Back Home
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};
