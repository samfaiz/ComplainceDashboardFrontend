"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  ExternalLink,
  Lock,
  Save,
  ShieldCheck,
  TestTube,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePresets, useSites } from "@/lib/queries";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ApiSource, AuthType, Preset, SecretMode, Vendor } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const NORMALIZED_FIELDS = [
  { key: "external_id", label: "External ID" },
  { key: "hostname", label: "Hostname" },
  { key: "os_platform", label: "OS Platform" },
  { key: "os_version", label: "OS Version" },
  { key: "agent_version", label: "Agent / Sensor Version" },
  { key: "health_status", label: "Health / Status" },
  { key: "last_seen_at", label: "Last Seen" },
  { key: "ip_address", label: "IP Address" },
  { key: "mac_address", label: "MAC Address" },
];

const STANDARD_KEYS = new Set(NORMALIZED_FIELDS.map((f) => f.key));

/** Turn a custom field name into a safe key used as the `extra` slug + default column. */
function slugifyField(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

const STEPS = ["Source", "Connect", "Map fields", "Schedule & key"];

interface TestResult {
  ok: boolean;
  count?: number;
  available_fields?: string[];
  preview?: Record<string, unknown>[];
  message?: string;
}

/** Searchable dropdown of the API's available fields; also accepts a typed path (nested/dot). */
function FieldCombobox({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = options.filter((o) => o.toLowerCase().includes(q)).slice(0, 60);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="font-mono text-xs"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-card p-1 shadow-lg">
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Run “Test connection” first to load fields — or type a path manually.
            </p>
          ) : filtered.length > 0 ? (
            filtered.map((o) => (
              <button
                key={o}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o);
                  setOpen(false);
                }}
                className="block w-full truncate rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted"
              >
                {o}
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No match — “{value}” will be used as-is.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function SourceWizard({ existing }: { existing?: ApiSource }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: presetData } = usePresets();
  const { data: sites } = useSites();
  const presets = presetData?.presets ?? [];
  const intervals = presetData?.refresh_intervals ?? [60, 120, 180, 360, 720, 1440];

  const isEdit = !!existing;
  const [step, setStep] = useState(isEdit ? 1 : 0);

  const [vendor, setVendor] = useState<Vendor>(existing?.vendor ?? "generic");
  const [name, setName] = useState(existing?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
  const [authType, setAuthType] = useState<AuthType>(existing?.auth_type ?? "bearer");
  const [authConfig, setAuthConfig] = useState<Record<string, unknown>>(existing?.auth_config ?? {});
  const [requestConfig, setRequestConfig] = useState<Record<string, unknown>>(existing?.request_config ?? {});
  const [mappings, setMappings] = useState<Record<string, string>>(existing?.field_mappings ?? {});
  const [secret, setSecret] = useState("");
  const [interval, setInterval] = useState(existing?.refresh_interval_minutes ?? 60);
  const [secretMode, setSecretMode] = useState<SecretMode>(existing?.secret_mode ?? "saved");
  const [siteId, setSiteId] = useState<number | null>(existing?.site_id ?? null);
  const [newSite, setNewSite] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldPath, setNewFieldPath] = useState("");

  const customEntries = Object.entries(mappings).filter(([k]) => !STANDARD_KEYS.has(k));

  function addCustomField() {
    const key = slugifyField(newFieldName);
    if (!key || !newFieldPath.trim()) return;
    setMappings((m) => ({ ...m, [key]: newFieldPath.trim() }));
    setNewFieldName("");
    setNewFieldPath("");
  }
  function removeCustomField(key: string) {
    setMappings((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
  }

  const preset = useMemo<Preset | undefined>(() => presets.find((p) => p.vendor === vendor), [presets, vendor]);

  function applyPreset(p: Preset) {
    setVendor(p.vendor);
    setBaseUrl(p.base_url);
    setAuthType(p.auth_type);
    setAuthConfig({ ...p.auth_config });
    setRequestConfig({ ...p.request_config });
    setMappings({ ...p.field_mappings });
    if (!name) setName(p.label);
    setTestResult(null);
  }

  // Preset field values are read/written into base_url / secret / auth_config / request headers.
  function fieldValue(target: string): string {
    if (target === "base_url") return baseUrl;
    if (target === "secret") return secret;
    if (target.startsWith("auth.")) return String(authConfig[target.slice(5)] ?? "");
    if (target.startsWith("header.")) {
      const headers = (requestConfig.headers as Record<string, unknown>) ?? {};
      return String(headers[target.slice(7)] ?? "");
    }
    return "";
  }
  function setFieldValue(target: string, value: string) {
    if (target === "base_url") setBaseUrl(value);
    else if (target === "secret") setSecret(value);
    else if (target.startsWith("auth.")) setAuthConfig((c) => ({ ...c, [target.slice(5)]: value }));
    else if (target.startsWith("header."))
      setRequestConfig((c) => ({
        ...c,
        headers: { ...((c.headers as Record<string, unknown>) ?? {}), [target.slice(7)]: value },
      }));
  }

  async function createSite() {
    if (!newSite.trim()) return;
    setCreatingSite(true);
    try {
      const res = await api.post<{ site: { id: number; name: string } }>("/api/sites", { name: newSite.trim() });
      await qc.invalidateQueries({ queryKey: ["sites"] });
      setSiteId(res.site.id);
      setNewSite("");
      toast({ title: "Site created", variant: "success" });
    } catch (e) {
      toast({ title: "Could not create site", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setCreatingSite(false);
    }
  }

  function buildPayload(includeSecret: boolean) {
    return {
      name,
      site_id: siteId,
      vendor,
      base_url: baseUrl,
      auth_type: authType,
      auth_config: authConfig,
      request_config: requestConfig,
      field_mappings: mappings,
      refresh_interval_minutes: interval,
      secret_mode: secretMode,
      ...(includeSecret && secret ? { secret } : {}),
    };
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<TestResult>("/api/sources/test", buildPayload(true));
      setTestResult(res);
      if (res.ok) {
        toast({ title: "Connection OK", description: `${res.count} records found.`, variant: "success" });
      } else {
        toast({ title: "Connection failed", description: res.message, variant: "error" });
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.firstError || e.message : "Test failed";
      setTestResult({ ok: false, message: msg });
      toast({ title: "Test failed", description: msg, variant: "error" });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/api/sources/${existing!.id}`, buildPayload(true));
        toast({ title: "Source updated", variant: "success" });
      } else {
        const res = await api.post<{ initial_run?: { status: string; records_ingested?: number; error?: string | null } }>(
          "/api/sources",
          buildPayload(true)
        );
        const run = res.initial_run;
        if (run?.status === "success") {
          toast({ title: "Source connected", description: `Imported ${run.records_ingested ?? 0} endpoints.`, variant: "success" });
        } else if (run?.status === "failed") {
          toast({ title: "Connected, but first sync failed", description: run.error || "Check the API key, then Refresh.", variant: "warning" });
        } else {
          toast({ title: "Source connected", variant: "success" });
        }
      }
      qc.invalidateQueries({ queryKey: ["sources"] });
      router.push("/sources");
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.firstError || e.message : "Error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const canNext =
    (step === 0 && !!vendor) ||
    (step === 1 && !!name && !!baseUrl && (secretMode === "per_login" || !!secret || isEdit)) ||
    step === 2;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Stepper */}
      <ol className="flex items-center gap-2 text-sm">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary text-primary",
                i > step && "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={cn(i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-5 pt-6">
          {/* STEP 0 — choose vendor */}
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {presets.map((p) => (
                <button
                  key={p.vendor}
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors hover:border-primary",
                    vendor === p.vendor && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{p.label}</span>
                    {vendor === p.vendor && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          )}

          {/* STEP 1 — connect */}
          {step === 1 && (
            <div className="space-y-4">
              {preset && (preset.setup_guide?.length || preset.docs_url) && (
                <details className="rounded-lg border border-primary/30 bg-primary/5 p-3" open>
                  <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <BookOpen className="h-4 w-4 text-primary" />
                    How to get these credentials for {preset.label}
                  </summary>
                  {preset.setup_guide && preset.setup_guide.length > 0 && (
                    <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
                      {preset.setup_guide.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  )}
                  {preset.docs_url && (
                    <a
                      href={preset.docs_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      Official API documentation <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </details>
              )}

              <div className="space-y-2">
                <Label>Source name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Production CrowdStrike" />
              </div>

              {preset?.fields.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>
                    {f.label}
                    {f.required && <span className="text-destructive"> *</span>}
                  </Label>
                  <Input
                    type={f.type}
                    value={fieldValue(f.target)}
                    onChange={(e) => setFieldValue(f.target, e.target.value)}
                    placeholder={f.placeholder}
                    autoComplete="off"
                  />
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              ))}

              {isEdit && (
                <p className="text-xs text-muted-foreground">
                  Leave the secret field blank to keep the existing stored key.
                </p>
              )}

              {/* Advanced request config for the generic connector */}
              {vendor === "generic" && (
                <div className="space-y-4 rounded-lg border border-dashed p-4">
                  <p className="text-sm font-medium">Request configuration</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Auth type</Label>
                      <Select value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
                        <option value="bearer">Bearer token</option>
                        <option value="api_key_header">API key header</option>
                        <option value="basic">Basic auth</option>
                        <option value="oauth2_client_credentials">OAuth2 client credentials</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>HTTP method</Label>
                      <Select
                        value={String(requestConfig.method ?? "GET")}
                        onChange={(e) => setRequestConfig((c) => ({ ...c, method: e.target.value }))}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Path</Label>
                      <Input
                        value={String(requestConfig.path ?? "/")}
                        onChange={(e) => setRequestConfig((c) => ({ ...c, path: e.target.value }))}
                        placeholder="/api/devices"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data path (JSON)</Label>
                      <Input
                        value={String(requestConfig.data_path ?? "")}
                        onChange={(e) => setRequestConfig((c) => ({ ...c, data_path: e.target.value }))}
                        placeholder="data  or  result.devices"
                      />
                    </div>
                  </div>
                  {authType === "api_key_header" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Header name</Label>
                        <Input
                          value={String(authConfig.header ?? "X-API-Key")}
                          onChange={(e) => setAuthConfig((c) => ({ ...c, header: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Value prefix (optional)</Label>
                        <Input
                          value={String(authConfig.value_prefix ?? "")}
                          onChange={(e) => setAuthConfig((c) => ({ ...c, value_prefix: e.target.value }))}
                          placeholder="e.g. Token"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={runTest} loading={testing} disabled={!baseUrl || (!secret && !isEdit)}>
                  <TestTube className="h-4 w-4" /> Test connection
                </Button>
                {testResult && (
                  <span className={cn("flex items-center gap-1 text-sm", testResult.ok ? "text-success" : "text-destructive")}>
                    {testResult.ok ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                    {testResult.ok ? `${testResult.count} records` : testResult.message}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 2 — field mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Map the source&apos;s JSON fields (dot-notation) to the standard dashboard fields. Presets are
                pre-filled — adjust if your data differs.
              </p>
              {testResult?.available_fields && testResult.available_fields.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                  <span className="font-medium">Available fields: </span>
                  <span className="text-muted-foreground">{testResult.available_fields.join(", ")}</span>
                </div>
              )}
              <datalist id="available-fields">
                {testResult?.available_fields?.map((f) => <option key={f} value={f} />)}
              </datalist>
              <div className="grid gap-3 sm:grid-cols-2">
                {NORMALIZED_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      list="available-fields"
                      value={mappings[f.key] ?? ""}
                      onChange={(e) => setMappings((m) => ({ ...m, [f.key]: e.target.value }))}
                      placeholder="json.path"
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Custom fields — captured into `extra`, queryable in widgets/rules, shown in Endpoints. */}
              <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-xs">Custom fields</Label>
                <p className="text-[11px] text-muted-foreground">
                  Map any other value the API returns. These are saved per endpoint and can be used in custom widgets,
                  filters, and rules — and shown/renamed in the Endpoints table.
                </p>
                {customEntries.map(([key, path]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono shrink-0">{key}</Badge>
                    <FieldCombobox
                      className="flex-1"
                      value={path}
                      onChange={(v) => setMappings((m) => ({ ...m, [key]: v }))}
                      options={testResult?.available_fields ?? []}
                      placeholder="json.path"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomField(key)}>
                      Remove
                    </Button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Field name (e.g. Risk score)"
                    className="flex-1 text-xs"
                  />
                  <FieldCombobox
                    className="flex-1"
                    value={newFieldPath}
                    onChange={setNewFieldPath}
                    options={testResult?.available_fields ?? []}
                    placeholder="json.path (e.g. riskScore)"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomField}
                    disabled={!newFieldName.trim() || !newFieldPath.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
              {testResult?.preview && testResult.preview.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Normalized preview (first record)</p>
                  <pre className="max-h-40 overflow-auto text-xs text-muted-foreground">
                    {JSON.stringify(testResult.preview[0], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — schedule & secret mode */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Site (optional)</Label>
                <Select value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : null)} className="max-w-xs">
                  <option value="">— No site —</option>
                  {sites?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <div className="flex max-w-xs gap-2 pt-1">
                  <Input
                    value={newSite}
                    onChange={(e) => setNewSite(e.target.value)}
                    placeholder="…or create a new site"
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        createSite();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={createSite} loading={creatingSite} disabled={!newSite.trim()}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Group this source under a site to monitor locations together.</p>
              </div>

              <div className="space-y-2">
                <Label>Refresh interval</Label>
                <RefreshIntervalPicker
                  value={interval}
                  onChange={setInterval}
                  presets={intervals}
                />
                <p className="text-xs text-muted-foreground">
                  How often we pull fresh data from the API. Minimum 15 minutes to stay polite to upstream rate limits.
                </p>
              </div>

              <div className="space-y-3">
                <Label>API key handling</Label>
                <div className="grid gap-3">
                  <button
                    onClick={() => setSecretMode("saved")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      secretMode === "saved" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Save className="h-4 w-4" /> Save the API key (recommended)
                      {secretMode === "saved" && <Badge variant="default" className="ml-auto">Selected</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The key is encrypted at rest with <strong>AES-256-GCM</strong> (authenticated encryption) using a
                      dedicated key, separate from the app key. This enables automatic background refresh on your chosen
                      interval, even while you&apos;re logged out.
                    </p>
                  </button>
                  <button
                    onClick={() => setSecretMode("per_login")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      secretMode === "per_login" ? "border-primary bg-primary/5" : "hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <Lock className="h-4 w-4" /> Require the key on every login
                      {secretMode === "per_login" && <Badge variant="default" className="ml-auto">Selected</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The key is <strong>never written to the database</strong> — it lives only in your encrypted
                      session and is wiped on logout. Maximum secrecy, but background refresh is disabled (data
                      refreshes on-demand during your session).
                    </p>
                  </button>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Only the API key is treated as a secret. Your dashboard layout and source settings are always saved so
                  you never have to reconfigure them.
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={save} loading={saving} disabled={!name || !baseUrl}>
            <Save className="h-4 w-4" /> {isEdit ? "Save changes" : "Connect source"}
          </Button>
        )}
      </div>
    </div>
  );
}

function RefreshIntervalPicker({
  value,
  onChange,
  presets,
}: {
  value: number;
  onChange: (v: number) => void;
  presets: number[];
}) {
  const MIN = 15;
  const MAX = 10080; // one week
  const presetSet = new Set(presets);
  const startsCustom = !presetSet.has(value);
  const [mode, setMode] = useState<"preset" | "custom">(startsCustom ? "custom" : "preset");
  const [draft, setDraft] = useState<string>(String(value));

  function commitCustom(raw: string) {
    setDraft(raw);
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(MAX, Math.max(MIN, n));
    onChange(clamped);
  }

  function labelFor(m: number): string {
    if (m < 60) return `${m} minutes`;
    if (m % 60 === 0) return `${m / 60} hour${m / 60 > 1 ? "s" : ""}`;
    return `${Math.round((m / 60) * 10) / 10} hours`;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={cn(
            "rounded border px-3 py-1 text-xs",
            mode === "preset" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
          )}
        >
          Preset
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("custom");
            setDraft(String(value));
          }}
          className={cn(
            "rounded border px-3 py-1 text-xs",
            mode === "custom" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
          )}
        >
          Custom
        </button>
      </div>

      {mode === "preset" ? (
        <Select
          value={presetSet.has(value) ? value : presets[0] ?? MIN}
          onChange={(e) => onChange(Number(e.target.value))}
          className="max-w-xs"
        >
          {presets.map((m) => (
            <option key={m} value={m}>
              {labelFor(m)}
            </option>
          ))}
        </Select>
      ) : (
        <div className="flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={MIN}
            max={MAX}
            value={draft}
            onChange={(e) => commitCustom(e.target.value)}
            className="w-32"
          />
          <span className="text-xs text-muted-foreground">minutes (min 15, max 10080)</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Current: every <strong>{labelFor(value)}</strong>.
      </p>
    </div>
  );
}
