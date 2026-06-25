"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Summary, Widget } from "@/lib/types";
import { WidgetBody } from "./widget";
import { EndpointDrillDialog, type DrillCriteria } from "./endpoint-drill-dialog";

export function WidgetCard({
  widget,
  scope,
  summary,
  trends,
  dashboardId,
  actions,
  className,
  drillEnabled = true,
}: {
  widget: Widget;
  scope?: string;
  summary?: Summary | null;
  trends?: Record<string, number | string>[];
  dashboardId?: number | null;
  actions?: React.ReactNode;
  className?: string;
  /** Set to false when rendered inside the builder so chart clicks don't open drill dialogs. */
  drillEnabled?: boolean;
}) {
  const [drill, setDrill] = useState<DrillCriteria | null>(null);

  return (
    <>
      <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h3 className="truncate text-sm font-medium text-muted-foreground">{widget.title}</h3>
          {actions}
        </div>
        <div className="min-h-0 flex-1 px-4 pb-3">
          <WidgetBody
            widget={widget}
            scope={scope}
            summary={summary}
            trends={trends}
            dashboardId={dashboardId}
            onDrill={drillEnabled ? setDrill : undefined}
          />
        </div>
      </Card>
      {drill && (
        <EndpointDrillDialog
          criteria={drill}
          scope={scope}
          dashboardId={dashboardId}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}

export function DashboardView({
  layout,
  scope,
  summary,
  trends,
  dashboardId,
}: {
  layout: Widget[];
  scope?: string;
  summary?: Summary | null;
  trends?: Record<string, number | string>[];
  dashboardId?: number | null;
}) {
  const widgets = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <div className="grid auto-rows-[70px] grid-cols-2 gap-4 md:grid-cols-12">
      {widgets.map((w) => (
        <div
          key={w.id}
          style={{ gridColumn: `span ${Math.min(w.w, 12)}`, gridRow: `span ${w.h}` }}
        >
          <WidgetCard widget={w} scope={scope} summary={summary} trends={trends} dashboardId={dashboardId} />
        </div>
      ))}
    </div>
  );
}
