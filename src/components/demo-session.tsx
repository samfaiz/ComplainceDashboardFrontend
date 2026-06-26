"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader } from "@/components/ui/dialog";

/**
 * For demo ("try it") accounts: a one-time welcome prompt, a live countdown
 * banner, and an auto sign-out the instant the 1-hour window elapses. The
 * backend enforces expiry independently (BlockExpiredDemo) — this is the UX
 * layer so the user always knows their time and is signed out cleanly.
 */
export function DemoSession() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  // The shell only renders for authenticated users, so `user` is available at
  // first render — read the once-per-session ack flag eagerly (client only).
  const [acked, setAcked] = useState<boolean>(() =>
    typeof window !== "undefined" && user?.is_demo
      ? sessionStorage.getItem(`demo-ack-${user.id}`) === "1"
      : true
  );

  const expiresAt =
    user?.is_demo && user.demo_expires_at ? new Date(user.demo_expires_at).getTime() : null;

  // Keep `endDemo` pointing at the latest logout without re-arming the timer.
  const endRef = useRef<() => void>(() => {});
  useEffect(() => {
    endRef.current = () => {
      void logout().then(() => router.replace("/login?expired=demo"));
    };
  });

  // Tick the countdown label.
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // Auto sign-out exactly at expiry (or immediately if already past).
  useEffect(() => {
    if (!expiresAt) return;
    const t = setTimeout(() => endRef.current(), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [expiresAt]);

  function dismiss() {
    if (user) sessionStorage.setItem(`demo-ack-${user.id}`, "1");
    setAcked(true);
  }

  if (!user?.is_demo || !expiresAt) return null;

  const minsLeft = Math.max(0, Math.ceil((expiresAt - now) / 60_000));

  return (
    <>
      <div className="flex items-center justify-center gap-2 border-b border-primary/40 bg-primary/10 px-5 py-2 text-xs text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Demo workspace — <strong className="font-semibold">{minsLeft} min left</strong>. This is a
        temporary sandbox; it&apos;s deleted when it expires.
      </div>

      <Dialog open={!acked} onClose={dismiss}>
        <DialogHeader
          title="Welcome to the demo 👋"
          description="You're exploring a private, sample-loaded workspace."
        />
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              This demo account <strong className="text-foreground">expires in 1 hour</strong>, then
              you&apos;re automatically signed out and it&apos;s permanently removed.
            </span>
          </p>
          <p>Everything here is isolated sample data — feel free to click around.</p>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={dismiss}>OK, got it</Button>
        </div>
      </Dialog>
    </>
  );
}
