import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ChangeEmail() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Enter a valid email");
    setBusy(true);
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/` },
    );
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your new email to confirm the change.");
  }

  return (
    <SettingsShell title="Change email">
      <div className="mb-3 rounded-xl border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        Current email: <span className="text-foreground">{user?.email ?? "—"}</span>
      </div>
      <div className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="new@email.com"
          className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send confirmation
        </button>
      </div>
    </SettingsShell>
  );
}
