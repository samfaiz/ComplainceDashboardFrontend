"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, ShieldCheck, AlertTriangle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useMailSettings } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function MailSettingsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useMailSettings();

  const [transport, setTransport] = useState<"smtp" | "log">("log");
  const [host, setHost] = useState("");
  const [port, setPort] = useState<string>("587");
  const [encryption, setEncryption] = useState<"tls" | "ssl" | "none">("tls");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!data) return;
    setTransport(data.transport);
    setHost(data.host ?? "");
    setPort(data.port ? String(data.port) : "587");
    setEncryption((data.encryption ?? "none") as "tls" | "ssl" | "none");
    setUsername(data.username ?? "");
    setFromAddress(data.from_address ?? "");
    setFromName(data.from_name ?? "");
    setReplyTo(data.reply_to ?? "");
    setEnabled(data.enabled);
    setTestTo((prev) => prev || user?.email || "");
  }, [data, user?.email]);

  async function save() {
    setBusy(true);
    try {
      await api.put("/api/admin/mail-settings", {
        transport,
        host: host || null,
        port: port ? Number(port) : null,
        encryption,
        username: username || null,
        password: password || null, // empty = leave existing
        from_address: fromAddress || null,
        from_name: fromName || null,
        reply_to: replyTo || null,
        enabled,
      });
      setPassword("");
      qc.invalidateQueries({ queryKey: ["admin", "mail-settings"] });
      toast({ title: "Mail settings saved", variant: "success" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.firstError || e.message : "Error",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testTo) return;
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; message: string }>("/api/admin/mail-settings/test", {
        to: testTo,
      });
      qc.invalidateQueries({ queryKey: ["admin", "mail-settings"] });
      toast({
        title: res.ok ? "Test email queued" : "Test failed",
        description: res.message,
        variant: res.ok ? "success" : "error",
      });
    } catch (e) {
      toast({
        title: "Test failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Outbound mail</h3>
            {enabled && transport === "smtp" && data?.last_test_status === "ok" && (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
            {data?.last_test_status === "failed" && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Last test failed
              </Badge>
            )}
          </div>
          {data?.last_test_at && (
            <span className="text-xs text-muted-foreground">Last tested {formatDate(data.last_test_at)}</span>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Transport</Label>
            <Select value={transport} onChange={(e) => setTransport(e.target.value as "smtp" | "log")}>
              <option value="smtp">SMTP (real delivery)</option>
              <option value="log">Log only (writes to storage/logs)</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              Log mode never sends real email — useful for development or dry-run.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Enable notifications</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              All email notifications are turned on
            </label>
            <p className="text-xs text-muted-foreground">
              Turn off the master switch to pause all outbound notifications without losing template settings.
            </p>
          </div>
        </div>

        {transport === "smtp" && (
          <div className="space-y-4 rounded-lg border p-4">
            <h4 className="text-sm font-medium">SMTP server</h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.sendgrid.net" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
                </div>
                <div className="space-y-2">
                  <Label>Encryption</Label>
                  <Select value={encryption} onChange={(e) => setEncryption(e.target.value as typeof encryption)}>
                    <option value="tls">STARTTLS (587)</option>
                    <option value="ssl">SSL (465)</option>
                    <option value="none">None (25)</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="apikey" />
              </div>
              <div className="space-y-2">
                <Label>Password / API key</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={data?.has_password ? "•••••••• (leave blank to keep)" : "your SMTP password"}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 rounded-lg border p-4">
          <h4 className="text-sm font-medium">Sender identity</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>From address</Label>
              <Input
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="alerts@your-domain.com"
              />
            </div>
            <div className="space-y-2">
              <Label>From name</Label>
              <Input
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="EDR Compliance Alerts"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Reply-to (optional)</Label>
              <Input
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="security@your-domain.com"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={busy}>
            Save settings
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border p-4">
          <h4 className="text-sm font-medium">Send a test email</h4>
          <p className="text-xs text-muted-foreground">
            Saves current settings first if you&apos;ve edited them. With the log transport, the &quot;test&quot;
            is written to <code>storage/logs/laravel.log</code> instead of sent.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="recipient@example.com"
              className="max-w-xs"
            />
            <Button variant="outline" onClick={sendTest} disabled={!testTo || busy}>
              <Send className="h-4 w-4" /> Send test
            </Button>
          </div>
          {data?.last_test_error && data.last_test_status === "failed" && (
            <p className="text-xs text-destructive">{data.last_test_error}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
