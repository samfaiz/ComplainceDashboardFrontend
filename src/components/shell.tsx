"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Table2,
  Plug,
  SlidersHorizontal,
  Users,
  Activity,
  Settings,
  LogOut,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/data", label: "Endpoint Data", icon: Table2, manage: true },
  { href: "/sources", label: "API Sources", icon: Plug, manage: true },
  { href: "/builder", label: "Customize", icon: SlidersHorizontal, manage: true },
  { href: "/admin", label: "Admin", icon: Users, admin: true },
  { href: "/health", label: "System Health", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useAuth();

  async function logout() {
    try {
      await api.post("/api/logout");
    } catch {
      /* ignore */
    }
    await refresh();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/40 md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-5">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">EDR Compliance</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav
            .filter((i) => (!i.admin || user?.is_admin) && (!i.manage || user?.can_manage))
            .map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            <Badge variant="secondary" className="mt-1 capitalize">
              {user?.role}
            </Badge>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b px-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground md:hidden">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">EDR Compliance</span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {user?.current_ip && <span className="hidden sm:inline">IP {user.current_ip}</span>}
            {user?.mfa_enabled ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> MFA on
              </Badge>
            ) : (
              <Link href="/settings">
                <Badge variant="warning" className="gap-1">
                  <ShieldAlert className="h-3 w-3" /> MFA off
                </Badge>
              </Link>
            )}
          </div>
        </header>

        {user?.ip_flagged && (
          <div className="flex items-center gap-2 border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            New sign-in location detected — your session is flagged. If this wasn&apos;t you, change your
            password immediately.
          </div>
        )}
        {user?.must_change_password && (
          <div className="flex items-center gap-2 border-b border-warning/40 bg-warning/10 px-5 py-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4" />
            You must change your password.{" "}
            <Link href="/settings" className="underline">
              Update it now
            </Link>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
