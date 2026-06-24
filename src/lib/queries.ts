"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { ApiSource, Dashboard, Preset, Site, Summary } from "./types";

export function useSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: () => api.get<{ sources: ApiSource[] }>("/api/sources").then((r) => r.sources),
  });
}

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ sites: Site[] }>("/api/sites").then((r) => r.sites),
  });
}

export function usePresets() {
  return useQuery({
    queryKey: ["presets"],
    queryFn: () =>
      api.get<{ presets: Preset[]; refresh_intervals: number[] }>("/api/sources/presets"),
    staleTime: 5 * 60_000,
  });
}

/* ---- Scope-aware insights (scope = "all" | "site:{id}" | "source:{id}") ---- */

export function useScopeSummary(scope?: string) {
  return useQuery({
    queryKey: ["insights", "summary", scope],
    enabled: !!scope,
    queryFn: () =>
      api.get<{
        summary: Summary | null;
        captured_at: string | null;
        endpoint_count: number;
        source_count: number;
        last_error: string | null;
      }>("/api/insights/summary", { scope }),
  });
}

export function useScopeTrends(scope?: string) {
  return useQuery({
    queryKey: ["insights", "trends", scope],
    enabled: !!scope,
    queryFn: () =>
      api
        .get<{ series: Record<string, number | string>[] }>("/api/insights/trends", { scope })
        .then((r) => r.series),
  });
}

export function useScopeAggregate(scope: string | undefined, field: string, enabled = true) {
  return useQuery({
    queryKey: ["insights", "aggregate", scope, field],
    enabled: !!scope && enabled,
    queryFn: () =>
      api
        .get<{ field: string; buckets: { label: string; value: number }[] }>("/api/insights/aggregate", {
          scope,
          field,
        })
        .then((r) => r.buckets),
  });
}

export function useScopeRule(scope: string | undefined, rule: unknown, enabled = true) {
  return useQuery({
    queryKey: ["insights", "rule", scope, rule],
    enabled: !!scope && enabled,
    queryFn: () =>
      api.post<{ count: number; total: number; pct: number }>("/api/insights/evaluate", { scope, rule }),
  });
}

export function useDefaultDashboard() {
  return useQuery({
    queryKey: ["dashboard", "default"],
    queryFn: () => api.get<{ dashboard: Dashboard }>("/api/dashboards/default").then((r) => r.dashboard),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<Record<string, any>>("/api/health"),
    refetchInterval: 30_000,
  });
}
