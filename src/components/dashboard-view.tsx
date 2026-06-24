"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Summary, Widget } from "@/lib/types";
import { WidgetBody } from "./widget";

export function WidgetCard({
  widget,
  scope,
  summary,
  trends,
  actions,
  className,
}: {
  widget: Widget;
  scope?: string;
  summary?: Summary | null;
  trends?: Record<string, number | string>[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h3 className="truncate text-sm font-medium text-muted-foreground">{widget.title}</h3>
        {actions}
      </div>
      <div className="min-h-0 flex-1 px-4 pb-3">
        <WidgetBody widget={widget} scope={scope} summary={summary} trends={trends} />
      </div>
    </Card>
  );
}

export function DashboardView({
  layout,
  scope,
  summary,
  trends,
}: {
  layout: Widget[];
  scope?: string;
  summary?: Summary | null;
  trends?: Record<string, number | string>[];
}) {
  const widgets = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <div className="grid auto-rows-[70px] grid-cols-2 gap-4 md:grid-cols-12">
      {widgets.map((w) => (
        <div
          key={w.id}
          style={{ gridColumn: `span ${Math.min(w.w, 12)}`, gridRow: `span ${w.h}` }}
        >
          <WidgetCard widget={w} scope={scope} summary={summary} trends={trends} />
        </div>
      ))}
    </div>
  );
}
