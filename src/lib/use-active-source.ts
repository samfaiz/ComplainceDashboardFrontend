"use client";

import { useEffect, useState } from "react";
import { useSources } from "./queries";

export function useActiveSource() {
  const { data: sources, isLoading } = useSources();
  const [sourceId, setSourceId] = useState<number | undefined>();

  useEffect(() => {
    if (!sources || sources.length === 0) {
      setSourceId(undefined);
      return;
    }
    const saved = Number(typeof window !== "undefined" ? localStorage.getItem("activeSource") : 0);
    const exists = sources.find((s) => s.id === saved);
    setSourceId(exists ? saved : sources[0].id);
  }, [sources]);

  function select(id: number) {
    setSourceId(id);
    if (typeof window !== "undefined") localStorage.setItem("activeSource", String(id));
  }

  const active = sources?.find((s) => s.id === sourceId);

  return { sources: sources ?? [], isLoading, sourceId, active, select };
}
