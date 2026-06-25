"use client";

import { useState } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ArrowUpDown, ChevronDown, ChevronUp, Download, Search, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
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
  is_isolated?: boolean | null;
  extra?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
}

interface DataResponse {
  data: EndpointRow[];
  meta: { total: number; per_page: number; current_page: number; last_page: number };
}

interface ColumnDef {
  field: string;
  label: string;
  visible: boolean;
}

interface AvailableField {
  key: string;
  label: string;
  group: "standard" | "custom" | "raw";
}

interface ColumnsResponse {
  available: AvailableField[];
  default: ColumnDef[] | null;
  mine: ColumnDef[] | null;
}

const BUILT_IN: ColumnDef[] = [
  { field: "hostname", label: "Hostname", visible: true },
  { field: "os_platform", label: "OS", visible: true },
  { field: "os_version", label: "OS Version", visible: true },
  { field: "agent_version", label: "Agent", visible: true },
  { field: "health_status", label: "Health", visible: true },
  { field: "compliance_status", label: "Compliance", visible: true },
  { field: "last_seen_at", label: "Last Seen", visible: true },
  { field: "ip_address", label: "IP", visible: true },
];

// Fields the backend can sort on (standard columns only).
const SORTABLE = new Set([
  "hostname", "os_platform", "os_version", "agent_version", "health_status",
  "compliance_status", "ip_address", "mac_address", "last_seen_at", "external_id",
]);
const MONO = new Set(["agent_version", "ip_address", "mac_address", "external_id"]);

const COMPACT_COLS: ColumnDef[] = [
  { field: "hostname", label: "Hostname", visible: true },
  { field: "os_platform", label: "OS", visible: true },
  { field: "agent_version", label: "Agent", visible: true },
  { field: "health_status", label: "Health", visible: true },
  { field: "compliance_status", label: "Compliance", visible: true },
  { field: "last_seen_at", label: "Last Seen", visible: true },
];

/** Render any value (scalar, array, or object) as a readable string. */
function formatVal(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => (x !== null && typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Plain string value (for CSV + non-badge cells). */
function rawValue(row: EndpointRow, field: string): string {
  if (field.startsWith("extra.")) return formatVal(row.extra?.[field.slice(6)]);
  if (field.startsWith("raw.")) return formatVal(row.raw?.[field.slice(4)]);
  if (field === "last_seen_at") return row.last_seen_at ?? "";
  if (field === "is_isolated") return row.is_isolated ? "Yes" : "No";
  const v = (row as unknown as Record<string, unknown>)[field];
  return v == null ? "" : String(v);
}

function buildDraft(layout: ColumnDef[], available: AvailableField[]): ColumnDef[] {
  const inLayout = new Set(layout.map((c) => c.field));
  const stillAvailable = (f: string) => available.some((a) => a.key === f);
  const ordered = layout.filter((c) => stillAvailable(c.field));
  for (const a of available) {
    if (!inLayout.has(a.key)) ordered.push({ field: a.key, label: a.label, visible: false });
  }
  return ordered;
}

export function EndpointTable({ scope, compact = false }: { scope?: string; compact?: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [os, setOs] = useState("");
  const [health, setHealth] = useState("");
  const [compliance, setCompliance] = useState("");
  const [sort, setSort] = useState("hostname");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [managerOpen, setManagerOpen] = useState(false);

  const perPage = compact ? 8 : 25;

  const { data: cols } = useQuery({
    queryKey: ["endpoint-columns", scope],
    enabled: !!scope && !compact,
    queryFn: () => api.get<ColumnsResponse>("/api/endpoint-columns", { scope }),
  });

  // Effective layout: personal override → shared default → built-in.
  const layout = compact ? COMPACT_COLS : cols?.mine ?? cols?.default ?? BUILT_IN;
  const visibleCols = layout.filter((c) => c.visible);
  const needsRaw = visibleCols.some((c) => c.field.startsWith("raw."));

  const { data, isLoading } = useQuery({
    queryKey: ["endpoints", scope, { page, search, os, health, compliance, sort, dir, perPage, needsRaw }],
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
        with_raw: needsRaw ? 1 : undefined,
      }),
  });

  function toggleSort(col: string) {
    if (!SORTABLE.has(col)) return;
    if (sort === col) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(col);
      setDir("asc");
    }
  }

  function exportCsv() {
    const rows = data?.data ?? [];
    const csv = [
      visibleCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(","),
      ...rows.map((r) => visibleCols.map((c) => `"${rawValue(r, c.field).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "endpoints.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderCell(row: EndpointRow, field: string) {
    if (field === "health_status") {
      return row.health_status ? <Badge variant={healthBadgeVariant(row.health_status)}>{titleCase(row.health_status)}</Badge> : "—";
    }
    if (field === "compliance_status") {
      return row.compliance_status ? <Badge variant={complianceBadgeVariant(row.compliance_status)}>{titleCase(row.compliance_status)}</Badge> : "—";
    }
    if (field === "last_seen_at") return relativeTime(row.last_seen_at);
    const v = rawValue(row, field);
    if (v === "") return "—";
    if (field.startsWith("extra.") || field.startsWith("raw.")) {
      return <span className="block max-w-[260px] truncate" title={v}>{v}</span>;
    }
    return v;
  }

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
          <Button variant="outline" size="sm" onClick={() => setManagerOpen(true)}>
            <Settings2 className="h-4 w-4" /> Columns
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      )}

      <div className={compact ? "min-h-0 flex-1 overflow-auto" : "rounded-lg border"}>
        <Table>
          <THead>
            <TR>
              {visibleCols.map((c) => (
                <TH key={c.field}>
                  {SORTABLE.has(c.field) ? (
                    <button onClick={() => toggleSort(c.field)} className="flex items-center gap-1 hover:text-foreground">
                      {c.label}
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </button>
                  ) : (
                    c.label
                  )}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {isLoading ? (
              Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
                <TR key={i}>
                  {visibleCols.map((c) => (
                    <TD key={c.field}><Skeleton className="h-4 w-full" /></TD>
                  ))}
                </TR>
              ))
            ) : data && data.data.length > 0 ? (
              data.data.map((r) => (
                <TR key={r.id}>
                  {visibleCols.map((c) => (
                    <TD
                      key={c.field}
                      className={
                        c.field === "hostname"
                          ? "font-medium"
                          : MONO.has(c.field)
                            ? "font-mono text-xs"
                            : c.field === "last_seen_at"
                              ? "whitespace-nowrap text-muted-foreground"
                              : c.field.startsWith("extra.") || c.field.startsWith("raw.")
                                ? "text-muted-foreground"
                                : undefined
                      }
                    >
                      {renderCell(r, c.field)}
                    </TD>
                  ))}
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={visibleCols.length || 1} className="py-10 text-center text-muted-foreground">
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

      {managerOpen && cols && (
        <ColumnsDialog available={cols.available} current={layout} onClose={() => setManagerOpen(false)} />
      )}
    </div>
  );
}

/* ------------------------------ Column manager ---------------------------- */

function ColumnsDialog({
  available,
  current,
  onClose,
}: {
  available: AvailableField[];
  current: ColumnDef[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [draft, setDraft] = useState<ColumnDef[]>(() => buildDraft(current, available));
  const [busy, setBusy] = useState(false);

  function move(i: number, delta: number) {
    setDraft((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.length) return d;
      const next = [...d];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function patch(i: number, p: Partial<ColumnDef>) {
    setDraft((d) => d.map((c, j) => (j === i ? { ...c, ...p } : c)));
  }

  async function save(asDefault: boolean) {
    setBusy(true);
    try {
      await api.put("/api/endpoint-columns", { columns: draft, as_default: asDefault });
      qc.invalidateQueries({ queryKey: ["endpoint-columns"] });
      toast({ title: asDefault ? "Default layout saved for everyone" : "Columns saved", variant: "success" });
      onClose();
    } catch {
      toast({ title: "Could not save columns", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function resetMine() {
    setBusy(true);
    try {
      await api.del("/api/endpoint-columns");
      qc.invalidateQueries({ queryKey: ["endpoint-columns"] });
      toast({ title: "Reset to the default layout", variant: "success" });
      onClose();
    } catch {
      toast({ title: "Could not reset", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const fieldGroup = (f: string) => available.find((a) => a.key === f)?.group ?? "standard";

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Manage columns" description="Show/hide, rename, and reorder. Custom fields you mapped on a source appear here too." />
      <div className="space-y-2">
        {draft.map((c, i) => (
          <div key={c.field} className="flex items-center gap-2 rounded-md border p-2">
            <input
              type="checkbox"
              checked={c.visible}
              onChange={(e) => patch(i, { visible: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <Input value={c.label} onChange={(e) => patch(i, { label: e.target.value })} className="h-8 flex-1 text-sm" />
            {fieldGroup(c.field) !== "standard" && (
              <Badge variant="secondary" className="shrink-0">{fieldGroup(c.field) === "raw" ? "api" : "custom"}</Badge>
            )}
            <div className="flex shrink-0">
              <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === draft.length - 1}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {draft.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No fields available.</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={resetMine} disabled={busy}>
          Reset to default
        </Button>
        <div className="flex gap-2">
          {user?.is_admin && (
            <Button variant="outline" size="sm" onClick={() => save(true)} loading={busy}>
              Save as default
            </Button>
          )}
          <Button size="sm" onClick={() => save(false)} loading={busy}>
            Save for me
          </Button>
        </div>
      </div>
      {user?.is_admin && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          “Save as default” sets the layout everyone starts with; “Save for me” only changes your own view.
        </p>
      )}
    </Dialog>
  );
}
