"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, ShieldOff, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MyNotificationsCard } from "@/components/notifications/my-notifications-card";
import { RolesPermissionsCard } from "@/components/roles-permissions-card";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Manage your account security." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your profile details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between border-b py-2">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
            </div>
          </CardContent>
        </Card>

        <PasswordCard />
      </div>

      <MfaCard />
      <MyNotificationsCard />
      <RolesPermissionsCard />
    </div>
  );
}

function PasswordCard() {
  const { toast } = useToast();
  const { refresh } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put("/api/password", {
        current_password: current,
        password: pw,
        password_confirmation: confirm,
      });
      toast({ title: "Password updated", variant: "success" });
      setCurrent("");
      setPw("");
      setConfirm("");
      refresh();
    } catch (e) {
      toast({ title: "Update failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Min 12 chars with upper/lowercase, a number and a symbol.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          </div>
          <Button type="submit" loading={busy}>Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function MfaCard() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function begin() {
    setBusy(true);
    try {
      const res = await api.post<{ secret: string; otpauth_url: string }>("/api/mfa/setup");
      setSetup(res);
    } catch (e) {
      toast({ title: "Could not start setup", description: e instanceof ApiError ? e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      const res = await api.post<{ recovery_codes: string[] }>("/api/mfa/confirm", { code });
      setRecoveryCodes(res.recovery_codes);
      setSetup(null);
      setCode("");
      toast({ title: "Two-factor enabled", variant: "success" });
      refresh();
    } catch (e) {
      toast({ title: "Verification failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await api.post("/api/mfa/disable", { password });
      toast({ title: "Two-factor disabled", variant: "success" });
      setPassword("");
      refresh();
    } catch (e) {
      toast({ title: "Disable failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      const res = await api.post<{ recovery_codes: string[] }>("/api/mfa/recovery-codes", { password });
      setRecoveryCodes(res.recovery_codes);
      setPassword("");
      toast({ title: "Recovery codes regenerated", variant: "success" });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof ApiError ? e.firstError || e.message : "Error", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  // Only admins can self-enroll; other users must be flagged by an admin.
  const canSelfEnroll = !!user?.is_admin || !!user?.mfa_required;
  const canSelfDisable = !!user?.is_admin;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-Factor Authentication
          {user?.mfa_enabled ? (
            <Badge variant="success">Enabled</Badge>
          ) : user?.mfa_required ? (
            <Badge variant="warning">Enrollment required</Badge>
          ) : (
            <Badge variant="secondary">Disabled</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {canSelfEnroll
            ? "Protect your account with a TOTP authenticator app (Google Authenticator, Authy, 1Password)."
            : "MFA enrollment is controlled by your administrator. Contact them to enable or disable it for your account."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recoveryCodes && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="mb-2 text-sm font-medium">Save your recovery codes</p>
            <p className="mb-3 text-xs text-muted-foreground">Each code works once if you lose your authenticator. Store them somewhere safe.</p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <span key={c} className="rounded bg-background px-2 py-1">{c}</span>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setRecoveryCodes(null)}>
              I&apos;ve saved them
            </Button>
          </div>
        )}

        {!canSelfEnroll && !user?.mfa_enabled && (
          <p className="text-xs text-muted-foreground">
            An administrator has not granted you MFA enrollment. No action is available here.
          </p>
        )}

        {canSelfEnroll && !user?.mfa_enabled && !setup && !recoveryCodes && (
          <Button onClick={begin} loading={busy}>
            <ShieldCheck className="h-4 w-4" /> Enable two-factor
          </Button>
        )}

        {setup && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="rounded-lg bg-white p-3">
                <QRCodeSVG value={setup.otpauth_url} size={160} />
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">Scan the QR with your authenticator, or enter this secret manually:</p>
                <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs">{setup.secret}</code>
                <div className="space-y-1.5 pt-2">
                  <Label>Enter the 6-digit code to confirm</Label>
                  <div className="flex gap-2">
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="max-w-[140px]" />
                    <Button onClick={confirm} loading={busy} disabled={!code}>Confirm</Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.mfa_enabled && canSelfEnroll && (
          <div className="space-y-3 border-t pt-4">
            <Label>Confirm your password for the actions below</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Current password" className="max-w-sm" />
            <div className="flex gap-2">
              <Button variant="outline" loading={busy} disabled={!password} onClick={regenerate}>
                <KeyRound className="h-4 w-4" /> Regenerate recovery codes
              </Button>
              {canSelfDisable && (
                <Button variant="destructive" loading={busy} disabled={!password} onClick={disable}>
                  <ShieldOff className="h-4 w-4" /> Disable 2FA
                </Button>
              )}
            </div>
            {!canSelfDisable && (
              <p className="text-xs text-muted-foreground">
                Only an administrator can disable MFA for your account.
              </p>
            )}
          </div>
        )}

        {user?.mfa_enabled && !canSelfEnroll && (
          <p className="text-xs text-muted-foreground">
            MFA is active. Contact an administrator to reset or disable it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
