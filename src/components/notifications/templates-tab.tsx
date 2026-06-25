"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, Pencil, RotateCcw, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { useNotificationTemplates } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { titleCase } from "@/lib/format";
import type { NotificationTemplate } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader } from "@/components/ui/dialog";

const SEVERITY_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  warning: "warning",
  info: "secondary",
};

export function TemplatesTab() {
  const { data, isLoading } = useNotificationTemplates();
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const grouped = (data ?? []).reduce<Record<string, NotificationTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <>
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardContent className="pt-5">
              <h3 className="mb-3 flex items-center gap-2 font-medium capitalize">
                <Mail className="h-4 w-4 text-primary" />
                {category}
              </h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{t.display_name}</p>
                        <Badge variant={SEVERITY_VARIANT[t.default_severity] ?? "secondary"} className="capitalize">
                          {t.default_severity}
                        </Badge>
                        {!t.enabled && <Badge variant="outline">Disabled</Badge>}
                        <code className="text-[10px] text-muted-foreground">{t.event_key}</code>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.subject}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing && <EditTemplateDialog template={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditTemplateDialog({ template, onClose }: { template: NotificationTemplate; onClose: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [bodyText, setBodyText] = useState(template.body_text ?? "");
  const [enabled, setEnabled] = useState(template.enabled);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string | null } | null>(null);
  const [testTo, setTestTo] = useState(user?.email ?? "");
  const [tab, setTab] = useState<"html" | "text">("html");

  const variables = Object.entries(template.variables ?? {});

  async function save() {
    setBusy(true);
    try {
      await api.put(`/api/admin/notification-templates/${template.id}`, {
        subject,
        body_html: bodyHtml,
        body_text: bodyText || null,
        enabled,
      });
      qc.invalidateQueries({ queryKey: ["admin", "notification-templates"] });
      toast({ title: "Template saved", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function runPreview() {
    setBusy(true);
    try {
      // Save in-memory edits first by sending them as payload
      await api.put(`/api/admin/notification-templates/${template.id}`, {
        subject,
        body_html: bodyHtml,
        body_text: bodyText || null,
        enabled,
      });
      const res = await api.post<{ subject: string; html: string; text: string | null }>(
        `/api/admin/notification-templates/${template.id}/preview`,
        {}
      );
      setPreview(res);
      qc.invalidateQueries({ queryKey: ["admin", "notification-templates"] });
    } catch (e) {
      toast({ title: "Preview failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!testTo) return;
    setBusy(true);
    try {
      await api.put(`/api/admin/notification-templates/${template.id}`, {
        subject, body_html: bodyHtml, body_text: bodyText || null, enabled,
      });
      const res = await api.post<{ ok: boolean }>(`/api/admin/notification-templates/${template.id}/test`, {
        to: testTo,
      });
      toast({
        title: res.ok ? "Test email sent" : "Test failed",
        variant: res.ok ? "success" : "error",
      });
    } catch (e) {
      toast({ title: "Test failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("Reset this template to its default subject and body?")) return;
    setBusy(true);
    try {
      const res = await api.post<{ template: NotificationTemplate }>(
        `/api/admin/notification-templates/${template.id}/reset`,
        {}
      );
      setSubject(res.template.subject);
      setBodyHtml(res.template.body_html);
      setBodyText(res.template.body_text ?? "");
      setEnabled(res.template.enabled);
      qc.invalidateQueries({ queryKey: ["admin", "notification-templates"] });
      toast({ title: "Template reset to default", variant: "success" });
    } catch (e) {
      toast({ title: "Reset failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  function insertVar(varName: string) {
    const marker = ` {{ ${varName} }}`;
    if (tab === "html") setBodyHtml((v) => v + marker);
    else setBodyText((v) => v + marker);
  }

  return (
    <Dialog open onClose={onClose} className="max-w-4xl">
      <DialogHeader title={template.display_name} description={template.event_key} />

      <div className="grid max-h-[75vh] gap-4 overflow-y-auto md:grid-cols-3">
        {/* Left: editor */}
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Template enabled (uncheck to suppress this notification globally)
            </label>
          </div>

          <div className="space-y-2">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTab("html")}
                  className={`rounded border px-2 py-0.5 text-xs ${tab === "html" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  HTML
                </button>
                <button
                  type="button"
                  onClick={() => setTab("text")}
                  className={`rounded border px-2 py-0.5 text-xs ${tab === "text" ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  Plain text (fallback)
                </button>
              </div>
            </div>
            {tab === "html" ? (
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={14}
                className="w-full rounded-lg border bg-background p-3 font-mono text-xs"
              />
            ) : (
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={14}
                placeholder="Optional plain-text alternative for clients that don't render HTML."
                className="w-full rounded-lg border bg-background p-3 font-mono text-xs"
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={busy}>Save</Button>
            <Button variant="outline" onClick={runPreview} loading={busy}>
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button variant="ghost" onClick={reset} loading={busy}>
              <RotateCcw className="h-4 w-4" /> Reset to default
            </Button>
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <h4 className="text-xs font-medium uppercase text-muted-foreground">Send a test</h4>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="recipient@example.com"
                className="h-8 max-w-xs"
              />
              <Button variant="outline" size="sm" disabled={!testTo || busy} onClick={sendTest}>
                <Send className="h-4 w-4" /> Send test
              </Button>
            </div>
          </div>
        </div>

        {/* Right: variables + preview */}
        <div className="space-y-4">
          <div className="rounded-lg border p-3">
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Available variables</h4>
            <div className="space-y-1">
              {variables.map(([k, desc]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => insertVar(k)}
                  className="block w-full rounded border border-transparent px-2 py-1 text-left text-xs hover:border-border hover:bg-muted"
                >
                  <code className="font-mono text-primary">{`{{ ${k} }}`}</code>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{desc}</p>
                </button>
              ))}
              <p className="mt-2 text-[10px] text-muted-foreground">
                Plus shared: <code>{`{{ app.name }}`}</code>, <code>{`{{ event_key }}`}</code>,{" "}
                <code>{`{{ recipient.name }}`}</code>, <code>{`{{ recipient.email }}`}</code>.
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Default audience</h4>
            <div className="flex flex-wrap gap-1">
              {template.default_audience.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">{titleCase(r)}</Badge>
              ))}
              {template.default_audience.length === 0 && (
                <span className="text-xs text-muted-foreground">Recipient is the affected user only.</span>
              )}
            </div>
          </div>

          {preview && (
            <div className="rounded-lg border p-3">
              <h4 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Preview</h4>
              <p className="mb-2 text-xs">
                <span className="text-muted-foreground">Subject: </span>
                <span className="font-medium">{preview.subject}</span>
              </p>
              <div
                className="max-h-72 overflow-auto rounded border bg-white p-2"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
