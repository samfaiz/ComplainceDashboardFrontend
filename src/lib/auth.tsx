"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, resetCsrf } from "./api";
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
          // Seed a logged-out state directly. Clearing instead would refetch
          // /api/me and, if the session somehow survived, restore the user and
          // bounce us straight back to the dashboard. Then wipe every other
          // cached query so nothing leaks to the next user on this browser.
          qc.setQueryData(["me"], null);
          qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
          resetCsrf();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
