"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime, healthBadgeVariant, complianceBadgeVariant, titleCase } from "@/lib/format";

interface EndpointRow {
  id: number;
  external_id: string | null;
  hostname: string | null;
  os_platform: string | null;
  os_version: string | null;
  agent_version: string | null;
  health_status: string | null;
  compliance_status: string | null;
  last_seen_at: string | null;
  ip_address: string | null;
  mac_address: string | null;
}

interface DataResponse {
  data: EndpointRow[];
  meta: { total: number; per_page: number; current_page: number; last_page: number };
}

export function EndpointTable({ scope, compact = false }: { scope?: string; compact?: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [os, setOs] = useState("");
  const [health, setHealth] = useState("");
  const [compliance, setCompliance] = useState("");
  const [sort, setSort] = useState("hostname");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const perPage = compact ? 8 : 25;

  const { data, isLoading } = useQuery({
    queryKey: ["endpoints", scope, { page, search, os, health, compliance, sort, dir, perPage }],
    enabled: !!scope,
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.get<DataResponse>("/api/insights/data", {
        scope,
        page,
        per_page: perPage,
        search,
        os_platform: os,
        health_status: health,
        compliance_status: compliance,
        sort,
        dir,
      }),
  });

  function toggleSort(col: string) {
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(col);
      setDir("asc");
    }
  }

  function exportCsv() {
    const rows = data?.data ?? [];
    const cols = ["hostname", "os_platform", "os_version", "agent_version", "health_status", "compliance_status", "last_seen_at", "ip_address", "mac_address"];
    const csv = [
      cols.join(","),
      ...rows.map((r) => cols.map((c) => `"${String((r as any)[c] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "endpoints.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortHead = ({ col, label }: { col: string; label: string }) => (
    <TH>
      <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TH>
  );

  return (
    <div className={compact ? "flex h-full flex-col" : "space-y-4"}>
      {!compact && (
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
          <Select value={os} onChange={(e) => { setOs(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All OS</option>
            <option value="Windows">Windows</option>
            <option value="macOS">macOS</option>
            <option value="Linux">Linux</option>
          </Select>
          <Select value={health} onChange={(e) => { setHealth(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All health</option>
            <option value="online">Online</option>
            <option value="stale">Stale</option>
            <option value="offline">Offline</option>
            <option value="error">Error</option>
          </Select>
          <Select value={compliance} onChange={(e) => { setCompliance(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All compliance</option>
            <option value="compliant">Compliant</option>
            <option value="non_compliant">Non-compliant</option>
            <option value="unknown">Unknown</option>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      )}

      <div className={compact ? "min-h-0 flex-1 overflow-auto" : "rounded-lg border"}>
        <Table>
          <THead>
            <TR>
              <SortHead col="hostname" label="Hostname" />
              <SortHead col="os_platform" label="OS" />
              {!compact && <SortHead col="os_version" label="OS Version" />}
              <SortHead col="agent_version" label="Agent" />
              <TH>Health</TH>
              <TH>Compliance</TH>
              <SortHead col="last_seen_at" label="Last Seen" />
              {!compact && <TH>IP</TH>}
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
                <TR key={i}>
                  {Array.from({ length: compact ? 6 : 8 }).map((__, j) => (
                    <TD key={j}><Skeleton className="h-4 w-full" /></TD>
                  ))}
                </TR>
              ))
            ) : data && data.data.length > 0 ? (
              data.data.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.hostname ?? "—"}</TD>
                  <TD>{r.os_platform ?? "—"}</TD>
                  {!compact && <TD className="text-muted-foreground">{r.os_version ?? "—"}</TD>}
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
                  {!compact && <TD className="font-mono text-xs">{r.ip_address ?? "—"}</TD>}
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={8} className="py-10 text-center text-muted-foreground">
                  No endpoints found.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </div>

      {!compact && data && data.meta.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {data.meta.total} endpoints · page {data.meta.current_page} of {data.meta.last_page}
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
  );
}
