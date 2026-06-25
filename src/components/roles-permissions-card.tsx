"use client";

import { Check, Eye, ShieldCheck, Wrench, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Permission {
  category: string;
  label: string;
  description?: string;
  matrix: Record<Role, boolean>;
}

const PERMISSIONS: Permission[] = [
  // ----- viewing -----
  {
    category: "Dashboards & Data",
    label: "View dashboards assigned by an admin",
    matrix: { admin: true, analyst: true, viewer: true },
  },
  {
    category: "Dashboards & Data",
    label: "Build / edit / save own dashboards",
    matrix: { admin: true, analyst: true, viewer: false },
  },
  {
    category: "Dashboards & Data",
    label: "Assign a dashboard to other users",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "Dashboards & Data",
    label: "Browse endpoint data tables",
    matrix: { admin: true, analyst: true, viewer: false },
  },

  // ----- sources -----
  {
    category: "API Sources",
    label: "Add / edit / delete connectors",
    matrix: { admin: true, analyst: true, viewer: false },
  },
  {
    category: "API Sources",
    label: "Trigger an on-demand refresh",
    matrix: { admin: true, analyst: true, viewer: false },
  },
  {
    category: "API Sources",
    label: "View source list and status",
    matrix: { admin: true, analyst: true, viewer: false },
  },

  // ----- user / admin -----
  {
    category: "Users & Admin",
    label: "Create users, set roles, reset passwords",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "Users & Admin",
    label: "Delete users",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "Users & Admin",
    label: "Require / reset another user's MFA",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "Users & Admin",
    label: "View login activity & audit log",
    matrix: { admin: true, analyst: false, viewer: false },
  },

  // ----- account -----
  {
    category: "Account",
    label: "Change own password",
    matrix: { admin: true, analyst: true, viewer: true },
  },
  {
    category: "Account",
    label: "Self-enroll an authenticator (MFA)",
    description: "Non-admins can only enroll when an admin has flagged them.",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "Account",
    label: "Disable own MFA",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "Account",
    label: "Receive email notifications (opt-in)",
    matrix: { admin: true, analyst: true, viewer: true },
  },

  // ----- system -----
  {
    category: "System",
    label: "Configure SMTP / mail settings",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "System",
    label: "Edit notification templates",
    matrix: { admin: true, analyst: false, viewer: false },
  },
  {
    category: "System",
    label: "View tech stack & CVE scan",
    matrix: { admin: true, analyst: false, viewer: false },
  },
];

const ROLE_META: Record<Role, { label: string; description: string; icon: typeof ShieldCheck }> = {
  admin: {
    label: "Admin",
    description: "Full control: users, sources, dashboards, mail, templates, audit.",
    icon: ShieldCheck,
  },
  analyst: {
    label: "Analyst",
    description: "Operate sources and build dashboards. No user or system administration.",
    icon: Wrench,
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to dashboards an admin has assigned them.",
    icon: Eye,
  },
};

export function RolesPermissionsCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const myRole = user?.role;

  const grouped = PERMISSIONS.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles &amp; Permissions</CardTitle>
        <CardDescription>
          What each role can do in this dashboard. Your current role is highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(ROLE_META) as Role[]).map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            const mine = role === myRole;
            return (
              <div
                key={role}
                className={cn(
                  "rounded-lg border p-3",
                  mine ? "border-primary bg-primary/5" : "bg-card"
                )}
              >
                <div className="mb-1 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{meta.label}</span>
                  {mine && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">
                      You
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{meta.description}</p>
              </div>
            );
          })}
        </div>

        {!compact && (
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{category}</p>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Permission</th>
                        {(Object.keys(ROLE_META) as Role[]).map((r) => (
                          <th
                            key={r}
                            className={cn(
                              "px-3 py-2 text-center font-medium capitalize",
                              r === myRole && "text-primary"
                            )}
                          >
                            {r}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.label} className="border-t">
                          <td className="px-3 py-2 align-top">
                            {p.label}
                            {p.description && (
                              <p className="text-[10px] text-muted-foreground">{p.description}</p>
                            )}
                          </td>
                          {(Object.keys(ROLE_META) as Role[]).map((r) => (
                            <td
                              key={r}
                              className={cn(
                                "px-3 py-2 text-center",
                                r === myRole && "bg-primary/5"
                              )}
                            >
                              {p.matrix[r] ? (
                                <Check className="mx-auto h-4 w-4 text-success" />
                              ) : (
                                <X className="mx-auto h-4 w-4 text-muted-foreground" />
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
