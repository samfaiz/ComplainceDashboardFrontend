"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSites, useSources } from "@/lib/queries";
import { useToast } from "@/lib/toast";
import type { Site } from "@/lib/types";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function SitesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: sites } = useSites();
  const { data: sources } = useSources();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["sites"] });
    qc.invalidateQueries({ queryKey: ["sources"] });
    qc.invalidateQueries({ queryKey: ["insights"] });
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast({ title: ok, variant: "success" });
      refresh();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function addSite() {
    if (!newName.trim()) return;
    await run(() => api.post("/api/sites", { name: newName.trim() }), "Site created");
    setNewName("");
  }

  async function rename(site: { id: number; name: string }) {
    await run(() => api.put(`/api/sites/${site.id}`, { name: site.name }), "Site renamed");
    setEditing(null);
  }

  async function setSourceSite(sourceId: number, currentSiteId: number | null, value: string) {
    if (value === "") {
      if (currentSiteId) await run(() => api.post(`/api/sites/${currentSiteId}/assign`, { source_id: sourceId, attach: false }), "Source unassigned");
    } else {
      await run(() => api.post(`/api/sites/${Number(value)}/assign`, { source_id: sourceId, attach: true }), "Source assigned");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} className="max-w-xl">
      <DialogHeader title="Manage sites" description="Group your sources into sites so you can monitor each location — or all of them at once." />

      <div className="space-y-6">
        {/* Add */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New site name (e.g. HQ — London)"
            onKeyDown={(e) => e.key === "Enter" && addSite()}
          />
          <Button onClick={addSite} loading={busy} disabled={!newName.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {/* Site list */}
        <div className="space-y-2">
          <Label className="text-xs uppercase text-muted-foreground">Sites</Label>
          {sites && sites.length > 0 ? (
            sites.map((site: Site) => (
              <div key={site.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {editing?.id === site.id ? (
                  <>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ id: site.id, name: e.target.value })}
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && rename(editing)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => rename(editing)} loading={busy}>
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{site.name}</span>
                    <span className="text-xs text-muted-foreground">{site.sources_count} source(s)</span>
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ id: site.id, name: site.name })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => run(() => api.del(`/api/sites/${site.id}`), "Site deleted")}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No sites yet. Add one above.</p>
          )}
        </div>

        {/* Source → site assignment */}
        {sources && sources.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Assign sources</Label>
            {sources.map((src) => (
              <div key={src.id} className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm">{src.name}</span>
                <Select
                  value={src.site_id ?? ""}
                  onChange={(e) => setSourceSite(src.id, src.site_id, e.target.value)}
                  className="h-8 w-44"
                >
                  <option value="">— No site —</option>
                  {sites?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
