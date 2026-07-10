import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";

import { ErrorPage } from "./components/pages/ErrorPage";

export function createRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: process.env.NODE_ENV === "production" ? 3 : 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultErrorComponent: ({ error }) => <ErrorPage error={error} code={500} />,
    defaultOnRouteError: ({ error, location, redirectTo }) => {
      if (process.env.NODE_ENV === 'development') {
        console.group('Router Error:');
        console.error(`Error at path: ${location.pathname}`);
        console.error(error);
        console.groupEnd();
      }

      return {
        fixedPath: redirectTo
          ? { to: redirectTo }
          : undefined
      };
    },
  });

  return router;
}

export const getRouter = createRouter;
