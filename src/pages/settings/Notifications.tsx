import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const PREFS = [
  { key: "notify_likes", label: "Likes", hint: "When someone likes your posts" },
  { key: "notify_comments", label: "Comments", hint: "Replies to your posts" },
  { key: "notify_follows", label: "New followers", hint: "When someone follows you" },
  { key: "notify_reposts", label: "Reposts", hint: "When your post is reshared" },
  { key: "notify_inquiries", label: "Inquiries", hint: "Direct inquiries from travelers" },
  { key: "notify_broadcasts", label: "Broadcasts", hint: "Important travelpod announcements" },
  { key: "email_optin", label: "Email digest", hint: "Weekly summary by email" },
] as const;

type PrefKey = (typeof PREFS)[number]["key"];

export default function NotificationSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("notify_likes, notify_comments, notify_follows, notify_reposts, notify_inquiries, notify_broadcasts, email_optin")
        .eq("user_id", user.id)
        .maybeSingle();
      const defaults: Record<PrefKey, boolean> = {
        notify_likes: true,
        notify_comments: true,
        notify_follows: true,
        notify_reposts: true,
        notify_inquiries: true,
        notify_broadcasts: true,
        email_optin: false,
      };
      setPrefs({ ...defaults, ...(data as Partial<Record<PrefKey, boolean>> ?? {}) });
    })();
  }, [user]);

  async function toggle(key: PrefKey) {
    if (!user || !prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setBusy(true);
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...next });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  if (!user) return <SettingsShell title="Notifications"><p className="text-sm text-muted-foreground">Sign in required.</p></SettingsShell>;
  if (!prefs)
    return (
      <SettingsShell title="Notifications">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </SettingsShell>
    );

  return (
    <SettingsShell title="Notifications">
      <div className="space-y-2">
        {PREFS.map((p) => (
          <label
            key={p.key}
            className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{p.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{p.hint}</span>
            </span>
            <button
              type="button"
              onClick={() => toggle(p.key)}
              disabled={busy}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                prefs[p.key] ? "bg-primary" : "bg-muted"
              } disabled:opacity-50`}
              role="switch"
              aria-checked={prefs[p.key]}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
                  prefs[p.key] ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        ))}
      </div>
    </SettingsShell>
  );
}
