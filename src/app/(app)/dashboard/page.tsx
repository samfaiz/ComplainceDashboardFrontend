"use client";

import Link from "next/link";
import { SlidersHorizontal, AlertTriangle } from "lucide-react";
import { useScope } from "@/lib/use-scope";
import { useDefaultDashboard, useScopeSummary, useScopeTrends } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { NoSources } from "@/components/source-bar";
import { ScopeBar } from "@/components/scope-bar";
import { DashboardView } from "@/components/dashboard-view";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { user } = useAuth();
  const { scope, setScope, sources, sites, sourcesInScope, isLoading, hasAny, label } = useScope();
  const { data: dashboard } = useDefaultDashboard();
  const { data: summaryRes } = useScopeSummary(scope);
  const { data: trends } = useScopeTrends(scope);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Compliance Dashboard" description={`Endpoint posture · ${label}`}>
        {user?.can_manage && hasAny && (
          <Link href="/builder">
            <Button variant="outline" size="sm">
              <SlidersHorizontal className="h-4 w-4" /> Customize
            </Button>
          </Link>
        )}
      </PageHeader>

      {!hasAny ? (
        <NoSources />
      ) : (
        <>
          <ScopeBar scope={scope} setScope={setScope} sources={sources} sites={sites} sourcesInScope={sourcesInScope} />

          {summaryRes?.last_error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              {summaryRes.last_error}
            </div>
          )}

          {dashboard && (
            <DashboardView layout={dashboard.layout} scope={scope} summary={summaryRes?.summary} trends={trends} />
          )}
        </>
      )}
    </div>
  );
}
