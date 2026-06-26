"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type {
  ApiSource,
  AssignableDashboard,
  AssignedDashboard,
  Dashboard,
  MailSettings,
  NotificationLogEntry,
  NotificationSubscription,
  NotificationTemplate,
  Organization,
  Preset,
  Site,
  Summary,
  TechStackSnapshot,
} from "./types";

/* ---- Platform (super_admin): cross-organization management ---- */

export function usePlatformOrgs(enabled = true) {
  return useQuery({
    queryKey: ["platform", "organizations"],
    enabled,
    queryFn: () =>
      api.get<{ organizations: Organization[] }>("/api/platform/organizations").then((r) => r.organizations),
  });
}

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

export function useScopeSummary(scope?: string, dashboardId?: number | null) {
  return useQuery({
    queryKey: ["insights", "summary", scope, dashboardId ?? null],
    enabled: !!scope,
    queryFn: () =>
      api.get<{
        summary: Summary | null;
        captured_at: string | null;
        endpoint_count: number;
        source_count: number;
        last_error: string | null;
      }>("/api/insights/summary", { scope, dashboard_id: dashboardId ?? undefined }),
  });
}

export function useScopeTrends(scope?: string, dashboardId?: number | null) {
  return useQuery({
    queryKey: ["insights", "trends", scope, dashboardId ?? null],
    enabled: !!scope,
    queryFn: () =>
      api
        .get<{ series: Record<string, number | string>[] }>("/api/insights/trends", { scope, dashboard_id: dashboardId ?? undefined })
        .then((r) => r.series),
  });
}

export function useScopeAggregate(
  scope: string | undefined,
  field: string,
  enabled = true,
  dashboardId?: number | null
) {
  return useQuery({
    queryKey: ["insights", "aggregate", scope, field, dashboardId ?? null],
    enabled: !!scope && enabled,
    queryFn: () =>
      api
        .get<{ field: string; buckets: { label: string; value: number }[] }>("/api/insights/aggregate", {
          scope,
          field,
          dashboard_id: dashboardId ?? undefined,
        })
        .then((r) => r.buckets),
  });
}

export function useScopeRule(
  scope: string | undefined,
  rule: unknown,
  enabled = true,
  dashboardId?: number | null
) {
  return useQuery({
    queryKey: ["insights", "rule", scope, rule, dashboardId ?? null],
    enabled: !!scope && enabled,
    queryFn: () =>
      api.post<{ count: number; total: number; pct: number }>("/api/insights/evaluate", {
        scope,
        rule,
        dashboard_id: dashboardId ?? undefined,
      }),
  });
}

export function useDefaultDashboard() {
  return useQuery({
    queryKey: ["dashboard", "default"],
    queryFn: () => api.get<{ dashboard: Dashboard | null }>("/api/dashboards/default").then((r) => r.dashboard),
  });
}

export function useDashboards() {
  return useQuery({
    queryKey: ["dashboards", "mine"],
    queryFn: () => api.get<{ dashboards: Dashboard[] }>("/api/dashboards").then((r) => r.dashboards),
  });
}

export function useDashboard(id: number | null | undefined) {
  return useQuery({
    queryKey: ["dashboard", id],
    enabled: !!id,
    queryFn: () => api.get<{ dashboard: Dashboard }>(`/api/dashboards/${id}`).then((r) => r.dashboard),
  });
}

export function useAdminDashboards(enabled = true) {
  return useQuery({
    queryKey: ["admin", "dashboards"],
    enabled,
    queryFn: () => api.get<{ dashboards: AssignableDashboard[] }>("/api/admin/dashboards").then((r) => r.dashboards),
  });
}

export function useUserAssignedDashboards(userId: number | null) {
  return useQuery({
    queryKey: ["admin", "user-dashboards", userId],
    enabled: !!userId,
    queryFn: () =>
      api
        .get<{ dashboards: AssignedDashboard[] }>(`/api/admin/users/${userId}/dashboards`)
        .then((r) => r.dashboards),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<Record<string, any>>("/api/health"),
    refetchInterval: 30_000,
  });
}

export function useMailSettings(enabled = true) {
  return useQuery({
    queryKey: ["admin", "mail-settings"],
    enabled,
    queryFn: () => api.get<{ settings: MailSettings }>("/api/admin/mail-settings").then((r) => r.settings),
  });
}

export function useNotificationTemplates(enabled = true) {
  return useQuery({
    queryKey: ["admin", "notification-templates"],
    enabled,
    queryFn: () =>
      api.get<{ templates: NotificationTemplate[] }>("/api/admin/notification-templates").then((r) => r.templates),
  });
}

export function useNotificationLogs(enabled = true) {
  return useQuery({
    queryKey: ["admin", "notification-logs"],
    enabled,
    queryFn: () => api.get<{ logs: NotificationLogEntry[] }>("/api/admin/notification-logs").then((r) => r.logs),
  });
}

export function useMyNotificationSubscriptions() {
  return useQuery({
    queryKey: ["me", "notification-subscriptions"],
    queryFn: () =>
      api
        .get<{ subscriptions: NotificationSubscription[] }>("/api/notification-subscriptions")
        .then((r) => r.subscriptions),
  });
}

export function useTechStack(enabled = true, refresh = false) {
  return useQuery({
    queryKey: ["health", "stack", refresh],
    enabled,
    queryFn: () => api.get<TechStackSnapshot>("/api/health/stack", refresh ? { refresh: 1 } : undefined),
    staleTime: 60 * 60_000,
  });
}
