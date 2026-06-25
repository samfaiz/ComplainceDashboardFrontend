"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Layers, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useTechStack } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import type { StackPackage, TechStackSnapshot } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SeverityFilter = "all" | "vulnerable" | "critical" | "high" | "moderate" | "low";

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  high: "destructive",
  moderate: "warning",
  medium: "warning",
  low: "secondary",
  unknown: "secondary",
};

export function TechStackPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, isFetching, error } = useTechStack(true, refreshKey > 0);

  async function refresh() {
    try {
      await api.get<TechStackSnapshot>("/api/health/stack", { refresh: 1 });
      qc.invalidateQueries({ queryKey: ["health", "stack"] });
      setRefreshKey((k) => k + 1);
      toast({ title: "Vulnerability scan refreshed", variant: "success" });
    } catch (e) {
      toast({ title: "Refresh failed", description: e instanceof Error ? e.message : "Error", variant: "error" });
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-3 text-sm text-muted-foreground">Running composer audit + npm audit…</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">
          Failed to load tech stack. {error instanceof Error ? error.message : ""}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Tech Stack &amp; Vulnerabilities</h3>
            {data.totals.vulnerable > 0 ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldOff className="h-3 w-3" />
                {data.totals.vulnerable} vulnerable / {data.totals.advisories} CVEs
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> No known CVEs
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Scanned {relativeTime(data.generated_at)}</span>
            <Button variant="outline" size="sm" onClick={refresh} loading={isFetching}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {data.errors.length > 0 && (
          <div className="mb-3 space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs">
            {data.errors.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warning" />
                <span>
                  <span className="font-medium">{e.source}:</span> {e.message}
                </span>
              </div>
            ))}
          </div>
        )}

        <RuntimeStrip runtime={data.runtime} />
        <PackageTable data={data} />
      </CardContent>
    </Card>
  );
}

function RuntimeStrip({ runtime }: { runtime: TechStackSnapshot["runtime"] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
      {runtime.map((r) => (
        <div key={r.name} className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-[10px] uppercase text-muted-foreground">{r.name}</p>
          <p className="truncate font-mono text-sm">{r.version ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function PackageTable({ data }: { data: TechStackSnapshot }) {
  const [q, setQ] = useState("");
  const [eco, setEco] = useState<"all" | "php" | "npm">("all");
  const [sev, setSev] = useState<SeverityFilter>("all");
  const [showDev, setShowDev] = useState(true);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return data.packages.filter((p) => {
      if (eco !== "all" && p.ecosystem !== eco) return false;
      if (!showDev && p.dev) return false;
      if (sev === "vulnerable" && p.advisories.length === 0) return false;
      if (sev !== "all" && sev !== "vulnerable" && p.highest_severity !== sev) return false;
      if (query && !p.name.toLowerCase().includes(query) && !p.version.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [data.packages, q, eco, sev, showDev]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search package or version…"
          className="h-8 max-w-xs"
        />
        <Select value={eco} onChange={(e) => setEco(e.target.value as typeof eco)} className="h-8 w-auto">
          <option value="all">All ecosystems ({data.totals.packages})</option>
          <option value="php">PHP / Composer ({data.totals.php})</option>
          <option value="npm">npm ({data.totals.npm})</option>
        </Select>
        <Select value={sev} onChange={(e) => setSev(e.target.value as SeverityFilter)} className="h-8 w-auto">
          <option value="all">Any severity</option>
          <option value="vulnerable">Vulnerable only ({data.totals.vulnerable})</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </Select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showDev}
            onChange={(e) => setShowDev(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Include dev dependencies
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} shown</span>
      </div>

      <div className="max-h-[480px] overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b bg-card text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Package</th>
              <th className="px-3 py-2 text-left font-medium">Version</th>
              <th className="px-3 py-2 text-left font-medium">Ecosystem</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Advisories</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No packages match.
                </td>
              </tr>
            ) : (
              filtered.map((p) => <PackageRow key={`${p.ecosystem}|${p.name}|${p.version}`} pkg={p} />)
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PackageRow({ pkg }: { pkg: StackPackage }) {
  const vulnerable = pkg.advisories.length > 0;
  return (
    <tr className={vulnerable ? "border-b bg-destructive/5" : "border-b last:border-0"}>
      <td className="px-3 py-2 font-mono text-xs">
        <span className="font-medium">{pkg.name}</span>
        {pkg.dev && <span className="ml-1 text-[10px] uppercase text-muted-foreground">dev</span>}
      </td>
      <td className="px-3 py-2 font-mono text-xs">{pkg.version}</td>
      <td className="px-3 py-2 text-xs capitalize text-muted-foreground">{pkg.ecosystem}</td>
      <td className="px-3 py-2">
        {vulnerable ? (
          <Badge variant={SEVERITY_VARIANT[pkg.highest_severity ?? "unknown"]} className="capitalize">
            {pkg.highest_severity}
          </Badge>
        ) : (
          <Badge variant="secondary">OK</Badge>
        )}
      </td>
      <td className="px-3 py-2">
        {vulnerable ? (
          <div className="space-y-1">
            {pkg.advisories.map((a, i) => (
              <div key={i} className="text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {a.cve && (
                    <span className="rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-destructive">
                      {a.cve}
                    </span>
                  )}
                  {a.cvss != null && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      CVSS {a.cvss}
                    </span>
                  )}
                  {a.affected_versions && (
                    <span className="font-mono text-[10px] text-muted-foreground">{a.affected_versions}</span>
                  )}
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      details <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{a.title}</p>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
