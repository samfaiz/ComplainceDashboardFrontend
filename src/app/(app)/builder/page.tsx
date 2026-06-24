"use client";

import { useEffect, useMemo, useState } from "react";
import RGL, { WidthProvider, type Layout, type LayoutItem } from "react-grid-layout/legacy";
import { useQueryClient } from "@tanstack/react-query";
import { GripVertical, Pencil, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useDefaultDashboard, useScopeSummary, useScopeTrends } from "@/lib/queries";
import { useScope } from "@/lib/use-scope";
import { useToast } from "@/lib/toast";
import { titleCase } from "@/lib/format";
import type { Widget } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { NoSources } from "@/components/source-bar";
import { ScopeBar } from "@/components/scope-bar";
import { WidgetCard } from "@/components/dashboard-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader } from "@/components/ui/dialog";

const Grid = WidthProvider(RGL);

const TYPES = [
  { value: "stat", label: "Stat — single metric" },
  { value: "gauge", label: "Gauge — percentage" },
  { value: "pie", label: "Pie chart" },
  { value: "donut", label: "Donut chart" },
  { value: "bar", label: "Bar chart" },
  { value: "line", label: "Line — trend over time" },
  { value: "area", label: "Area — trend over time" },
  { value: "table", label: "Endpoint table" },
];
const METRICS = ["total", "online", "stale", "offline", "compliant", "non_compliant", "compliance_pct"];
const FIELDS = ["os_platform", "os_version", "agent_version", "health_status", "compliance_status", "ip_address", "mac_address"];
const SERIES = ["compliance_pct", "total", "online", "stale", "offline", "compliant", "non_compliant"];

const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  stat: { w: 3, h: 2 },
  gauge: { w: 3, h: 2 },
  pie: { w: 4, h: 4 },
  donut: { w: 4, h: 4 },
  bar: { w: 4, h: 4 },
  line: { w: 6, h: 4 },
  area: { w: 6, h: 4 },
  table: { w: 12, h: 6 },
};

interface RuleCondition {
  field: string;
  op: string;
  value: string;
}

const RULE_FIELDS: { value: string; label: string; type: "duration" | "enum" | "bool" | "text"; options?: string[] }[] = [
  { value: "last_seen_days", label: "Last seen (days ago)", type: "duration" },
  { value: "health_status", label: "Health status", type: "enum", options: ["online", "stale", "offline", "error", "unknown"] },
  { value: "compliance_status", label: "Compliance", type: "enum", options: ["compliant", "non_compliant", "unknown"] },
  { value: "os_platform", label: "OS platform", type: "enum", options: ["Windows", "macOS", "Linux", "Android", "iOS"] },
  { value: "is_isolated", label: "Isolated", type: "bool" },
  { value: "agent_version", label: "Agent / sensor version", type: "text" },
  { value: "os_version", label: "OS version", type: "text" },
  { value: "hostname", label: "Hostname", type: "text" },
  { value: "ip_address", label: "IP address", type: "text" },
];

const ruleFieldMeta = (f: string) => RULE_FIELDS.find((x) => x.value === f) ?? RULE_FIELDS[0];

function opsFor(t: string) {
  if (t === "duration") return [{ value: "gt", label: "more than" }, { value: "lt", label: "within" }];
  if (t === "enum") return [{ value: "eq", label: "is" }, { value: "neq", label: "is not" }, { value: "in", label: "is any of" }];
  if (t === "bool") return [{ value: "eq", label: "is" }];
  return [
    { value: "eq", label: "equals" },
    { value: "neq", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "is_empty", label: "is empty" },
    { value: "not_empty", label: "is not empty" },
  ];
}

export default function BuilderPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { scope, setScope, sources, sites, sourcesInScope, hasAny } = useScope();
  const { data: dashboard } = useDefaultDashboard();
  const { data: summaryRes } = useScopeSummary(scope);
  const { data: trends } = useScopeTrends(scope);

  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [mounted, setMounted] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Widget | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (dashboard) setWidgets(dashboard.layout ?? []);
  }, [dashboard]);

  const rglLayout: LayoutItem[] = useMemo(
    () => widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h, minW: 2, minH: 2 })),
    [widgets]
  );

  function onLayoutChange(layout: Layout) {
    setWidgets((prev) =>
      prev.map((w) => {
        const l = layout.find((x) => x.i === w.id);
        return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
      })
    );
    setDirty(true);
  }

  function upsertWidget(widget: Widget) {
    setWidgets((prev) => {
      const exists = prev.some((w) => w.id === widget.id);
      return exists ? prev.map((w) => (w.id === widget.id ? widget : w)) : [...prev, widget];
    });
    setDirty(true);
  }

  function removeWidget(id: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    setDirty(true);
  }

  function addWidget(type: string, title: string, config: Record<string, unknown>) {
    const maxY = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const size = DEFAULT_SIZE[type] ?? { w: 4, h: 4 };
    upsertWidget({
      id: `w-${Date.now()}`,
      type: type as Widget["type"],
      title,
      config,
      x: 0,
      y: maxY,
      ...size,
    });
  }

  async function save() {
    if (!dashboard) return;
    setSaving(true);
    try {
      await api.put(`/api/dashboards/${dashboard.id}`, { layout: widgets });
      toast({ title: "Dashboard saved", description: "Your layout will load on every login.", variant: "success" });
      qc.invalidateQueries({ queryKey: ["dashboard", "default"] });
      setDirty(false);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (!hasAny) {
    return (
      <div className="space-y-5">
        <PageHeader title="Customize Dashboard" />
        <NoSources />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Customize Dashboard" description="Drag, resize, add or remove widgets. Saved per user.">
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> Add widget
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (dashboard) setWidgets(dashboard.layout ?? []);
            setDirty(false);
          }}
          disabled={!dirty}
        >
          <RotateCcw className="h-4 w-4" /> Revert
        </Button>
        <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </PageHeader>

      <ScopeBar scope={scope} setScope={setScope} sources={sources} sites={sites} sourcesInScope={sourcesInScope} />

      {mounted && (
        <Grid
          className="layout"
          layout={rglLayout}
          cols={12}
          rowHeight={70}
          margin={[16, 16]}
          isDraggable
          isResizable
          draggableHandle=".drag-handle"
          onLayoutChange={onLayoutChange}
        >
          {widgets.map((w) => (
            <div key={w.id}>
              <WidgetCard
                widget={w}
                scope={scope}
                summary={summaryRes?.summary}
                trends={trends}
                actions={
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(w)} className="text-muted-foreground hover:text-foreground" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeWidget(w.id)} className="text-muted-foreground hover:text-destructive" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <span className="drag-handle cursor-move text-muted-foreground hover:text-foreground" title="Drag">
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </div>
                }
              />
            </div>
          ))}
        </Grid>
      )}

      {(adding || editing) && (
        <WidgetConfigDialog
          widget={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSubmit={(type, title, config) => {
            if (editing) upsertWidget({ ...editing, title, config });
            else addWidget(type, title, config);
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function WidgetConfigDialog({
  widget,
  onClose,
  onSubmit,
}: {
  widget: Widget | null;
  onClose: () => void;
  onSubmit: (type: string, title: string, config: Record<string, unknown>) => void;
}) {
  const isEdit = !!widget;
  const [type, setType] = useState<string>(widget?.type ?? "stat");
  const [title, setTitle] = useState(widget?.title ?? "");
  const [metric, setMetric] = useState(String(widget?.config?.metric ?? "total"));
  const [field, setField] = useState(String(widget?.config?.field ?? "os_platform"));
  const [horizontal, setHorizontal] = useState(!!widget?.config?.horizontal);
  const [series, setSeries] = useState<string[]>((widget?.config?.series as string[]) ?? ["compliance_pct"]);

  const initRule = widget?.config?.rule as { match?: string; conditions?: RuleCondition[] } | undefined;
  const [valueSource, setValueSource] = useState<"metric" | "rule">(initRule?.conditions?.length ? "rule" : "metric");
  const [match, setMatch] = useState<string>(initRule?.match ?? "all");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initRule?.conditions ?? [{ field: "last_seen_days", op: "gt", value: "2" }]
  );
  const [display, setDisplay] = useState<string>(String(widget?.config?.display ?? "count"));

  function submit() {
    let config: Record<string, unknown> = {};
    if (type === "stat" || type === "gauge") {
      config =
        valueSource === "rule"
          ? { rule: { match, conditions }, display: type === "gauge" ? "percent" : display }
          : { metric };
    } else if (type === "pie" || type === "donut") config = { field };
    else if (type === "bar") config = { field, horizontal };
    else if (type === "line" || type === "area") config = { series };
    const finalTitle = title || TYPES.find((t) => t.value === type)?.label || "Widget";
    onSubmit(type, finalTitle, config);
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title={isEdit ? "Edit widget" : "Add widget"} />
      <div className="space-y-4">
        {!isEdit && (
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Widget title" />
        </div>

        {(type === "stat" || type === "gauge") && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Value source</Label>
              <Select value={valueSource} onChange={(e) => setValueSource(e.target.value as "metric" | "rule")}>
                <option value="metric">Preset metric</option>
                <option value="rule">Custom rule (count matching endpoints)</option>
              </Select>
            </div>

            {valueSource === "metric" ? (
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
                  {METRICS.map((m) => (
                    <option key={m} value={m}>
                      {titleCase(m)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  Match
                  <Select value={match} onChange={(e) => setMatch(e.target.value)} className="h-8 w-auto">
                    <option value="all">ALL</option>
                    <option value="any">ANY</option>
                  </Select>
                  of these conditions:
                </div>

                {conditions.map((c, i) => {
                  const meta = ruleFieldMeta(c.field);
                  const ops = opsFor(meta.type);
                  const setC = (patch: Partial<RuleCondition>) =>
                    setConditions((prev) => prev.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={c.field}
                        onChange={(e) => {
                          const nm = ruleFieldMeta(e.target.value);
                          setC({ field: e.target.value, op: opsFor(nm.type)[0].value, value: nm.type === "duration" ? "2" : "" });
                        }}
                        className="h-8 w-auto min-w-[150px]"
                      >
                        {RULE_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </Select>
                      <Select value={c.op} onChange={(e) => setC({ op: e.target.value })} className="h-8 w-auto">
                        {ops.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>

                      {meta.type === "duration" && (
                        <div className="flex items-center gap-1">
                          <Input type="number" value={c.value} onChange={(e) => setC({ value: e.target.value })} className="h-8 w-20" />
                          <span className="text-xs text-muted-foreground">days</span>
                        </div>
                      )}
                      {meta.type === "bool" && (
                        <Select value={c.value || "true"} onChange={(e) => setC({ value: e.target.value })} className="h-8 w-auto">
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </Select>
                      )}
                      {meta.type === "enum" && c.op !== "in" && (
                        <Select value={c.value} onChange={(e) => setC({ value: e.target.value })} className="h-8 w-auto">
                          <option value="">—</option>
                          {meta.options!.map((o) => (
                            <option key={o} value={o}>
                              {titleCase(o)}
                            </option>
                          ))}
                        </Select>
                      )}
                      {meta.type === "enum" && c.op === "in" && (
                        <Input value={c.value} onChange={(e) => setC({ value: e.target.value })} placeholder="online, stale" className="h-8 w-40" />
                      )}
                      {meta.type === "text" && !["is_empty", "not_empty"].includes(c.op) && (
                        <Input value={c.value} onChange={(e) => setC({ value: e.target.value })} placeholder="value" className="h-8 w-40" />
                      )}

                      {conditions.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConditions((prev) => [...prev, { field: "health_status", op: "eq", value: "offline" }])}
                >
                  <Plus className="h-4 w-4" /> Add condition
                </Button>

                {type === "stat" && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs">Show as</Label>
                    <Select value={display} onChange={(e) => setDisplay(e.target.value)} className="h-8 w-auto">
                      <option value="count">Count</option>
                      <option value="percent">Percent of total</option>
                    </Select>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  The Title above is free text — name it to match your rule, e.g. &quot;Offline &gt; 2 days&quot;.
                </p>
              </div>
            )}
          </div>
        )}

        {(type === "pie" || type === "donut" || type === "bar") && (
          <div className="space-y-2">
            <Label>Group by field</Label>
            <Select value={field} onChange={(e) => setField(e.target.value)}>
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {titleCase(f)}
                </option>
              ))}
            </Select>
            {type === "bar" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={horizontal} onChange={(e) => setHorizontal(e.target.checked)} className="h-4 w-4 accent-primary" />
                Horizontal bars
              </label>
            )}
          </div>
        )}

        {(type === "line" || type === "area") && (
          <div className="space-y-2">
            <Label>Series</Label>
            <div className="grid grid-cols-2 gap-2">
              {SERIES.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={series.includes(s)}
                    onChange={(e) =>
                      setSeries((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  {titleCase(s)}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{isEdit ? "Save widget" : "Add widget"}</Button>
        </div>
      </div>
    </Dialog>
  );
}
