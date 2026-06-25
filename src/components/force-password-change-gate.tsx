"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Full-screen gate shown when must_change_password is true (first login after
 * an account is created or an admin reset the password). The user cannot reach
 * the app until they set a new password.
 */
export function ForcePasswordChangeGate() {
  const { refresh, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.put("/api/password", {
        current_password: current,
        password: pw,
        password_confirmation: confirm,
      });
      await refresh(); // must_change_password flips to false → gate clears
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError || err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await logout();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For security, you must set your own password before using the dashboard.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label>Current (temporary) password</Label>
                <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm new password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
              </div>
              <p className="text-xs text-muted-foreground">Min 12 chars with upper/lowercase, a number and a symbol.</p>
              <Button type="submit" className="w-full" loading={busy}>
                Set password &amp; continue
              </Button>
            </form>
            <button onClick={signOut} className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
