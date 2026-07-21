import * as SecureStore from "expo-secure-store";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { authApi } from "../api/auth";
import { TOKEN_STORAGE_KEY } from "../api/client";
import { ProfileType, User } from "../types";

interface AuthContextValue {
  isLoading: boolean;
  user: User | null;
  login: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  setProfileType: (profileType: ProfileType) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const refreshMe = useCallback(async () => {
    const me = await authApi.me();
    setUser(me);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (token) {
        try {
          await refreshMe();
        } catch {
          // Stale/expired token - clear it and fall back to logged-out state.
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
          setUser(null);
        }
      }
      setIsLoading(false);
    })();
  }, [refreshMe]);

  const login = useCallback(
    async (accessToken: string) => {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, accessToken);
      await refreshMe();
    },
    [refreshMe]
  );

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  const setProfileType = useCallback(async (profileType: ProfileType) => {
    const updated = await authApi.setProfileType(profileType);
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, user, login, logout, refreshMe, setProfileType }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
