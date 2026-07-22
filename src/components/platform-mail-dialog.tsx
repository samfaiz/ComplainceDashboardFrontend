"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SendHorizontal } from "lucide-react";
import { api, ApiError, ensureCsrf } from "@/lib/api";
import { useToast } from "@/lib/toast";
import type { PlatformMailSettings } from "@/lib/types";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

/**
 * Platform-owner email integration: where new-account-request notifications are
 * sent, plus an optional SMTP connection so they go out for real (off = logged).
 */
export function PlatformMailDialog({
  settings,
  onClose,
}: {
  settings: PlatformMailSettings;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notifyEmail, setNotifyEmail] = useState(settings.notify_email ?? "");
  const [enabled, setEnabled] = useState(settings.enabled);
  const [host, setHost] = useState(settings.host ?? "");
  const [port, setPort] = useState(settings.port?.toString() ?? "587");
  const [encryption, setEncryption] = useState(settings.encryption ?? "tls");
  const [username, setUsername] = useState(settings.username ?? "");
  const [password, setPassword] = useState("");
  const [fromAddress, setFromAddress] = useState(settings.from_address ?? "");
  const [fromName, setFromName] = useState(settings.from_name ?? "");
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function body() {
    return {
      transport: enabled ? "smtp" : "log",
      host: host || null,
      port: port ? Number(port) : null,
      encryption,
      username: username || null,
      password: password || null, // empty = keep the stored password
      from_address: fromAddress || null,
      from_name: fromName || null,
      notify_email: notifyEmail || null,
      enabled,
    };
  }

  async function persist() {
    await ensureCsrf();
    await api.put("/api/platform/mail-settings", body());
    await qc.invalidateQueries({ queryKey: ["platform", "mail-settings"] });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await persist();
      toast({ title: "Email settings saved", variant: "success" });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError || err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  }

  // Save the current form, then send a test to the notify address so "test" always
  // reflects what's on screen.
  async function sendTest() {
    if (!notifyEmail) {
      setError("Enter a notification address first.");
      return;
    }
    setTestBusy(true);
    setError(null);
    try {
      await persist();
      const res = await api.post<{ message: string }>("/api/platform/mail-settings/test", { to: notifyEmail });
      toast({ title: res.message, variant: "success" });
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError || err.message : "Test failed");
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader
        title="Email integration"
        description="Choose where account-request notifications go, and connect SMTP to send them for real."
      />
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={save} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Send notifications to</Label>
          <Input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            New account requests are emailed here (and always listed under Account requests).
          </p>
        </div>

        <label className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span>
            Send real emails via SMTP
            <span className="block text-xs text-muted-foreground">
              Off = notifications are written to the log only (no delivery).
            </span>
          </span>
        </label>

        {enabled && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>SMTP host</Label>
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Encryption</Label>
                <Select value={encryption ?? "tls"} onChange={(e) => setEncryption(e.target.value as "tls" | "ssl")}>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="none">None</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@gmail.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Password {settings.has_password && <span className="font-normal text-muted-foreground">(leave blank to keep)</span>}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={settings.has_password ? "••••••••" : "App password"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From address</Label>
                <Input type="email" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="no-reply@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>From name</Label>
                <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="EDR Compliance" />
              </div>
            </div>
          </div>
        )}

        {settings.last_test_status && (
          <p className="text-xs text-muted-foreground">
            Last test:{" "}
            <span className={settings.last_test_status === "ok" ? "text-success" : "text-destructive"}>
              {settings.last_test_status === "ok" ? "succeeded" : "failed"}
            </span>
            {settings.last_test_error ? ` — ${settings.last_test_error}` : ""}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="outline" onClick={sendTest} loading={testBusy}>
            <SendHorizontal className="h-4 w-4" /> Send test
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
