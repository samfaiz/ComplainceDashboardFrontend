"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, Sparkles, Mail } from "lucide-react";
import { api, ApiError, ensureCsrf } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginShowcase } from "@/components/login-showcase";
import { ContactAdminDialog } from "@/components/contact-admin-dialog";

// Builder contact — the "Contact" button links here; the email is shown below it.
const LINKEDIN_URL = "https://www.linkedin.com/in/faisalkhan"; // TODO: set to your exact LinkedIn URL
const CONTACT_EMAIL = "faisalkhan78612@gmail.com";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

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
  const [demoBusy, setDemoBusy] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("expired") === "demo"
      ? "Your demo session has expired. Generate a new one to keep exploring."
      : null
  );

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, router]);

  async function startDemo() {
    setError(null);
    setNotice(null);
    setDemoBusy(true);
    try {
      await ensureCsrf();
      await api.post("/api/demo"); // creates a throwaway workspace and signs in
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many demo accounts from your network. Please try again later.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not start the demo");
      }
      setDemoBusy(false);
    }
  }

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
    <div className="login-light flex min-h-screen bg-white text-foreground">
      {/* Left: product showcase (desktop only) */}
      <div className="hidden lg:block lg:w-1/2 xl:w-[55%]">
        <LoginShowcase />
      </div>

      {/* Right: sign-in */}
      <div className="flex w-full items-center justify-center bg-white px-6 py-10 lg:w-1/2 xl:w-[45%]">
        <div className="w-full max-w-sm">
          {/* mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-bold text-slate-900">EDR Compliance</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {step === "credentials" ? "Welcome back" : "Two-factor authentication"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === "credentials" ? "Sign in to your security console" : "Enter your verification code"}
          </p>

          {notice && (
            <div className="mt-5 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">{notice}</div>
          )}
          {error && (
            <div className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
          )}

          {step === "credentials" ? (
            <div className="mt-6 space-y-5">
              <form onSubmit={submitCredentials} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email" type="email" autoComplete="username" placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setContactOpen(true)}>
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password" type="password" autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)} required
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary" />
                  Remember this device for 30 days
                </label>
                <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
              </form>

              {/* 2FA note */}
              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Two-factor authentication is enforced for accounts that enable it — you&apos;ll verify with your authenticator app after signing in.
              </div>

              {/* demo */}
              <Button
                type="button" variant="outline" className="w-full border-dashed text-primary"
                loading={demoBusy} onClick={startDemo}
              >
                <Sparkles className="h-4 w-4" /> Generate demo account — explore a sample workspace
              </Button>

              <p className="text-center text-sm text-slate-500">
                New here?{" "}
                <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setContactOpen(true)}>
                  Contact an admin for an account
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={submitMfa} className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <KeyRound className="h-4 w-4" />
                {useRecovery ? "Enter a recovery code" : "Enter the 6-digit code from your authenticator"}
              </div>
              <Input
                inputMode={useRecovery ? "text" : "numeric"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={useRecovery ? "XXXXX-XXXXX" : "123456"}
                autoFocus required
                className="text-center tracking-widest"
              />
              <Button type="submit" className="w-full" loading={busy}>Verify</Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button" className="text-slate-500 hover:text-slate-800"
                  onClick={() => { setUseRecovery(!useRecovery); setCode(""); }}
                >
                  {useRecovery ? "Use authenticator code" : "Use a recovery code"}
                </button>
                <button
                  type="button" className="text-slate-500 hover:text-slate-800"
                  onClick={() => { setStep("credentials"); setCode(""); setError(null); }}
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {/* Contact the builder */}
          <div className="mt-8 border-t border-slate-200 pt-5 text-center">
            <p className="text-xs text-slate-400">Built by Faisal Khan</p>
            <div className="mt-2.5 flex items-center justify-center gap-2">
              <a
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" }) + " text-slate-700"}
              >
                <LinkedInIcon className="h-4 w-4" /> Contact
              </a>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className={buttonVariants({ variant: "outline", size: "sm" }) + " text-slate-700"}
              >
                <Mail className="h-4 w-4" /> Email
              </a>
            </div>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-2.5 block text-xs text-slate-500 hover:text-primary">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>
      </div>

      <ContactAdminDialog open={contactOpen} onClose={() => setContactOpen(false)} />
    </div>
  );
}
