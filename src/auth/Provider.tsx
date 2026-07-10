import React, { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./Context";
import type { StorageAdapter } from "../storage/types";

interface AuthProviderProps {
  adapter: StorageAdapter;
  storageKey?: string;
  children: React.ReactNode;
}

export function AuthProvider({
  adapter,
  storageKey = "vr-auth-token",
  children,
}: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);

  // Check for existing token on mount
  useEffect(() => {
    async function checkExistingToken() {
      // If adapter doesn't support auth, consider it authenticated
      if (!adapter.login || !adapter.checkAuth) {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      const savedToken = localStorage.getItem(storageKey);
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      // Restore the token to the adapter
      if ("setAuthToken" in adapter && typeof adapter.setAuthToken === "function") {
        adapter.setAuthToken(savedToken);
      }

      const valid = await adapter.checkAuth();
      if (valid) {
        setIsAuthenticated(true);
        setUsername(localStorage.getItem(`${storageKey}:username`));
      } else {
        // Token expired or invalid, clean up
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}:username`);
        if ("setAuthToken" in adapter && typeof adapter.setAuthToken === "function") {
          adapter.setAuthToken("");
        }
      }
      setIsLoading(false);
    }

    checkExistingToken();
  }, [adapter, storageKey]);

  const login = useCallback(
    async (user: string, password: string) => {
      if (!adapter.login) {
        throw new Error("Storage adapter does not support authentication");
      }
      const token = await adapter.login(user, password);
      localStorage.setItem(storageKey, token);
      localStorage.setItem(`${storageKey}:username`, user);
      setUsername(user);
      setIsAuthenticated(true);
    },
    [adapter, storageKey]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(`${storageKey}:username`);
    if ("setAuthToken" in adapter && typeof adapter.setAuthToken === "function") {
      adapter.setAuthToken("");
    }
    setUsername(null);
    setIsAuthenticated(false);
  }, [adapter, storageKey]);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, username, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
