"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound } from "lucide-react";
import { api, ApiError, ensureCsrf } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, refresh } = useAuth();

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, router]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await ensureCsrf();
      const res = await api.post<{ mfa_required?: boolean }>("/api/login", { email, password, remember });
      if (res?.mfa_required) {
        setStep("mfa");
      } else {
        await refresh();
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError || err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = useRecovery ? { recovery_code: code } : { code };
      await api.post("/api/login/mfa", body);
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError || err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">EDR Compliance Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "credentials" ? "Sign in to your security console" : "Two-factor authentication"}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {step === "credentials" ? (
              <form onSubmit={submitCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Remember this device
                </label>
                <Button type="submit" className="w-full" loading={busy}>
                  Sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={submitMfa} className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                  {useRecovery ? "Enter a recovery code" : "Enter the 6-digit code from your authenticator"}
                </div>
                <Input
                  inputMode={useRecovery ? "text" : "numeric"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={useRecovery ? "XXXXX-XXXXX" : "123456"}
                  autoFocus
                  required
                  className="text-center tracking-widest"
                />
                <Button type="submit" className="w-full" loading={busy}>
                  Verify
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setUseRecovery(!useRecovery);
                      setCode("");
                    }}
                  >
                    {useRecovery ? "Use authenticator code" : "Use a recovery code"}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStep("credentials");
                      setCode("");
                      setError(null);
                    }}
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
