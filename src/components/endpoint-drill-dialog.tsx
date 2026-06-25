"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { api } from "@/lib/api";
import { complianceBadgeVariant, healthBadgeVariant, relativeTime, titleCase } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface EndpointRow {
  id: number;
  hostname: string | null;
  os_platform: string | null;
  os_version: string | null;
  agent_version: string | null;
  health_status: string | null;
  compliance_status: string | null;
  last_seen_at: string | null;
  ip_address: string | null;
}

interface DataResponse {
  data: EndpointRow[];
  meta: { total: number; per_page: number; current_page: number; last_page: number };
}

/**
 * Either drill via a {field, value} pair (chart slice click) or via a rule
 * (custom stat/gauge). One must be provided.
 */
export interface DrillCriteria {
  title: string;
  /** Field-value filter (pie/bar/donut slice). */
  filter?: { field: string; value: string };
  /** Custom rule (stat/gauge rule mode). */
  rule?: { match?: string; conditions: Array<{ field: string; op: string; value: string }> };
}

export function EndpointDrillDialog({
  criteria,
  scope,
  dashboardId,
  onClose,
}: {
  criteria: DrillCriteria;
  scope?: string;
  dashboardId?: number | null;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("hostname");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const isRule = !!criteria.rule;

  const { data, isLoading } = useQuery({
    queryKey: ["drill", criteria, scope, dashboardId, page, search, sort, dir],
    enabled: !!scope,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (isRule) {
        return api.post<DataResponse>("/api/insights/rule-data", {
          rule: criteria.rule,
          scope,
          dashboard_id: dashboardId ?? undefined,
          page,
          per_page: 25,
          sort,
          dir,
        });
      }
      const params: Record<string, unknown> = {
        scope,
        page,
        per_page: 25,
        search,
        sort,
        dir,
        dashboard_id: dashboardId ?? undefined,
      };
      if (criteria.filter) {
        params[criteria.filter.field] = criteria.filter.value;
      }
      return api.get<DataResponse>("/api/insights/data", params as Record<string, string | number | boolean | undefined | null>);
    },
  });

  function exportCsv() {
    const rows = data?.data ?? [];
    const cols = ["hostname", "os_platform", "os_version", "agent_version", "health_status", "compliance_status", "last_seen_at", "ip_address"];
    const csv = [
      cols.join(","),
      ...rows.map((r) => cols.map((c) => `"${String((r as any)[c] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `endpoints-${criteria.filter?.value ?? "rule"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open onClose={onClose} className="max-w-5xl">
      <DialogHeader
        title={criteria.title}
        description={data ? `${data.meta.total} endpoint${data.meta.total === 1 ? "" : "s"} match` : "Loading…"}
      />

      <div className="space-y-3">
        {!isRule && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hostname, IP, version…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data || data.data.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        )}

        <div className="max-h-[60vh] overflow-auto rounded-lg border">
          <Table>
            <THead>
              <TR>
                <TH>Hostname</TH>
                <TH>OS</TH>
                <TH>OS Version</TH>
                <TH>Agent</TH>
                <TH>Health</TH>
                <TH>Compliance</TH>
                <TH>Last seen</TH>
                <TH>IP</TH>
              </TR>
            </THead>
            <TBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TR key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TD key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TD>
                    ))}
                  </TR>
                ))
              ) : data && data.data.length > 0 ? (
                data.data.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium">{r.hostname ?? "—"}</TD>
                    <TD>{r.os_platform ?? "—"}</TD>
                    <TD className="text-muted-foreground">{r.os_version ?? "—"}</TD>
                    <TD className="font-mono text-xs">{r.agent_version ?? "—"}</TD>
                    <TD>
                      {r.health_status && (
                        <Badge variant={healthBadgeVariant(r.health_status)}>{titleCase(r.health_status)}</Badge>
                      )}
                    </TD>
                    <TD>
                      {r.compliance_status && (
                        <Badge variant={complianceBadgeVariant(r.compliance_status)}>{titleCase(r.compliance_status)}</Badge>
                      )}
                    </TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{relativeTime(r.last_seen_at)}</TD>
                    <TD className="font-mono text-xs">{r.ip_address ?? "—"}</TD>
                  </TR>
                ))
              ) : (
                <TR>
                  <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                    No endpoints match this slice.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </div>

        {data && data.meta.total > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {data.meta.current_page} of {data.meta.last_page} · {data.meta.total} total
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
