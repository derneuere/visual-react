import React, { StrictMode } from "react";
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Outlet,
} from "@tanstack/react-router";
import { MantineProvider, mantineHtmlProps } from "@mantine/core";
import {
  ComponentRegistryProvider,
  EditorProvider,
  ComponentLoader,
  StorageAdapterProvider,
  AuthProvider,
  FetchStorageAdapter,
  GitHubStorageAdapter,
  StorageAdapter,
} from "@derneuere/visual-react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorPage } from "../components/pages/ErrorPage.tsx";
import { ExtensionLoader } from "../extensions/ExtensionLoader.tsx";
import CSS from "@mantine/core/styles.css?url";
import LeadletCSS from "leaflet/dist/leaflet.css?url";
import TipTapCSS from "@mantine/tiptap/styles.css?url";
import CarouselCSS from "@mantine/carousel/styles.css?url";
import VisualReactCSS from "@derneuere/visual-react/editor.css?url";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

function createStorageAdapter(): StorageAdapter {
  if (import.meta.env.VITE_STORAGE_MODE === "github") {
    return new GitHubStorageAdapter({
      token: import.meta.env.VITE_GITHUB_TOKEN,
      owner: "derneuere",
      repo: "visual-react-content",
    });
  }
  if (import.meta.env.VITE_STORAGE_MODE === "django") {
    return new FetchStorageAdapter({
      baseUrl: import.meta.env.VITE_DJANGO_URL || "http://localhost:8000",
      enableAuth: true,
      headers: import.meta.env.VITE_DJANGO_TOKEN
        ? { Authorization: `Bearer ${import.meta.env.VITE_DJANGO_TOKEN}` }
        : {},
    });
  }
  return new FetchStorageAdapter({ baseUrl: import.meta.env.VITE_URL || "" });
}

const storageAdapter = createStorageAdapter();

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Memory Link",
      },
    ],
    links: [
      { rel: "stylesheet", href: CSS },
      { rel: "stylesheet", href: LeadletCSS },
      { rel: "stylesheet", href: TipTapCSS },
      { rel: "stylesheet", href: CarouselCSS },
      { rel: "stylesheet", href: VisualReactCSS },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <html lang="de" {...mantineHtmlProps}>
      <head>
        <HeadContent />
      </head>
      <body>
        <StrictMode>
          <ErrorBoundary
            FallbackComponent={({ error, resetErrorBoundary }) => (
              <MantineProvider>
                <ErrorPage
                  error={error}
                  resetErrorBoundary={resetErrorBoundary}
                  code={500}
                />
              </MantineProvider>
            )}
            onError={(error, info) => {
              console.error("Global error caught:", error);
              console.error("Component stack:", info.componentStack);
              // In production, you would send this to your error tracking service
            }}
          >
            <MantineProvider>
              <QueryClientProvider client={queryClient}>
                <StorageAdapterProvider adapter={storageAdapter}>
                  <AuthProvider adapter={storageAdapter}>
                    <EditorProvider>
                      <ComponentRegistryProvider>
                        {/* ComponentLoader handles dynamic registration of example components */}
                        {typeof window !== "undefined" && (
                          <ComponentLoader
                            importer={import.meta.glob(
                              "../components/examples/*.tsx"
                            )}
                          />
                        )}
                        <ExtensionLoader />
                        <Outlet />
                      </ComponentRegistryProvider>
                    </EditorProvider>
                  </AuthProvider>
                </StorageAdapterProvider>
              </QueryClientProvider>
            </MantineProvider>
          </ErrorBoundary>
        </StrictMode>
        <Scripts />
      </body>
    </html>
  );
}
