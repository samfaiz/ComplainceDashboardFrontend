"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

interface Props {
  /** Required capability. "manage" = admin or analyst; "admin" = admin only. */
  require: "manage" | "admin";
  /** Path to bounce viewers to when unauthorized. Defaults to /. */
  fallback?: string;
  children: ReactNode;
}

export function RoleGuard({ require, fallback = "/", children }: Props) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const allowed = require === "admin" ? !!user?.is_admin : !!user?.can_manage;

  useEffect(() => {
    if (!isLoading && user && !allowed) {
      const t = setTimeout(() => router.replace(fallback), 1200);
      return () => clearTimeout(t);
    }
  }, [isLoading, user, allowed, fallback, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">You don&apos;t have permission to view this page</p>
          <p className="mt-1 text-xs text-muted-foreground">Redirecting…</p>
        </div>
        <Link href={fallback}>
          <Button variant="outline" size="sm">Go to dashboard</Button>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
