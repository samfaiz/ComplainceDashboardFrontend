"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, AlertTriangle, Eye } from "lucide-react";
import { useScope } from "@/lib/use-scope";
import {
  useDashboard,
  useDashboards,
  useDefaultDashboard,
  useScopeSummary,
  useScopeTrends,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { LastRefreshed } from "@/components/last-refreshed";
import { NoSources } from "@/components/source-bar";
import { ScopeBar } from "@/components/scope-bar";
import { DashboardView } from "@/components/dashboard-view";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export default function DashboardPage() {
  const { user } = useAuth();
  const { scope, setScope, sources, sites, sourcesInScope, isLoading, hasAny, label } = useScope();
  const { data: defaultDashboard } = useDefaultDashboard();
  const { data: allDashboards } = useDashboards();

  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    if (activeId == null && defaultDashboard) setActiveId(defaultDashboard.id);
  }, [defaultDashboard, activeId]);

  const { data: activeDashboard } = useDashboard(
    activeId && activeId !== defaultDashboard?.id ? activeId : null
  );
  const dashboard = activeId === defaultDashboard?.id ? defaultDashboard : activeDashboard ?? defaultDashboard;

  // For assigned (read-only) dashboards, insights pull from the dashboard owner's sources.
  const insightsDashboardId = dashboard?.read_only ? dashboard.id : null;
  const { data: summaryRes } = useScopeSummary(scope, insightsDashboardId);
  const { data: trends } = useScopeTrends(scope, insightsDashboardId);

  const canCustomize = user?.can_manage && dashboard?.owned !== false;

  const switcherOptions = useMemo(() => allDashboards ?? [], [allDashboards]);
  const showSwitcher = switcherOptions.length > 1;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Viewer (or any user) with no owned sources AND no assigned dashboard: empty state.
  if (!hasAny && !defaultDashboard) {
    if (!user?.can_manage) {
      return (
        <div className="space-y-5">
          <PageHeader title="Compliance Dashboard" />
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No dashboard assigned</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask an administrator to assign a dashboard to your account.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <PageHeader title="Compliance Dashboard" />
        <NoSources />
      </div>
    );
  }

  const isReadOnly = dashboard?.read_only === true;

  return (
    <div className="space-y-5">
      <PageHeader title="Compliance Dashboard" description={`Endpoint posture · ${isReadOnly ? "assigned dashboard" : label}`}>
        <LastRefreshed at={summaryRes?.captured_at} />
        {showSwitcher && (
          <Select
            value={String(activeId ?? "")}
            onChange={(e) => setActiveId(Number(e.target.value))}
            className="h-9 w-auto"
          >
            {switcherOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.read_only ? ` · view-only${d.owner_name ? ` (by ${d.owner_name})` : ""}` : ""}
              </option>
            ))}
          </Select>
        )}
        {canCustomize && hasAny && (
          <Link href="/builder">
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4" /> Customize
            </Button>
          </Link>
        )}
      </PageHeader>

      {isReadOnly && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5 text-primary" />
          View-only dashboard{dashboard?.owner_name ? ` assigned by ${dashboard.owner_name}` : ""}. Updates from the owner appear automatically.
        </div>
      )}

      {/* Scope selector only when the viewer has their own sources to switch between. */}
      {hasAny && !isReadOnly && (
        <ScopeBar scope={scope} setScope={setScope} sources={sources} sites={sites} sourcesInScope={sourcesInScope} />
      )}

      {summaryRes?.last_error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {summaryRes.last_error}
        </div>
      )}

      {dashboard && (
        <DashboardView
          layout={dashboard.layout}
          scope={scope}
          summary={summaryRes?.summary}
          trends={trends}
          dashboardId={insightsDashboardId}
        />
      )}
    </div>
  );
}
