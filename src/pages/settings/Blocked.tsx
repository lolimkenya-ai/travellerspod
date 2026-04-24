import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";

interface BlockedRow {
  blocked_id: string;
  profile: { display_name: string; nametag: string; avatar_url: string | null } | null;
}

export default function BlockedAccounts() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("user_blocks")
      .select("blocked_id, profiles!user_blocks_blocked_id_fkey(display_name, nametag, avatar_url)")
      .eq("blocker_id", user.id);
    setRows(
      (data ?? []).map((r: any) => ({
        blocked_id: r.blocked_id,
        profile: r.profiles ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [user]);

  async function unblock(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Unblocked");
      refresh();
    }
  }

  if (!user)
    return (
      <SettingsShell title="Blocked accounts">
        <p className="text-sm text-muted-foreground">Sign in required.</p>
      </SettingsShell>
    );

  return (
    <SettingsShell title="Blocked accounts">
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">No blocked accounts</p>
          <p className="mt-1 text-xs text-muted-foreground">Anyone you block will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.blocked_id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <img
                src={
                  r.profile?.avatar_url ??
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.profile?.display_name ?? "user")}`
                }
                alt=""
                className="h-10 w-10 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{r.profile?.display_name ?? "Unknown"}</p>
                <p className="truncate text-xs text-muted-foreground">@{r.profile?.nametag ?? ""}</p>
              </div>
              <button
                onClick={() => unblock(r.blocked_id)}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </SettingsShell>
  );
}
