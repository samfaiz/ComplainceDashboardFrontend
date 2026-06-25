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
import type { Granularity, SortMode, ThresholdDirection, TimeRange, Widget, WidgetConfig, WidgetType } from "@/lib/types";
import { PALETTES } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { NoSources } from "@/components/source-bar";
import { RoleGuard } from "@/components/role-guard";
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

const SORTS: { value: SortMode; label: string }[] = [
  { value: "value_desc", label: "Value (high → low)" },
  { value: "value_asc", label: "Value (low → high)" },
  { value: "label_asc", label: "Label (A → Z)" },
  { value: "none", label: "Server order" },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "14d", label: "Last 14 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All available" },
];

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly (avg)" },
];

const TOP_N_PRESETS = [5, 10, 20, 0];

interface PresetSpec {
  key: string;
  label: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
}

const PRESETS: PresetSpec[] = [
  {
    key: "stat-total",
    label: "Stat • Total endpoints",
    type: "stat",
    title: "Total Endpoints",
    config: { metric: "total" },
  },
  {
    key: "stat-compliance",
    label: "Stat • Compliance % with thresholds",
    type: "stat",
    title: "Compliance %",
    config: {
      metric: "compliance_pct",
      unitSuffix: "%",
      thresholds: { good: 90, warn: 70, direction: "higher_is_better" },
    },
  },
  {
    key: "gauge-compliance",
    label: "Gauge • Compliance % (color-graded)",
    type: "gauge",
    title: "Compliance Gauge",
    config: {
      metric: "compliance_pct",
      thresholds: { good: 90, warn: 70, direction: "higher_is_better" },
    },
  },
  {
    key: "pie-os-top5",
    label: "Pie • OS platform (top 5 + Other)",
    type: "pie",
    title: "OS Distribution",
    config: { field: "os_platform", sort: "value_desc", topN: 5, showOther: true, palette: "ocean", showLegend: true },
  },
  {
    key: "donut-health",
    label: "Donut • Health status",
    type: "donut",
    title: "Endpoint Health",
    config: { field: "health_status", sort: "value_desc", showLegend: true, showValues: true },
  },
  {
    key: "bar-agent-top10",
    label: "Bar • Agent versions (top 10, horizontal)",
    type: "bar",
    title: "Top Agent Versions",
    config: { field: "agent_version", horizontal: true, sort: "value_desc", topN: 10, showValues: true, palette: "forest" },
  },
  {
    key: "bar-os-version",
    label: "Bar • OS versions (top 5)",
    type: "bar",
    title: "OS Versions",
    config: { field: "os_version", sort: "value_desc", topN: 5, palette: "sunset", showValues: true },
  },
  {
    key: "line-compliance-30d",
    label: "Line • Compliance trend (30d daily)",
    type: "line",
    title: "Compliance Trend (30d)",
    config: { series: ["compliance_pct"], range: "30d", granularity: "day", unitSuffix: "%", smooth: true },
  },
  {
    key: "area-health-90d-weekly",
    label: "Area • Health counts (90d, weekly)",
    type: "area",
    title: "Health Trend (90d weekly)",
    config: { series: ["online", "stale", "offline"], range: "90d", granularity: "week", palette: "ocean" },
  },
  {
    key: "table-endpoints",
    label: "Table • All endpoints",
    type: "table",
    title: "Endpoints",
    config: {},
  },
];

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
  return (
    <RoleGuard require="manage">
      <BuilderPageInner />
    </RoleGuard>
  );
}

function BuilderPageInner() {
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
                drillEnabled={false}
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
  const initial = (widget?.config ?? {}) as WidgetConfig;

  const [type, setType] = useState<WidgetType>((widget?.type as WidgetType) ?? "stat");
  const [title, setTitle] = useState(widget?.title ?? "");

  // stat / gauge
  const [metric, setMetric] = useState(String(initial.metric ?? "total"));
  const initRule = initial.rule as { match?: string; conditions?: RuleCondition[] } | undefined;
  const [valueSource, setValueSource] = useState<"metric" | "rule">(initRule?.conditions?.length ? "rule" : "metric");
  const [match, setMatch] = useState<string>(initRule?.match ?? "all");
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initRule?.conditions ?? [{ field: "last_seen_days", op: "gt", value: "2" }]
  );
  const [display, setDisplay] = useState<string>(String(initial.display ?? "count"));
  const initThresholds = initial.thresholds ?? {};
  const [thresholdsOn, setThresholdsOn] = useState(initThresholds.good != null || initThresholds.warn != null);
  const [tGood, setTGood] = useState<string>(initThresholds.good?.toString() ?? "90");
  const [tWarn, setTWarn] = useState<string>(initThresholds.warn?.toString() ?? "70");
  const [tDir, setTDir] = useState<ThresholdDirection>(initThresholds.direction ?? "higher_is_better");

  // group-by (pie/donut/bar)
  const [field, setField] = useState(String(initial.field ?? "os_platform"));
  const [horizontal, setHorizontal] = useState(!!initial.horizontal);
  const [sort, setSort] = useState<SortMode>((initial.sort as SortMode) ?? "value_desc");
  const [topN, setTopN] = useState<number>(typeof initial.topN === "number" ? initial.topN : 0);
  const [showOther, setShowOther] = useState<boolean>(initial.showOther !== false);

  // series (line/area)
  const [series, setSeries] = useState<string[]>(initial.series ?? ["compliance_pct"]);
  const [range, setRange] = useState<TimeRange>((initial.range as TimeRange) ?? "30d");
  const [granularity, setGranularity] = useState<Granularity>((initial.granularity as Granularity) ?? "day");
  const [smooth, setSmooth] = useState<boolean>(initial.smooth !== false);

  // shared display
  const [palette, setPalette] = useState<string>(String(initial.palette ?? "default"));
  const [showLegend, setShowLegend] = useState<boolean>(initial.showLegend !== false);
  const [showValues, setShowValues] = useState<boolean>(initial.showValues === true);
  const [unitSuffix, setUnitSuffix] = useState<string>(String(initial.unitSuffix ?? ""));

  function applyPreset(key: string) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setType(p.type);
    setTitle(p.title);
    const c = p.config;
    if (c.metric) {
      setMetric(c.metric);
      setValueSource("metric");
    }
    if (c.field) setField(c.field);
    if (c.horizontal != null) setHorizontal(!!c.horizontal);
    if (c.sort) setSort(c.sort);
    if (c.topN != null) setTopN(c.topN);
    if (c.showOther != null) setShowOther(!!c.showOther);
    if (c.series) setSeries(c.series);
    if (c.range) setRange(c.range);
    if (c.granularity) setGranularity(c.granularity);
    if (c.smooth != null) setSmooth(!!c.smooth);
    if (c.palette) setPalette(c.palette);
    if (c.showLegend != null) setShowLegend(!!c.showLegend);
    if (c.showValues != null) setShowValues(!!c.showValues);
    if (c.unitSuffix != null) setUnitSuffix(c.unitSuffix);
    if (c.thresholds) {
      setThresholdsOn(true);
      if (c.thresholds.good != null) setTGood(String(c.thresholds.good));
      if (c.thresholds.warn != null) setTWarn(String(c.thresholds.warn));
      if (c.thresholds.direction) setTDir(c.thresholds.direction);
    } else {
      setThresholdsOn(false);
    }
  }

  function submit() {
    const config: WidgetConfig & Record<string, unknown> = {};

    if (type === "stat" || type === "gauge") {
      if (valueSource === "rule") {
        config.rule = { match, conditions };
        config.display = type === "gauge" ? "percent" : (display as "count" | "percent");
      } else {
        config.metric = metric;
      }
      if (thresholdsOn) {
        config.thresholds = {
          direction: tDir,
          ...(tGood !== "" ? { good: Number(tGood) } : {}),
          ...(tWarn !== "" ? { warn: Number(tWarn) } : {}),
        };
      }
      if (unitSuffix) config.unitSuffix = unitSuffix;
    } else if (type === "pie" || type === "donut" || type === "bar") {
      config.field = field;
      if (type === "bar") config.horizontal = horizontal;
      config.sort = sort;
      if (topN > 0) {
        config.topN = topN;
        config.showOther = showOther;
      }
      config.palette = palette;
      config.showLegend = showLegend;
      config.showValues = showValues;
    } else if (type === "line" || type === "area") {
      config.series = series;
      config.range = range;
      config.granularity = granularity;
      config.smooth = smooth;
      config.palette = palette;
      config.showLegend = showLegend;
      if (unitSuffix) config.unitSuffix = unitSuffix;
    }

    const finalTitle = title || TYPES.find((t) => t.value === type)?.label || "Widget";
    onSubmit(type, finalTitle, config);
  }

  const showGroupBy = type === "pie" || type === "donut" || type === "bar";
  const showTrend = type === "line" || type === "area";
  const showStat = type === "stat" || type === "gauge";

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title={isEdit ? "Edit widget" : "Add widget"} />
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {!isEdit && (
          <>
            <div className="space-y-2">
              <Label>Load preset</Label>
              <Select defaultValue="" onChange={(e) => e.target.value && applyPreset(e.target.value)}>
                <option value="">— start from scratch —</option>
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Picking a preset fills the form below. You can still tweak any field.</p>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as WidgetType)}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Widget title" />
        </div>

        {showStat && (
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
              <RuleBuilder
                match={match}
                setMatch={setMatch}
                conditions={conditions}
                setConditions={setConditions}
                type={type}
                display={display}
                setDisplay={setDisplay}
              />
            )}

            <div className="space-y-2 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={thresholdsOn}
                  onChange={(e) => setThresholdsOn(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Color by thresholds
              </label>
              {thresholdsOn && (
                <div className="space-y-2 pl-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Direction</Label>
                    <Select value={tDir} onChange={(e) => setTDir(e.target.value as ThresholdDirection)} className="h-8 w-auto">
                      <option value="higher_is_better">Higher is better</option>
                      <option value="lower_is_better">Lower is better</option>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Good ≥</Label>
                      <Input type="number" value={tGood} onChange={(e) => setTGood(e.target.value)} className="h-8 w-24" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Warn ≥</Label>
                      <Input type="number" value={tWarn} onChange={(e) => setTWarn(e.target.value)} className="h-8 w-24" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tDir === "higher_is_better"
                      ? `≥ ${tGood || "?"} green · ≥ ${tWarn || "?"} amber · else red`
                      : `≤ ${tGood || "?"} green · ≤ ${tWarn || "?"} amber · else red`}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Unit suffix</Label>
              <Input value={unitSuffix} onChange={(e) => setUnitSuffix(e.target.value)} placeholder="e.g. % or  endpoints" className="h-8 w-40" />
            </div>
          </div>
        )}

        {showGroupBy && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Group by field</Label>
              <Select value={field} onChange={(e) => setField(e.target.value)}>
                {FIELDS.map((f) => (
                  <option key={f} value={f}>
                    {titleCase(f)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sort</Label>
                <Select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="h-8">
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Top N</Label>
                <div className="flex flex-wrap items-center gap-1">
                  {TOP_N_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTopN(n)}
                      className={`rounded border px-2 py-1 text-xs ${topN === n ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                    >
                      {n === 0 ? "All" : n}
                    </button>
                  ))}
                  <Input
                    type="number"
                    min={0}
                    value={topN || ""}
                    onChange={(e) => setTopN(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="custom"
                    className="h-7 w-20 text-xs"
                  />
                </div>
              </div>
            </div>
            {topN > 0 && (
              <label className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={showOther} onChange={(e) => setShowOther(e.target.checked)} className="h-4 w-4 accent-primary" />
                Roll remainder into an &quot;Other&quot; bucket
              </label>
            )}
            {type === "bar" && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={horizontal} onChange={(e) => setHorizontal(e.target.checked)} className="h-4 w-4 accent-primary" />
                Horizontal bars
              </label>
            )}
            <PaletteAndDisplay
              palette={palette}
              setPalette={setPalette}
              showLegend={showLegend}
              setShowLegend={setShowLegend}
              showValues={showValues}
              setShowValues={setShowValues}
            />
          </div>
        )}

        {showTrend && (
          <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Time range</Label>
                <Select value={range} onChange={(e) => setRange(e.target.value as TimeRange)} className="h-8">
                  {TIME_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Granularity</Label>
                <Select value={granularity} onChange={(e) => setGranularity(e.target.value as Granularity)} className="h-8">
                  {GRANULARITIES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} className="h-4 w-4 accent-primary" />
              Smooth line
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs">Y-axis suffix</Label>
              <Input value={unitSuffix} onChange={(e) => setUnitSuffix(e.target.value)} placeholder="% (leave empty for none)" className="h-8 w-40" />
            </div>
            <PaletteAndDisplay
              palette={palette}
              setPalette={setPalette}
              showLegend={showLegend}
              setShowLegend={setShowLegend}
              showValues={showValues}
              setShowValues={setShowValues}
              hideValues
            />
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

function PaletteAndDisplay({
  palette,
  setPalette,
  showLegend,
  setShowLegend,
  showValues,
  setShowValues,
  hideValues = false,
}: {
  palette: string;
  setPalette: (s: string) => void;
  showLegend: boolean;
  setShowLegend: (b: boolean) => void;
  showValues: boolean;
  setShowValues: (b: boolean) => void;
  hideValues?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Color palette</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PALETTES).map(([key, colors]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPalette(key)}
              className={`flex items-center gap-2 rounded border px-2 py-1 text-xs capitalize ${palette === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
            >
              <span className="flex gap-0.5">
                {colors.slice(0, 4).map((c, i) => (
                  <span key={i} className="h-3 w-2 rounded-sm" style={{ background: c }} />
                ))}
              </span>
              {key}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={showLegend} onChange={(e) => setShowLegend(e.target.checked)} className="h-4 w-4 accent-primary" />
          Show legend
        </label>
        {!hideValues && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showValues} onChange={(e) => setShowValues(e.target.checked)} className="h-4 w-4 accent-primary" />
            Show values
          </label>
        )}
      </div>
    </div>
  );
}

function RuleBuilder({
  match,
  setMatch,
  conditions,
  setConditions,
  type,
  display,
  setDisplay,
}: {
  match: string;
  setMatch: (s: string) => void;
  conditions: RuleCondition[];
  setConditions: React.Dispatch<React.SetStateAction<RuleCondition[]>>;
  type: WidgetType;
  display: string;
  setDisplay: (s: string) => void;
}) {
  return (
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
  );
}
