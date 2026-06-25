"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { MfaEnrollmentGate } from "@/components/mfa-enrollment-gate";
import { ForcePasswordChangeGate } from "@/components/force-password-change-gate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // First-login: force a password change before anything else.
  if (user && user.must_change_password) {
    return <ForcePasswordChangeGate />;
  }

  // Admin-mandated MFA: block the app until the user finishes enrollment.
  if (user && user.mfa_required && !user.mfa_enabled) {
    return <MfaEnrollmentGate />;
  }

  return <Shell>{children}</Shell>;
}
