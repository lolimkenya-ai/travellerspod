import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function Sessions() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function signOutEverywhere() {
    if (!confirm("Sign out of every device, including this one?")) return;
    setBusy(true);
    // Global scope invalidates all refresh tokens for this user.
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Signed out everywhere");
      navigate("/");
    }
  }

  return (
    <SettingsShell title="Sessions">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">
          You can revoke all of your sessions in one click. You'll need to sign in again on each device.
        </p>
        <button
          onClick={signOutEverywhere}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Sign out everywhere
        </button>
      </div>
    </SettingsShell>
  );
}
