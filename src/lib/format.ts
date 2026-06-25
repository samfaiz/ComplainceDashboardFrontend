export function relativeTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
}

export const HEALTH_COLORS: Record<string, string> = {
  online: "var(--color-success)",
  stale: "var(--color-warning)",
  offline: "var(--color-destructive)",
  error: "var(--color-destructive)",
  unknown: "var(--color-muted-foreground)",
};

export const COMPLIANCE_COLORS: Record<string, string> = {
  compliant: "var(--color-success)",
  non_compliant: "var(--color-destructive)",
  unknown: "var(--color-muted-foreground)",
};

export const CHART_PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export const PALETTES: Record<string, string[]> = {
  default: CHART_PALETTE,
  ocean: ["#0ea5e9", "#22d3ee", "#2dd4bf", "#0891b2", "#1d4ed8", "#7dd3fc"],
  sunset: ["#f97316", "#f43f5e", "#a855f7", "#facc15", "#ef4444", "#fb923c"],
  forest: ["#16a34a", "#65a30d", "#0d9488", "#84cc16", "#15803d", "#4ade80"],
  mono: ["#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#cbd5e1"],
};

export function paletteFor(name: string | undefined): string[] {
  return PALETTES[name ?? "default"] ?? CHART_PALETTE;
}

export function healthBadgeVariant(status: string): "success" | "warning" | "destructive" | "secondary" {
  if (status === "online") return "success";
  if (status === "stale") return "warning";
  if (status === "offline" || status === "error") return "destructive";
  return "secondary";
}

export function complianceBadgeVariant(status: string): "success" | "destructive" | "secondary" {
  if (status === "compliant") return "success";
  if (status === "non_compliant") return "destructive";
  return "secondary";
}
