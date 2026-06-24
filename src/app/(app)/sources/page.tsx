"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Plug, CircleCheck, CircleX, Lock, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSources } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { relativeTime, titleCase } from "@/lib/format";
import type { ApiSource } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { NoSources } from "@/components/source-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";

export default function SourcesPage() {
  const { user } = useAuth();
  const { data: sources, isLoading } = useSources();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [toDelete, setToDelete] = useState<ApiSource | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try {
      await api.del(`/api/sources/${toDelete.id}`);
      toast({ title: "Source deleted", variant: "success" });
      qc.invalidateQueries({ queryKey: ["sources"] });
      setToDelete(null);
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="API Sources" description="EDR/XDR/SIEM connectors feeding your dashboards.">
        {user?.can_manage && (
          <Link href="/sources/new">
            <Button>
              <Plus className="h-4 w-4" /> Add source
            </Button>
          </Link>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !sources || sources.length === 0 ? (
        <NoSources />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sources.map((s) => (
            <Card key={s.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Plug className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{s.vendor}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {s.last_status === "success" && (
                      <Badge variant="success" className="gap-1">
                        <CircleCheck className="h-3 w-3" /> Healthy
                      </Badge>
                    )}
                    {s.last_status === "failed" && (
                      <Badge variant="destructive" className="gap-1">
                        <CircleX className="h-3 w-3" /> Failed
                      </Badge>
                    )}
                    {!s.last_status && <Badge variant="secondary">Never run</Badge>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {s.refresh_interval_minutes < 60
                      ? `${s.refresh_interval_minutes}m`
                      : `${s.refresh_interval_minutes / 60}h`}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    {s.secret_mode === "per_login" ? <Lock className="h-3 w-3" /> : null}
                    {s.secret_mode === "per_login" ? "Key per login" : "Key saved"}
                  </Badge>
                  <Badge variant="outline">Updated {relativeTime(s.last_run_at)}</Badge>
                </div>

                {s.last_error && (
                  <p className="mt-3 truncate rounded bg-destructive/10 px-2 py-1 text-xs text-destructive" title={s.last_error}>
                    {s.last_error}
                  </p>
                )}

                {user?.can_manage && (
                  <div className="mt-4 flex gap-2">
                    <Link href={`/sources/${s.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => setToDelete(s)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!toDelete} onClose={() => setToDelete(null)}>
        <DialogHeader title="Delete source?" description={`This removes "${toDelete?.name}" and all its collected snapshots.`} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setToDelete(null)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={busy} onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
