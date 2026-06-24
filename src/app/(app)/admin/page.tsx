"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Circle,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldOff,
  UserPlus,
  Copy,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { formatDate, relativeTime } from "@/lib/format";
import type { Role } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog, DialogHeader } from "@/components/ui/dialog";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  mfa_enabled: boolean;
  ip_flagged: boolean;
  is_online: boolean;
  is_locked: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  current_ip: string | null;
  last_seen_at: string | null;
  failed_login_attempts: number;
  api_sources_count: number;
}

export default function AdminPage() {
  const [tab, setTab] = useState("users");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader title="Administration" description="Manage users, monitor sign-ins, and review the audit trail.">
        {tab === "users" && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" /> New user
          </Button>
        )}
      </PageHeader>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "Users" },
          { value: "logins", label: "Login Activity" },
          { value: "audit", label: "Audit Log" },
        ]}
      />

      {tab === "users" && <UsersTab />}
      {tab === "logins" && <LoginsTab />}
      {tab === "audit" && <AuditTab />}

      {createOpen && <CreateUserDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

/* ---------------------------------- Users --------------------------------- */

function UsersTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<{ users: AdminUser[] }>("/api/admin/users").then((r) => r.users),
  });
  const [selected, setSelected] = useState<AdminUser | null>(null);

  if (isLoading) return <LoadingBlock />;

  return (
    <>
      <Card>
        <CardContent className="pt-5">
          <Table>
            <THead>
              <TR>
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Last login</TH>
                <TH>IP</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {data?.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Circle className={`h-2 w-2 ${u.is_online ? "fill-success text-success" : "fill-muted-foreground text-muted-foreground"}`} />
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge variant="secondary" className="capitalize">{u.role}</Badge>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {!u.is_active && <Badge variant="destructive">Disabled</Badge>}
                      {u.is_locked && <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" />Locked</Badge>}
                      {u.ip_flagged && <Badge variant="warning" className="gap-1"><ShieldAlert className="h-3 w-3" />New IP</Badge>}
                      {u.mfa_enabled ? <Badge variant="success">MFA</Badge> : <Badge variant="outline">No MFA</Badge>}
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{relativeTime(u.last_login_at)}</TD>
                  <TD className="font-mono text-xs text-muted-foreground">{u.current_ip ?? u.last_login_ip ?? "—"}</TD>
                  <TD>
                    <Button variant="outline" size="sm" onClick={() => setSelected(u)}>Manage</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
      {selected && <ManageUserDialog user={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ManageUserDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.is_active);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: detail } = useQuery({
    queryKey: ["admin", "user", user.id],
    queryFn: () =>
      api.get<{ known_ips: any[]; recent_logins: any[] }>(`/api/admin/users/${user.id}`),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "user", user.id] });
  }

  async function act(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast({ title: msg, variant: "success" });
      refresh();
    } catch (e) {
      toast({ title: "Action failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setBusy(true);
    try {
      const res = await api.post<{ temporary_password: string | null }>(`/api/admin/users/${user.id}/reset-password`, {});
      setTempPassword(res.temporary_password);
      toast({ title: "Password reset", description: "User must change it next login.", variant: "success" });
      refresh();
    } catch (e) {
      toast({ title: "Reset failed", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader title={user.name} description={user.email} />

      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={active ? "1" : "0"} onChange={(e) => setActive(e.target.value === "1")}>
              <option value="1">Active</option>
              <option value="0">Disabled</option>
            </Select>
          </div>
        </div>
        <Button
          size="sm"
          loading={busy}
          onClick={() => act(() => api.put(`/api/admin/users/${user.id}`, { role, is_active: active }), "User updated")}
        >
          Save changes
        </Button>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" size="sm" loading={busy} onClick={resetPassword}>
            <KeyRound className="h-4 w-4" /> Reset password
          </Button>
          {user.ip_flagged && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => act(() => api.post(`/api/admin/users/${user.id}/clear-ip-flag`, {}), "IP flag cleared")}>
              <ShieldAlert className="h-4 w-4" /> Clear IP flag
            </Button>
          )}
          {user.is_locked && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => act(() => api.post(`/api/admin/users/${user.id}/unlock`, {}), "Account unlocked")}>
              <Lock className="h-4 w-4" /> Unlock
            </Button>
          )}
          {user.mfa_enabled && (
            <Button variant="outline" size="sm" loading={busy} onClick={() => act(() => api.post(`/api/admin/users/${user.id}/disable-mfa`, {}), "MFA reset")}>
              <ShieldOff className="h-4 w-4" /> Reset MFA
            </Button>
          )}
        </div>

        {tempPassword && (
          <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Temporary password</p>
              <p className="font-mono text-sm">{tempPassword}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(tempPassword)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Known IPs</p>
            <div className="space-y-1 text-sm">
              {detail?.known_ips?.length ? (
                detail.known_ips.map((ip: any) => (
                  <div key={ip.id} className="flex items-center justify-between">
                    <span className="font-mono text-xs">{ip.ip_address}</span>
                    <span className="text-xs text-muted-foreground">{ip.login_count}× · {relativeTime(ip.last_seen_at)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">None yet</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Recent sign-ins</p>
            <div className="space-y-1 text-sm">
              {detail?.recent_logins?.slice(0, 6).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between">
                  <span className={`text-xs ${e.successful ? "text-success" : "text-destructive"}`}>
                    {e.successful ? "OK" : "Fail"} {e.is_new_ip ? "· new IP" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{relativeTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    try {
      const res = await api.post<{ temporary_password: string | null }>("/api/admin/users", { name, email, role });
      setTemp(res.temporary_password);
      toast({ title: "User created", variant: "success" });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (e) {
      toast({ title: "Create failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="Create user" description="A temporary password is generated; the user must change it at first login." />
      {temp ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-xs text-muted-foreground">Temporary password for {email}</p>
            <p className="font-mono text-sm">{temp}</p>
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="admin">Admin</option>
              <option value="analyst">Analyst</option>
              <option value="viewer">Viewer</option>
            </Select>
          </div>
          <Button className="w-full" loading={busy} disabled={!name || !email} onClick={create}>
            Create user
          </Button>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------ Login activity ---------------------------- */

function LoginsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "logins"],
    queryFn: () => api.get<{ events: any[] }>("/api/admin/login-events").then((r) => r.events),
  });
  if (isLoading) return <LoadingBlock />;
  return (
    <Card>
      <CardContent className="pt-5">
        <Table>
          <THead>
            <TR>
              <TH>Result</TH>
              <TH>User</TH>
              <TH>IP</TH>
              <TH>When</TH>
              <TH>Detail</TH>
            </TR>
          </THead>
          <TBody>
            {data?.map((e) => (
              <TR key={e.id}>
                <TD>
                  {e.successful ? <Badge variant="success">Success</Badge> : <Badge variant="destructive">Failed</Badge>}
                </TD>
                <TD>{e.user?.email ?? e.email ?? "—"}</TD>
                <TD className="font-mono text-xs">{e.ip_address}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(e.created_at)}</TD>
                <TD className="text-xs text-muted-foreground">
                  {e.is_new_ip && <Badge variant="warning" className="mr-1">New IP</Badge>}
                  {e.failure_reason}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Audit log ------------------------------- */

function AuditTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => api.get<{ logs: any[] }>("/api/admin/audit-logs").then((r) => r.logs),
  });
  if (isLoading) return <LoadingBlock />;
  return (
    <Card>
      <CardContent className="pt-5">
        <Table>
          <THead>
            <TR>
              <TH>Action</TH>
              <TH>Actor</TH>
              <TH>Target</TH>
              <TH>IP</TH>
              <TH>When</TH>
            </TR>
          </THead>
          <TBody>
            {data?.map((l) => (
              <TR key={l.id}>
                <TD><Badge variant="secondary">{l.action}</Badge></TD>
                <TD>{l.user?.email ?? "system"}</TD>
                <TD className="text-xs text-muted-foreground">{l.target_type ? `${l.target_type}#${l.target_id}` : "—"}</TD>
                <TD className="font-mono text-xs">{l.ip_address}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(l.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-40 items-center justify-center">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
