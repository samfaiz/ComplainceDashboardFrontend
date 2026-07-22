"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, LogIn, Ban, CheckCircle2, Trash2, Inbox, UserPlus, Mail } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { usePlatformOrgs, useSignupRequests, usePlatformMailSettings } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import type { Organization, SignupRequest, PlatformMailSettings } from "@/lib/types";
import { PlatformMailDialog } from "@/components/platform-mail-dialog";

type OrgPrefill = { name?: string; adminName?: string; adminEmail?: string };

const REQUEST_TYPE_LABEL: Record<SignupRequest["account_type"], string> = {
  organization: "Organization",
  mssp: "MSSP",
  individual: "Individual",
  other: "Other",
};
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Dialog, DialogHeader } from "@/components/ui/dialog";

// Platform owner (super_admin) only: create and manage isolated organizations.
export default function PlatformPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  // null = dialog closed; an (even empty) object = open, seeded with those values.
  const [createPrefill, setCreatePrefill] = useState<OrgPrefill | null>(null);
  const [mailOpen, setMailOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && user && !user.is_platform_owner) router.replace("/dashboard");
  }, [isLoading, user, router]);

  const enabled = !!user?.is_platform_owner;
  const { data: orgs, isLoading: orgsLoading } = usePlatformOrgs(enabled);
  const { data: requests, isLoading: reqLoading } = useSignupRequests(enabled);
  const { data: mail } = usePlatformMailSettings(enabled);

  if (!user?.is_platform_owner) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform"
        description="Create and manage organizations. Each one is fully isolated from the others."
      >
        <Button size="sm" onClick={() => setCreatePrefill({})}>
          <Plus className="h-4 w-4" /> New organization
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-5">
          {orgsLoading ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !orgs?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No organizations yet. Create the first one to get started.
            </p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Organization</TH>
                  <TH>Status</TH>
                  <TH>Users</TH>
                  <TH>Sources</TH>
                  <TH>Created</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {orgs.map((o) => (
                  <OrgRow key={o.id} org={o} />
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EmailIntegration mail={mail} onConfigure={() => setMailOpen(true)} />

      <AccountRequests
        requests={requests}
        loading={reqLoading}
        onProvision={(r) =>
          setCreatePrefill({ name: r.organization ?? "", adminName: r.name, adminEmail: r.email })
        }
      />

      {createPrefill && <CreateOrgDialog prefill={createPrefill} onClose={() => setCreatePrefill(null)} />}
      {mailOpen && mail && <PlatformMailDialog settings={mail} onClose={() => setMailOpen(false)} />}
    </div>
  );
}

// Platform email integration: where account-request notifications are sent, and
// whether SMTP is connected. Full config lives in the dialog.
function EmailIntegration({
  mail,
  onConfigure,
}: {
  mail: PlatformMailSettings | undefined;
  onConfigure: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Email notifications</h2>
              {mail ? (
                <Badge variant={mail.enabled ? "success" : "secondary"}>
                  {mail.enabled ? "SMTP on" : "Log only"}
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {mail?.notify_email
                ? <>New account requests are emailed to <span className="font-medium text-foreground">{mail.notify_email}</span>.</>
                : "Set an address to be emailed when someone requests an account."}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={onConfigure} disabled={!mail}>
          Configure
        </Button>
      </CardContent>
    </Card>
  );
}

// Incoming "Contact an admin for an account" requests. Read-only, with a shortcut
// that opens the New-organization dialog pre-filled from the request.
function AccountRequests({
  requests,
  loading,
  onProvision,
}: {
  requests: SignupRequest[] | undefined;
  loading: boolean;
  onProvision: (r: SignupRequest) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Account requests</h2>
          {requests?.length ? <Badge variant="secondary">{requests.length}</Badge> : null}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !requests?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No account requests yet. When someone uses &ldquo;Contact an admin for an account&rdquo; on the
            sign-in page, it lands here.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Requester</TH>
                <TH>Type</TH>
                <TH>Organization</TH>
                <TH>Message</TH>
                <TH>When</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {requests.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="font-medium">{r.name}</div>
                    <a href={`mailto:${r.email}`} className="text-xs text-primary hover:underline">
                      {r.email}
                    </a>
                  </TD>
                  <TD>
                    <Badge variant="outline">{REQUEST_TYPE_LABEL[r.account_type]}</Badge>
                  </TD>
                  <TD className="text-muted-foreground">{r.organization || "—"}</TD>
                  <TD className="max-w-xs">
                    <span className="line-clamp-2 text-sm text-muted-foreground">{r.message || "—"}</span>
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDate(r.created_at)}</TD>
                  <TD className="text-right">
                    <Button size="sm" variant="outline" onClick={() => onProvision(r)}>
                      <UserPlus className="h-3.5 w-3.5" /> Provision
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OrgRow({ org }: { org: Organization }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      await api.post(`/api/platform/organizations/${org.id}/enter`);
      await qc.invalidateQueries(); // refresh /me (banner) + all org-scoped data
      router.push("/dashboard");
    } catch {
      toast({ title: "Could not enter organization", variant: "error" });
      setBusy(false);
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await api.put(`/api/platform/organizations/${org.id}`, { is_active: !org.is_active });
      await qc.invalidateQueries({ queryKey: ["platform", "organizations"] });
    } catch {
      toast({ title: "Update failed", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete "${org.name}" and ALL of its data? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.del(`/api/platform/organizations/${org.id}`);
      await qc.invalidateQueries({ queryKey: ["platform", "organizations"] });
      toast({ title: "Organization deleted", variant: "success" });
    } catch {
      toast({ title: "Delete failed", variant: "error" });
      setBusy(false);
    }
  }

  return (
    <TR>
      <TD>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{org.name}</span>
        </div>
      </TD>
      <TD>
        {org.is_active ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="destructive">Suspended</Badge>
        )}
      </TD>
      <TD>{org.users_count}</TD>
      <TD>{org.sources_count}</TD>
      <TD className="whitespace-nowrap text-muted-foreground">{formatDate(org.created_at)}</TD>
      <TD className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" onClick={enter} loading={busy}>
            <LogIn className="h-3.5 w-3.5" /> Enter
          </Button>
          <Button size="sm" variant="outline" onClick={toggleActive} disabled={busy}>
            {org.is_active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {org.is_active ? "Suspend" : "Activate"}
          </Button>
          <Button size="sm" variant="destructive" onClick={remove} disabled={busy} aria-label="Delete organization">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TD>
    </TR>
  );
}

function CreateOrgDialog({ prefill, onClose }: { prefill: OrgPrefill; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(prefill.name ?? "");
  const [adminName, setAdminName] = useState(prefill.adminName ?? "");
  const [adminEmail, setAdminEmail] = useState(prefill.adminEmail ?? "");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/platform/organizations", {
        name,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
      });
      await qc.invalidateQueries({ queryKey: ["platform", "organizations"] });
      toast({ title: "Organization created", variant: "success" });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError || err.message : "Could not create organization");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader title="New organization" description="Creates an isolated organization and its first admin." />
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Organization name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>

        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">First administrator</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Temporary password</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Min 12 chars. They&apos;ll be asked to change it on first sign-in.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Create organization
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
