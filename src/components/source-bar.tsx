"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Lock, AlertTriangle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import type { ApiSource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { useToast } from "@/lib/toast";

export function SourceBar({
  sources,
  active,
  onSelect,
}: {
  sources: ApiSource[];
  active?: ApiSource;
  onSelect: (id: number) => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  function invalidate() {
    if (!active) return;
    qc.invalidateQueries({ queryKey: ["summary", active.id] });
    qc.invalidateQueries({ queryKey: ["trends", active.id] });
    qc.invalidateQueries({ queryKey: ["aggregate", active.id] });
    qc.invalidateQueries({ queryKey: ["endpoints", active.id] });
    qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function refresh() {
    if (!active) return;
    if (active.requires_unlock) {
      setUnlockOpen(true);
      return;
    }
    setRefreshing(true);
    try {
      const res = await api.post<{ run: { status: string; records_ingested: number; error?: string } }>(
        `/api/sources/${active.id}/refresh`
      );
      if (res.run.status === "success") {
        toast({ title: "Refreshed", description: `${res.run.records_ingested} endpoints pulled.`, variant: "success" });
      } else {
        toast({ title: "Refresh failed", description: res.run.error || "See source status.", variant: "error" });
      }
      invalidate();
    } catch (e) {
      toast({ title: "Refresh failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setRefreshing(false);
    }
  }

  async function unlockAndRefresh() {
    if (!active) return;
    setBusy(true);
    try {
      await api.post(`/api/sources/${active.id}/unlock`, { secret });
      await api.post(`/api/sources/${active.id}/refresh`);
      toast({ title: "Unlocked & refreshed", variant: "success" });
      setUnlockOpen(false);
      setSecret("");
      invalidate();
    } catch (e) {
      toast({ title: "Unlock failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={active?.id ?? ""}
        onChange={(e) => onSelect(Number(e.target.value))}
        className="w-auto min-w-[200px]"
      >
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} {s.last_status === "failed" ? "⚠" : ""}
          </option>
        ))}
      </Select>

      {active && (
        <span className="text-xs text-muted-foreground">
          Updated {relativeTime(active.last_run_at)}
          {active.secret_mode === "per_login" && (
            <span className="ml-2 inline-flex items-center gap-1 text-warning">
              <Lock className="h-3 w-3" /> session-only key
            </span>
          )}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {user?.can_manage && (
          <Button variant="outline" size="sm" onClick={refresh} loading={refreshing}>
            {active?.requires_unlock ? <Lock className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            {active?.requires_unlock ? "Unlock" : "Refresh"}
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

      <Dialog open={unlockOpen} onClose={() => setUnlockOpen(false)}>
        <DialogHeader
          title="Unlock source for this session"
          description="This source was configured to require its API key on every login. The key is held only in your encrypted session and never stored."
        />
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="API key / token"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoFocus
          />
          <Button className="w-full" loading={busy} disabled={!secret} onClick={unlockAndRefresh}>
            Unlock & refresh
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export function NoSources() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-medium">No data source connected</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Connect your EDR/XDR/SIEM API to start monitoring endpoint compliance.
      </p>
      <Link href="/sources/new" className="mt-4">
        <Button>
          <Plus className="h-4 w-4" /> Connect a source
        </Button>
      </Link>
    </div>
  );
}
