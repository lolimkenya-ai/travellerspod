import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export default function ChangePassword() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw.length < 8) return toast.error("At least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw("");
    setPw2("");
    toast.success("Password updated");
  }

  return (
    <SettingsShell title="Change password">
      <div className="space-y-3">
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="New password (min 8 chars)"
          className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Update password
        </button>
        <p className="px-2 text-[11px] text-muted-foreground">
          Strong passwords are required and checked against known leaks.
        </p>
      </div>
    </SettingsShell>
  );
}
