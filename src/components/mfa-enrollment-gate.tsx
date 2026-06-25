"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Full-screen gate shown when an admin has flagged the user as "MFA required"
 * but they haven't enrolled yet. They cannot reach the app until they finish.
 */
export function MfaEnrollmentGate() {
  const { refresh } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await api.post<{ secret: string; otpauth_url: string }>("/api/mfa/setup");
        if (active) setSetup(r);
      } catch (e) {
        if (active) setError(e instanceof ApiError ? e.message : "Could not start setup");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ recovery_codes: string[] }>("/api/mfa/confirm", { code });
      setCodes(r.recovery_codes);
    } catch (e) {
      setError(e instanceof ApiError ? e.firstError || e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await api.post("/api/logout").catch(() => {});
    await refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Set up two-factor authentication</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your administrator requires MFA on your account. Complete setup to continue.
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 pt-6">
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {codes ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Save your recovery codes</p>
                <p className="text-xs text-muted-foreground">Each works once if you lose your authenticator.</p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {codes.map((c) => (
                    <span key={c} className="rounded bg-muted px-2 py-1">{c}</span>
                  ))}
                </div>
                <Button className="w-full" onClick={() => refresh()}>
                  I&apos;ve saved them — continue
                </Button>
              </div>
            ) : setup ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-lg bg-white p-3">
                    <QRCodeSVG value={setup.otpauth_url} size={168} />
                  </div>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Scan with Google Authenticator / Authy / 1Password, or enter this key:
                </p>
                <code className="block break-all rounded bg-muted px-2 py-1 text-center font-mono text-xs">
                  {setup.secret}
                </code>
                <div className="space-y-1.5">
                  <Label>Enter the 6-digit code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    inputMode="numeric"
                    className="text-center tracking-widest"
                  />
                </div>
                <Button className="w-full" onClick={confirm} loading={busy} disabled={!code}>
                  Verify &amp; enable
                </Button>
              </div>
            ) : (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            <button
              onClick={signOut}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
