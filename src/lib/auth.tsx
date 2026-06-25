"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: User }>("/api/me");
        return res.user;
      } catch (e) {
        // 401/419 = no session; 403 = account disabled mid-session → treat as logged out.
        if (e instanceof ApiError && [401, 419, 403].includes(e.status)) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const user = data ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        refresh: () => qc.invalidateQueries({ queryKey: ["me"] }),
        logout: async () => {
          try {
            await api.post("/api/logout");
          } catch {
            /* ignore — clear locally regardless */
          }
          // Wipe ALL cached data so nothing leaks to the next user on this browser.
          qc.clear();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
