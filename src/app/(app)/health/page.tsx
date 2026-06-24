"use client";

import {
  Activity,
  Database,
  Server,
  Clock,
  ShieldCheck,
  Boxes,
  HardDrive,
} from "lucide-react";
import { useHealth } from "@/lib/queries";
import { relativeTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Status({ ok, stale }: { ok?: boolean; stale?: boolean }) {
  if (stale) return <Badge variant="warning">Degraded</Badge>;
  return ok ? <Badge variant="success">Healthy</Badge> : <Badge variant="destructive">Error</Badge>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: any;
  title: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h3 className="font-medium">{title}</h3>
          </div>
          {status}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export default function HealthPage() {
  const { data, isLoading } = useHealth();

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="System Health" description="Live status of the platform's core subsystems. Auto-refreshes every 30s." />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Panel icon={Server} title="Application">
          <Row label="Name" value={data.app.name} />
          <Row label="Environment" value={data.app.env} />
          <Row label="Laravel" value={data.app.laravel} />
          <Row label="PHP" value={data.app.php} />
        </Panel>

        <Panel icon={Database} title="Database" status={<Status ok={data.database.ok} />}>
          <Row label="Driver" value={data.database.driver ?? "—"} />
          <Row label="Latency" value={`${data.database.latency_ms ?? "—"} ms`} />
        </Panel>

        <Panel icon={HardDrive} title="Cache" status={<Status ok={data.cache.ok} />}>
          <Row label="Store" value={data.cache.store} />
        </Panel>

        <Panel icon={Boxes} title="Queue" status={<Status ok={data.queue.ok} />}>
          <Row label="Connection" value={data.queue.connection} />
          <Row label="Pending jobs" value={data.queue.pending} />
          <Row label="Failed jobs" value={data.queue.failed} />
        </Panel>

        <Panel icon={Clock} title="Scheduler" status={<Status ok={data.scheduler.ok} stale={data.scheduler.stale} />}>
          <Row label="Last run" value={relativeTime(data.scheduler.last_run)} />
          {data.scheduler.hint && <p className="mt-2 text-xs text-muted-foreground">{data.scheduler.hint}</p>}
        </Panel>

        <Panel icon={Activity} title="Sources">
          <Row label="Total" value={data.sources.total} />
          <Row label="Enabled" value={data.sources.enabled} />
          <Row label="Failing" value={<span className={data.sources.failing ? "text-destructive" : ""}>{data.sources.failing}</span>} />
          <Row label="Stale" value={<span className={data.sources.stale ? "text-warning" : ""}>{data.sources.stale}</span>} />
          <Row label="Session-only key" value={data.sources.per_login} />
        </Panel>

        <Panel icon={ShieldCheck} title="Security Posture">
          <Row label="Users" value={data.security.users} />
          <Row label="MFA adoption" value={`${data.security.mfa_adoption_pct}%`} />
          <Row label="Flagged IPs" value={<span className={data.security.flagged_ips ? "text-warning" : ""}>{data.security.flagged_ips}</span>} />
          <Row label="Locked accounts" value={data.security.locked} />
          <Row label="Online now" value={data.security.online} />
        </Panel>
      </div>
    </div>
  );
}
