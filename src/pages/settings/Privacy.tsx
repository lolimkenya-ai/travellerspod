import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Settings {
  private_account: boolean;
  dm_policy: "everyone" | "followers" | "none";
  comment_policy: "everyone" | "followers" | "none";
}

export default function PrivacySettings() {
  const { user } = useAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("private_account, dm_policy, comment_policy")
        .eq("user_id", user.id)
        .maybeSingle();
      setS(
        (data as Settings) ?? {
          private_account: false,
          dm_policy: "everyone",
          comment_policy: "everyone",
        },
      );
    })();
  }, [user]);

  async function save(patch: Partial<Settings>) {
    if (!user || !s) return;
    setBusy(true);
    const next = { ...s, ...patch };
    setS(next);
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, ...next });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  if (!user) return <SettingsShell title="Privacy"><p className="text-sm text-muted-foreground">Sign in required.</p></SettingsShell>;
  if (!s)
    return (
      <SettingsShell title="Privacy">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </SettingsShell>
    );

  return (
    <SettingsShell title="Privacy">
      <Toggle
        label="Private account"
        hint="Only approved followers can see your posts."
        value={s.private_account}
        onChange={(v) => save({ private_account: v })}
        disabled={busy}
      />
      <Group title="Who can message you" value={s.dm_policy} onChange={(v) => save({ dm_policy: v as Settings["dm_policy"] })}>
        <Pick v="everyone" label="Everyone" />
        <Pick v="followers" label="People I follow back" />
        <Pick v="none" label="No one" />
      </Group>
      <Group title="Who can comment on your posts" value={s.comment_policy} onChange={(v) => save({ comment_policy: v as Settings["comment_policy"] })}>
        <Pick v="everyone" label="Everyone" />
        <Pick v="followers" label="Followers only" />
        <Pick v="none" label="No one" />
      </Group>
    </SettingsShell>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mb-3 flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-muted"
        } disabled:opacity-50`}
        aria-checked={value}
        role="switch"
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Group({
  title,
  value,
  onChange,
  children,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      <div className="flex flex-col gap-1">
        {/* Children consume our context via cloneElement */}
        <GroupContext.Provider value={{ value, onChange }}>{children}</GroupContext.Provider>
      </div>
    </div>
  );
}

import { createContext, useContext } from "react";
const GroupContext = createContext<{ value: string; onChange: (v: string) => void } | null>(null);

function Pick({ v, label }: { v: string; label: string }) {
  const ctx = useContext(GroupContext)!;
  const active = ctx.value === v;
  return (
    <button
      onClick={() => ctx.onChange(v)}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors ${
        active ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:bg-accent"
      }`}
    >
      <span>{label}</span>
      {active && <span className="text-xs font-semibold">✓</span>}
    </button>
  );
}
