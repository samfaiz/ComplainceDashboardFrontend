"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError, ensureCsrf } from "@/lib/api";
import { Dialog, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const TYPES = [
  { v: "organization", l: "Organization / Enterprise" },
  { v: "mssp", l: "MSSP / Managed Service Provider" },
  { v: "individual", l: "Individual user" },
  { v: "other", l: "Other" },
];

/** "Contact admin for a new account" — accounts are admin-provisioned, so a
 * prospect sends a request telling us who they are. Posts to /api/signup-request. */
export function ContactAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState("organization");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [org, setOrg] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const needsOrg = type === "organization" || type === "mssp";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensureCsrf();
      const res = await api.post<{ message: string }>("/api/signup-request", {
        name,
        email,
        account_type: type,
        organization: needsOrg ? org : null,
        message: message || null,
      });
      setDone(res.message);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many requests from your network — please try again later.");
      } else {
        setError(err instanceof ApiError ? err.firstError || err.message : "Could not send your request");
      }
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setDone(null);
    setError(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={close}>
      {done ? (
        <div className="py-4 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">Request sent</h2>
          <p className="mt-1 text-sm text-muted-foreground">{done}</p>
          <Button className="mt-5" onClick={close}>Done</Button>
        </div>
      ) : (
        <>
          <DialogHeader
            title="Request an account"
            description="Accounts are provisioned by an administrator. Tell us who you are and we'll be in touch."
          />
          {error && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <form onSubmit={submit} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>I&apos;m signing up as</Label>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => (
                  <option key={t.v} value={t.v}>{t.l}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            {needsOrg && (
              <div className="space-y-1.5">
                <Label>{type === "mssp" ? "MSSP / company name" : "Organization name"}</Label>
                <Input value={org} onChange={(e) => setOrg(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>
                Anything else? <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="How many endpoints? Which EDR / AV tools do you run?"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={close}>Cancel</Button>
              <Button type="submit" loading={busy}>Send request</Button>
            </div>
          </form>
        </>
      )}
    </Dialog>
  );
}
