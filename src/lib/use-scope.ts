"use client";

import { useEffect, useMemo, useState } from "react";
import { useSites, useSources } from "./queries";

/** Scope string: "all" | "site:{id}" | "source:{id}". */
export function useScope() {
  const { data: sources, isLoading: sLoading } = useSources();
  const { data: sites, isLoading: siLoading } = useSites();
  const [scope, setScopeState] = useState<string>("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("scope");
    if (saved) setScopeState(saved);
  }, []);

  function setScope(v: string) {
    setScopeState(v);
    if (typeof window !== "undefined") localStorage.setItem("scope", v);
  }

  const allSources = sources ?? [];
  const allSites = sites ?? [];

  // If the saved scope points at something that no longer exists, fall back.
  useEffect(() => {
    if (sLoading || siLoading || scope === "all") return;
    const ok = scope.startsWith("site:")
      ? allSites.some((s) => s.id === Number(scope.slice(5)))
      : scope.startsWith("source:")
        ? allSources.some((s) => s.id === Number(scope.slice(7)))
        : true;
    if (!ok) setScope("all");
  }, [sLoading, siLoading, scope, allSites, allSources]);

  const sourcesInScope = useMemo(() => {
    if (scope.startsWith("site:")) {
      const id = Number(scope.slice(5));
      return allSources.filter((s) => s.site_id === id);
    }
    if (scope.startsWith("source:")) {
      const id = Number(scope.slice(7));
      return allSources.filter((s) => s.id === id);
    }
    return allSources;
  }, [scope, allSources]);

  const label = useMemo(() => {
    if (scope.startsWith("site:")) return allSites.find((s) => s.id === Number(scope.slice(5)))?.name ?? "Site";
    if (scope.startsWith("source:")) return allSources.find((s) => s.id === Number(scope.slice(7)))?.name ?? "Source";
    return "All sites";
  }, [scope, allSites, allSources]);

  return {
    scope,
    setScope,
    label,
    sources: allSources,
    sites: allSites,
    sourcesInScope,
    isLoading: sLoading || siLoading,
    hasAny: allSources.length > 0,
  };
}
