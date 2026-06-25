"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useScopeAggregate, useScopeRule } from "@/lib/queries";
import {
  COMPLIANCE_COLORS,
  HEALTH_COLORS,
  paletteFor,
  titleCase,
} from "@/lib/format";
import type { Summary, Widget, WidgetConfig, WidgetThresholds } from "@/lib/types";
import type { DrillCriteria } from "./endpoint-drill-dialog";
import { EndpointTable } from "./endpoint-table";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

function colorFor(field: string, label: string, index: number, palette: string[]): string {
  if (field === "health_status") return HEALTH_COLORS[label] ?? palette[index % palette.length];
  if (field === "compliance_status") return COMPLIANCE_COLORS[label] ?? palette[index % palette.length];
  return palette[index % palette.length];
}

function Empty({ text = "No data" }: { text?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

function cfg(widget: Widget): WidgetConfig {
  return widget.config as WidgetConfig;
}

function thresholdColor(value: number, t: WidgetThresholds | undefined): string {
  if (!t || (t.good == null && t.warn == null)) return "var(--color-foreground)";
  const dir = t.direction ?? "higher_is_better";
  const good = t.good ?? (dir === "higher_is_better" ? Infinity : -Infinity);
  const warn = t.warn ?? good;
  if (dir === "higher_is_better") {
    if (value >= good) return "var(--color-success)";
    if (value >= warn) return "var(--color-warning)";
    return "var(--color-destructive)";
  }
  if (value <= good) return "var(--color-success)";
  if (value <= warn) return "var(--color-warning)";
  return "var(--color-destructive)";
}

function shapeBuckets(
  buckets: { label: string; value: number }[],
  c: WidgetConfig
): { label: string; value: number }[] {
  let out = [...buckets];
  const sort = c.sort ?? "value_desc";
  if (sort === "value_desc") out.sort((a, b) => b.value - a.value);
  else if (sort === "value_asc") out.sort((a, b) => a.value - b.value);
  else if (sort === "label_asc") out.sort((a, b) => a.label.localeCompare(b.label));

  const topN = c.topN ?? 0;
  if (topN > 0 && out.length > topN) {
    const head = out.slice(0, topN);
    if (c.showOther !== false) {
      const rest = out.slice(topN).reduce((s, b) => s + b.value, 0);
      if (rest > 0) head.push({ label: "Other", value: rest });
    }
    out = head;
  }
  return out;
}

function filterTrends(
  trends: Record<string, number | string>[] | undefined,
  c: WidgetConfig
): Record<string, number | string>[] {
  if (!trends) return [];
  const range = c.range ?? "30d";
  let filtered = trends;
  if (range !== "all") {
    const days = parseInt(range, 10);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered = trends.filter((t) => new Date(String(t.captured_at)).getTime() >= cutoff);
  }
  if ((c.granularity ?? "day") === "week") {
    const groups = new Map<string, Record<string, number | string>[]>();
    for (const row of filtered) {
      const d = new Date(String(row.captured_at));
      const key = weekKey(d);
      const arr = groups.get(key) ?? [];
      arr.push(row);
      groups.set(key, arr);
    }
    const numericKeys = Object.keys(filtered[0] ?? {}).filter(
      (k) => k !== "captured_at" && typeof filtered[0]?.[k] === "number"
    );
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([key, rows]) => {
        const avg: Record<string, number | string> = { captured_at: rows[rows.length - 1].captured_at };
        for (const k of numericKeys) {
          avg[k] = Math.round(rows.reduce((s, r) => s + Number(r[k] ?? 0), 0) / rows.length);
        }
        avg.label = `W of ${key}`;
        return avg;
      });
  }
  return filtered;
}

function weekKey(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function WidgetBody({
  widget,
  scope,
  summary,
  trends,
  dashboardId,
  onDrill,
}: {
  widget: Widget;
  scope?: string;
  summary?: Summary | null;
  trends?: Record<string, number | string>[];
  dashboardId?: number | null;
  onDrill?: (criteria: DrillCriteria) => void;
}) {
  const type = widget.type;

  if (type === "stat") {
    return <StatWidget widget={widget} scope={scope} summary={summary} dashboardId={dashboardId} onDrill={onDrill} />;
  }

  if (type === "gauge") {
    return <GaugeWidget widget={widget} scope={scope} summary={summary} dashboardId={dashboardId} onDrill={onDrill} />;
  }

  if (type === "line" || type === "area") {
    const c = cfg(widget);
    const palette = paletteFor(c.palette);
    const series = c.series ?? ["compliance_pct"];
    const shaped = filterTrends(trends, c);
    if (shaped.length === 0) return <Empty />;
    const formatted = shaped.map((t) => ({
      ...t,
      label:
        t.label ??
        new Date(String(t.captured_at)).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
    const Chart = type === "area" ? AreaChart : LineChart;
    const showLegend = c.showLegend !== false;
    const lineType = c.smooth === false ? "linear" : "monotone";
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickFormatter={(v) => `${v}${c.unitSuffix ?? ""}`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(v) => `${v}${c.unitSuffix ?? ""}`}
          />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {series.map((key, i) =>
            type === "area" ? (
              <Area
                key={key}
                type={lineType}
                dataKey={key}
                name={titleCase(key)}
                stroke={palette[i % palette.length]}
                fill={palette[i % palette.length]}
                fillOpacity={0.2}
              />
            ) : (
              <Line
                key={key}
                type={lineType}
                dataKey={key}
                name={titleCase(key)}
                stroke={palette[i % palette.length]}
                strokeWidth={2}
                dot={false}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    );
  }

  if (type === "table") {
    return <EndpointTable scope={scope} compact />;
  }

  // pie / donut / bar => aggregate by field
  return <AggregateChart widget={widget} scope={scope} dashboardId={dashboardId} onDrill={onDrill} />;
}

/** Map a preset metric to a drill filter, or null if it doesn't map cleanly. */
function metricToFilter(metric: string): { field: string; value: string } | null {
  switch (metric) {
    case "online":
    case "stale":
    case "offline":
      return { field: "health_status", value: metric };
    case "compliant":
    case "non_compliant":
      return { field: "compliance_status", value: metric };
    default:
      return null; // total / compliance_pct → no clean single filter
  }
}

function ruleOf(widget: Widget): { match?: string; conditions?: unknown[] } | null {
  const rule = widget.config.rule as { match?: string; conditions?: unknown[] } | undefined;
  return rule && Array.isArray(rule.conditions) && rule.conditions.length > 0 ? rule : null;
}

function StatWidget({ widget, scope, summary, dashboardId, onDrill }: { widget: Widget; scope?: string; summary?: Summary | null; dashboardId?: number | null; onDrill?: (c: DrillCriteria) => void }) {
  const c = cfg(widget);
  const rule = ruleOf(widget);
  const { data: ruleData } = useScopeRule(scope, rule, !!rule, dashboardId);

  let value: number = 0;
  let suffix = c.unitSuffix ?? "";
  let footnote: string | null = null;

  if (rule) {
    const display = String(c.display ?? "count");
    if (display === "percent") {
      value = ruleData?.pct ?? 0;
      suffix = suffix || "%";
    } else {
      value = ruleData?.count ?? 0;
      footnote = ruleData ? `of ${ruleData.total} endpoints` : null;
    }
  } else {
    const metric = String(c.metric ?? "total");
    value = summary ? (summary as unknown as Record<string, number>)[metric] ?? 0 : 0;
    if (!suffix) suffix = metric === "compliance_pct" ? "%" : "";
  }

  const color = thresholdColor(value, c.thresholds);

  const drill = drillForStat(widget, rule);
  const canDrill = !!onDrill && !!drill;

  return (
    <div
      className={`flex h-full flex-col justify-center ${canDrill ? "cursor-pointer rounded transition-colors hover:bg-muted/40" : ""}`}
      onClick={canDrill ? () => onDrill!(drill!) : undefined}
      title={canDrill ? "Click to see matching endpoints" : undefined}
    >
      <div className="text-4xl font-semibold tracking-tight" style={{ color }}>
        {value}
        <span className="text-xl text-muted-foreground">{suffix}</span>
      </div>
      {footnote && <p className="mt-1 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

function drillForStat(widget: Widget, rule: { match?: string; conditions?: unknown[] } | null): DrillCriteria | null {
  if (rule) {
    return {
      title: widget.title + " — matching endpoints",
      rule: rule as { match?: string; conditions: Array<{ field: string; op: string; value: string }> },
    };
  }
  const metric = String((widget.config as WidgetConfig).metric ?? "total");
  const filter = metricToFilter(metric);
  if (!filter) {
    if (metric === "total") {
      return { title: widget.title + " — all endpoints" };
    }
    return null;
  }
  return { title: `${widget.title} — ${filter.value}`, filter };
}

function GaugeWidget({ widget, scope, summary, dashboardId, onDrill }: { widget: Widget; scope?: string; summary?: Summary | null; dashboardId?: number | null; onDrill?: (c: DrillCriteria) => void }) {
  const c = cfg(widget);
  const rule = ruleOf(widget);
  const { data: ruleData } = useScopeRule(scope, rule, !!rule, dashboardId);

  const value = rule
    ? ruleData?.pct ?? 0
    : summary
      ? (summary as unknown as Record<string, number>)[String(c.metric ?? "compliance_pct")] ?? 0
      : 0;

  const color = c.thresholds ? thresholdColor(value, c.thresholds) : "var(--color-primary)";
  const data = [{ name: "value", value, fill: color }];
  const suffix = c.unitSuffix ?? "%";

  const drill = drillForStat(widget, rule);
  const canDrill = !!onDrill && !!drill;

  return (
    <div
      className={`h-full w-full ${canDrill ? "cursor-pointer" : ""}`}
      onClick={canDrill ? () => onDrill!(drill!) : undefined}
      title={canDrill ? "Click to see matching endpoints" : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={8} />
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 24, fontWeight: 600, fill: color }}>
            {value}{suffix}
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

function AggregateChart({ widget, scope, dashboardId, onDrill }: { widget: Widget; scope?: string; dashboardId?: number | null; onDrill?: (c: DrillCriteria) => void }) {
  const c = cfg(widget);
  const field = String(c.field ?? "os_platform");
  const palette = paletteFor(c.palette);
  const { data: rawBuckets, isLoading } = useScopeAggregate(scope, field, true, dashboardId);

  if (isLoading) return <Empty text="Loading…" />;
  if (!rawBuckets || rawBuckets.length === 0) return <Empty />;
  const buckets = shapeBuckets(rawBuckets, c);

  const showLegend = c.showLegend !== false;
  const showValues = c.showValues === true;

  // Drill handler: ignore the "Other" rollup bucket since it's not a single value.
  function drillTo(label: string) {
    if (!onDrill || !label || label === "Other") return;
    onDrill({
      title: `${widget.title} — ${label}`,
      filter: { field, value: label },
    });
  }
  const cursorStyle = onDrill ? "pointer" : undefined;

  if (widget.type === "bar") {
    const horizontal = !!c.horizontal;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buckets}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 20 : -16 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
            </>
          )}
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)", opacity: 0.3 }} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            onClick={(d: unknown) => {
              const label = (d as { payload?: { label?: string }; label?: string } | undefined)?.payload?.label
                ?? (d as { label?: string } | undefined)?.label;
              if (label) drillTo(label);
            }}
            style={{ cursor: cursorStyle }}
          >
            {buckets.map((b, i) => (
              <Cell key={b.label} fill={colorFor(field, b.label, i, palette)} />
            ))}
            {showValues && (
              <LabelList
                dataKey="value"
                position={horizontal ? "right" : "top"}
                style={{ fontSize: 11, fill: "var(--color-foreground)" }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // pie / donut
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={buckets}
          dataKey="value"
          nameKey="label"
          innerRadius={widget.type === "donut" ? "55%" : 0}
          outerRadius="80%"
          paddingAngle={2}
          label={showValues ? (entry) => `${entry.value}` : false}
          onClick={(d: unknown) => {
            const label = (d as { payload?: { label?: string }; label?: string } | undefined)?.payload?.label
              ?? (d as { label?: string } | undefined)?.label;
            if (label) drillTo(label);
          }}
          style={{ cursor: cursorStyle }}
        >
          {buckets.map((b, i) => (
            <Cell key={b.label} fill={colorFor(field, b.label, i, palette)} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
      </PieChart>
    </ResponsiveContainer>
  );
}

