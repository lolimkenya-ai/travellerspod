import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, KeyRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Combined reset-password page.
 * - When loaded fresh: shows email form to send a reset link.
 * - When loaded via Supabase recovery link (URL hash carries access_token + type=recovery,
 *   which Supabase auto-exchanges into a session), shows the new-password form.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checking, setChecking] = useState(true);

  // Email request state
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // New password state
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Supabase fires PASSWORD_RECOVERY when the user lands from the email link.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") setHasRecoverySession(true);
    });
    // Also detect via URL hash (type=recovery) for the initial paint.
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) setHasRecoverySession(true);

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      // Heuristic: a session exists AND we arrived via recovery hash.
      if (data.session && hash.includes("type=recovery")) setHasRecoverySession(true);
      setChecking(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function sendReset() {
    if (!email.trim()) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  async function updatePassword() {
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords don't match");
      return;
    }
    setUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    navigate("/", { replace: true });
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background p-5">
      <header className="mb-6 flex items-center gap-2">
        <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">
          {hasRecoverySession ? "Set a new password" : "Reset password"}
        </h1>
      </header>

      {checking ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : hasRecoverySession ? (
        <div className="space-y-3">
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={updatePassword}
            disabled={updating}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Update password
          </button>
        </div>
      ) : sent ? (
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-foreground">
          <p className="mb-2 font-semibold">Check your inbox</p>
          <p className="text-muted-foreground">
            If <span className="text-foreground">{email}</span> has an account, we just sent a password reset link.
            Click it from this device to set a new password.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enter your account email and we'll send a reset link.
          </p>
          <input
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={sendReset}
            disabled={sending || !email.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Send reset link
          </button>
        </div>
      )}
    </div>
  );
}
