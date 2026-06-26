"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Building2, Lock, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { ApiSource, Site } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/lib/toast";
import { SitesDialog } from "@/components/sites-dialog";

export function ScopeBar({
  scope,
  setScope,
  sources,
  sites,
  sourcesInScope,
}: {
  scope: string;
  setScope: (v: string) => void;
  sources: ApiSource[];
  sites: Site[];
  sourcesInScope: ApiSource[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [sitesOpen, setSitesOpen] = useState(false);

  async function refresh() {
    setRefreshing(true);
    const locked: string[] = [];
    let ok = 0;
    let failed = 0;
    for (const s of sourcesInScope) {
      if (s.requires_unlock) {
        locked.push(s.name);
        continue;
      }
      try {
        const res = await api.post<{ run: { status: string } }>(`/api/sources/${s.id}/refresh`);
        res.run.status === "success" ? ok++ : failed++;
      } catch {
        failed++;
      }
    }
    qc.invalidateQueries({ queryKey: ["insights"] });
    qc.invalidateQueries({ queryKey: ["sources"] });
    setRefreshing(false);

    const parts = [`${ok} refreshed`];
    if (failed) parts.push(`${failed} failed`);
    if (locked.length) parts.push(`${locked.length} need unlock`);
    toast({
      title: "Refresh complete",
      description: parts.join(" · ") + (locked.length ? ` (unlock in API Sources: ${locked.join(", ")})` : ""),
      variant: failed ? "warning" : "success",
    });
  }

  const chip = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-primary bg-primary/15 text-primary"
        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* One-click scope chips */}
      <button onClick={() => setScope("all")} className={chip(scope === "all")}>
        <Globe className="h-3.5 w-3.5" /> All sites
        <span className="opacity-60">{sources.length}</span>
      </button>
      {sites.map((s) => (
        <button key={s.id} onClick={() => setScope(`site:${s.id}`)} className={chip(scope === `site:${s.id}`)}>
          <Building2 className="h-3.5 w-3.5" /> {s.name}
          <span className="opacity-60">{s.sources_count}</span>
        </button>
      ))}

      {sources.length > 0 && (
        <Select
          value={scope.startsWith("source:") ? scope : ""}
          onChange={(e) => e.target.value && setScope(e.target.value)}
          className="h-8 w-auto min-w-[150px]"
        >
          <option value="">Single source…</option>
          {sources.map((s) => (
            <option key={s.id} value={`source:${s.id}`}>
              {s.name}
              {s.last_status === "failed" ? " ⚠" : ""}
            </option>
          ))}
        </Select>
      )}

      <span className="text-xs text-muted-foreground">
        {sourcesInScope.length} source(s)
        {sourcesInScope.some((s) => s.requires_unlock) && (
          <span className="ml-2 inline-flex items-center gap-1 text-warning">
            <Lock className="h-3 w-3" /> need unlock
          </span>
        )}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {user?.can_manage && (
          <Button variant="outline" size="sm" onClick={() => setSitesOpen(true)}>
            <Building2 className="h-4 w-4" /> Sites
          </Button>
        )}
        {user?.can_manage && (
          <Button variant="outline" size="sm" onClick={refresh} loading={refreshing} disabled={sourcesInScope.length === 0}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        )}
        {user?.can_manage && (
          <Link href="/sources/new">
            <Button size="sm">
              <Plus className="h-4 w-4" /> Add source
            </Button>
          </Link>
        )}
      </div>

      <SitesDialog open={sitesOpen} onClose={() => setSitesOpen(false)} />
    </div>
  );
}
