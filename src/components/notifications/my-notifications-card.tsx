"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Save } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useMyNotificationSubscriptions } from "@/lib/queries";
import type { NotificationSubscription } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  warning: "warning",
  info: "secondary",
};

export function MyNotificationsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useMyNotificationSubscriptions();
  const [local, setLocal] = useState<NotificationSubscription[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) setLocal(data);
  }, [data]);

  function toggle(eventKey: string, enabled: boolean) {
    setLocal((prev) => prev.map((p) => (p.event_key === eventKey ? { ...p, enabled, is_explicit: true } : p)));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      await api.put("/api/notification-subscriptions", {
        subscriptions: local.map((s) => ({ event_key: s.event_key, enabled: s.enabled })),
      });
      qc.invalidateQueries({ queryKey: ["me", "notification-subscriptions"] });
      toast({ title: "Notification preferences saved", variant: "success" });
      setDirty(false);
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  const grouped = local.reduce<Record<string, NotificationSubscription[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Email notifications
        </CardTitle>
        <CardDescription>
          Choose which alerts you want emailed to you. The administrator sets default rules per role; your choices
          here override them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="space-y-1.5">
                <p className="text-xs font-medium uppercase text-muted-foreground">{category}</p>
                <div className="space-y-1">
                  {items.map((s) => (
                    <label
                      key={s.event_key}
                      className="flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 hover:border-primary/40"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{s.display_name}</span>
                          <Badge variant={SEVERITY_VARIANT[s.default_severity] ?? "secondary"} className="capitalize">
                            {s.default_severity}
                          </Badge>
                          {!s.is_explicit && (
                            <span className="text-[10px] text-muted-foreground">
                              (default: {s.default_on ? "on" : "off"})
                            </span>
                          )}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => toggle(s.event_key, e.target.checked)}
                        className="h-4 w-4 accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button onClick={save} loading={busy} disabled={!dirty}>
                <Save className="h-4 w-4" /> Save preferences
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
