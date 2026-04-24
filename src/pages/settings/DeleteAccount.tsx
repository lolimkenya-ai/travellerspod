import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [confirmTag, setConfirmTag] = useState("");
  const [busy, setBusy] = useState(false);

  async function destroy() {
    if (!profile) return;
    if (confirmTag.trim().toLowerCase() !== profile.nametag.toLowerCase()) {
      toast.error("Type your @nametag exactly to confirm.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    await signOut();
    setBusy(false);
    toast.success("Your account was deleted.");
    navigate("/");
  }

  return (
    <SettingsShell title="Delete account">
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <p className="font-semibold text-destructive">This is permanent.</p>
        <p className="mt-1 text-foreground">
          Your profile, posts, comments, follows, messages and boards will be deleted.
          This action cannot be undone.
        </p>
      </div>
      <div className="mt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Type <span className="font-mono font-semibold text-foreground">@{profile?.nametag ?? ""}</span> to confirm.
        </p>
        <input
          value={confirmTag}
          onChange={(e) => setConfirmTag(e.target.value)}
          placeholder={`@${profile?.nametag ?? ""}`}
          className="w-full rounded-full border border-border bg-muted px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-destructive"
        />
        <button
          onClick={destroy}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-destructive py-3 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Delete my account permanently
        </button>
      </div>
    </SettingsShell>
  );
}
