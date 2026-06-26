"use client";

import { useScope } from "@/lib/use-scope";
import { PageHeader } from "@/components/page-header";
import { LastRefreshed } from "@/components/last-refreshed";
import { NoSources } from "@/components/source-bar";
import { ScopeBar } from "@/components/scope-bar";
import { EndpointTable } from "@/components/endpoint-table";
import { Card, CardContent } from "@/components/ui/card";

// Visible to all roles — Viewers can browse endpoint data (column layout is
// admin-defaulted with a personal override; see EndpointTable).
export default function DataPage() {
  const { scope, setScope, sources, sites, sourcesInScope, isLoading, hasAny, label } = useScope();

  // Latest pull across the sources currently in scope.
  const lastRun = sourcesInScope.map((s) => s.last_run_at).filter(Boolean).sort().at(-1);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Endpoint Data" description={`Normalized records · ${label}`}>
        {hasAny && <LastRefreshed at={lastRun} />}
      </PageHeader>

      {!hasAny ? (
        <NoSources />
      ) : (
        <>
          <ScopeBar scope={scope} setScope={setScope} sources={sources} sites={sites} sourcesInScope={sourcesInScope} />
          <Card>
            <CardContent className="pt-5">
              <EndpointTable scope={scope} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
