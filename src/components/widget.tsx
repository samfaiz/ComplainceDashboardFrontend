"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  CHART_PALETTE,
  COMPLIANCE_COLORS,
  HEALTH_COLORS,
  titleCase,
} from "@/lib/format";
import type { Summary, Widget } from "@/lib/types";
import { EndpointTable } from "./endpoint-table";

const tooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--color-popover-foreground)",
};

function colorFor(field: string, label: string, index: number): string {
  if (field === "health_status") return HEALTH_COLORS[label] ?? CHART_PALETTE[index % 5];
  if (field === "compliance_status") return COMPLIANCE_COLORS[label] ?? CHART_PALETTE[index % 5];
  return CHART_PALETTE[index % CHART_PALETTE.length];
}

function Empty({ text = "No data" }: { text?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

export function WidgetBody({
  widget,
  scope,
  summary,
  trends,
}: {
  widget: Widget;
  scope?: string;
  summary?: Summary | null;
  trends?: Record<string, number | string>[];
}) {
  const type = widget.type;

  if (type === "stat") {
    return <StatWidget widget={widget} scope={scope} summary={summary} />;
  }

  if (type === "gauge") {
    return <GaugeWidget widget={widget} scope={scope} summary={summary} />;
  }

  if (type === "line" || type === "area") {
    const series = (widget.config.series as string[]) ?? ["compliance_pct"];
    if (!trends || trends.length === 0) return <Empty />;
    const formatted = trends.map((t) => ({
      ...t,
      label: new Date(String(t.captured_at)).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    }));
    const Chart = type === "area" ? AreaChart : LineChart;
    return (
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((key, i) =>
            type === "area" ? (
              <Area key={key} type="monotone" dataKey={key} name={titleCase(key)} stroke={CHART_PALETTE[i % 5]} fill={CHART_PALETTE[i % 5]} fillOpacity={0.2} />
            ) : (
              <Line key={key} type="monotone" dataKey={key} name={titleCase(key)} stroke={CHART_PALETTE[i % 5]} strokeWidth={2} dot={false} />
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
  return <AggregateChart widget={widget} scope={scope} />;
}

function ruleOf(widget: Widget): { match?: string; conditions?: unknown[] } | null {
  const rule = widget.config.rule as { match?: string; conditions?: unknown[] } | undefined;
  return rule && Array.isArray(rule.conditions) && rule.conditions.length > 0 ? rule : null;
}

function StatWidget({ widget, scope, summary }: { widget: Widget; scope?: string; summary?: Summary | null }) {
  const rule = ruleOf(widget);
  const { data: ruleData } = useScopeRule(scope, rule, !!rule);

  let value: number = 0;
  let suffix = "";
  let footnote: string | null = null;

  if (rule) {
    const display = String(widget.config.display ?? "count");
    if (display === "percent") {
      value = ruleData?.pct ?? 0;
      suffix = "%";
    } else {
      value = ruleData?.count ?? 0;
      footnote = ruleData ? `of ${ruleData.total} endpoints` : null;
    }
  } else {
    const metric = String(widget.config.metric ?? "total");
    value = summary ? (summary as unknown as Record<string, number>)[metric] ?? 0 : 0;
    suffix = metric === "compliance_pct" ? "%" : "";
  }

  return (
    <div className="flex h-full flex-col justify-center">
      <div className="text-4xl font-semibold tracking-tight">
        {value}
        <span className="text-xl text-muted-foreground">{suffix}</span>
      </div>
      {footnote && <p className="mt-1 text-xs text-muted-foreground">{footnote}</p>}
    </div>
  );
}

function GaugeWidget({ widget, scope, summary }: { widget: Widget; scope?: string; summary?: Summary | null }) {
  const rule = ruleOf(widget);
  const { data: ruleData } = useScopeRule(scope, rule, !!rule);

  const value = rule
    ? ruleData?.pct ?? 0
    : summary
      ? (summary as unknown as Record<string, number>)[String(widget.config.metric ?? "compliance_pct")] ?? 0
      : 0;

  const data = [{ name: "value", value, fill: "var(--color-primary)" }];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar background dataKey="value" cornerRadius={8} />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 24, fontWeight: 600 }}>
          {value}%
        </text>
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function AggregateChart({ widget, scope }: { widget: Widget; scope?: string }) {
  const field = String(widget.config.field ?? "os_platform");
  const { data: buckets, isLoading } = useScopeAggregate(scope, field);

  if (isLoading) return <Empty text="Loading…" />;
  if (!buckets || buckets.length === 0) return <Empty />;

  if (widget.type === "bar") {
    const horizontal = !!widget.config.horizontal;
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
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {buckets.map((b, i) => (
              <Cell key={b.label} fill={colorFor(field, b.label, i)} />
            ))}
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
        >
          {buckets.map((b, i) => (
            <Cell key={b.label} fill={colorFor(field, b.label, i)} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
