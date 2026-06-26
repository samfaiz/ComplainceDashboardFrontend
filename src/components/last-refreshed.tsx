"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { relativeTime, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Compact "Updated 2h ago" indicator so users can tell how fresh the data on
 * screen is. Pass the timestamp of the latest data capture (snapshot). The
 * relative label re-renders on a timer so it keeps counting up between
 * refetches, and the exact time is available on hover.
 */
export function LastRefreshed({
  at,
  className,
}: {
  at: string | null | undefined;
  className?: string;
}) {
  // Tick every 30s so "2m ago" rolls over to "3m ago" without a refetch.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!at) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [at]);

  if (!at) return null;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground", className)}
      title={`Data captured ${formatDate(at)}`}
    >
      <Clock className="h-3.5 w-3.5" />
      Updated {relativeTime(at)}
    </span>
  );
}
