import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  display_name: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  account_type: z.enum(["personal", "business", "organization"]),
});

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [accountType, setAccountType] = useState<"personal" | "business" | "organization">("personal");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name);
      setAccountType(profile.account_type);
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("bio")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setBio(data?.bio ?? ""));
  }, [user]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar uploaded — don’t forget to save.");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!user) return;
    const parsed = schema.safeParse({ display_name: displayName, bio, account_type: accountType });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Invalid input");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        account_type: accountType,
        avatar_url: avatarUrl,
        settings_completed: true,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      navigate(-1);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold text-foreground">Edit profile</h1>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="space-y-6 p-4">
        <div className="flex flex-col items-center gap-3">
          <img
            src={
              avatarUrl ??
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || "T")}`
            }
            alt=""
            className="h-24 w-24 rounded-full object-cover ring-2 ring-border"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            Change avatar
          </button>
        </div>

        <Field label="Display name">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="input"
          />
        </Field>

        <Field label="Bio" hint={`${bio.length}/280`}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            className="input resize-none"
          />
        </Field>

        <Field label="Account type">
          <div className="flex gap-2">
            {(["personal", "business", "organization"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setAccountType(t)}
                className={`flex-1 rounded-full border px-2 py-2 text-xs font-semibold capitalize transition-colors ${
                  accountType === t
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Switching to Business unlocks the Business details page and the Verified business badge after admin approval.
          </p>
        </Field>

        <p className="pt-4 text-[11px] text-muted-foreground">
          @{profile.nametag} · nametag is permanent
        </p>
      </div>

      <style>{`.input { width: 100%; border-radius: 12px; border: 1px solid hsl(var(--border)); background: hsl(var(--muted)); padding: 0.75rem 1rem; font-size: 0.875rem; color: hsl(var(--foreground)); outline: none; } .input:focus { box-shadow: 0 0 0 2px hsl(var(--ring)); }`}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
