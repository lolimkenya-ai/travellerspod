import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";

/**
 * Admin-only "post as Safiripod" composer. Inserts the post with
 * author_id = official_profile_id (read from app_settings) so it appears
 * under the official @safiripod profile and feeds.
 */
export default function AccessCompose() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const { categories } = useCategories();

  const [officialId, setOfficialId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [bg, setBg] = useState("linear-gradient(135deg,#0F172A,#1E293B)");
  const [fg, setFg] = useState("#F8FAFC");
  const [broadcast, setBroadcast] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "official_profile_id")
      .maybeSingle()
      .then(({ data }) => setOfficialId((data?.value as string | undefined) ?? null));
  }, []);

  if (rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-background p-8 text-center">
        <p className="text-foreground">Super-admins only.</p>
        <button
          onClick={() => navigate("/access")}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to admin
        </button>
      </div>
    );
  }

  async function publish() {
    if (!caption.trim()) {
      toast.error("Add a caption.");
      return;
    }
    if (!officialId) {
      toast.error("Official Safiripod profile is not configured.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("post_as_official", {
      _caption: caption.trim(),
      _location: location.trim() || null,
      _category_slug: categorySlug || null,
      _text_background: bg,
      _text_foreground: fg,
      _is_broadcast: broadcast,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Posted as Safiripod");
      window.dispatchEvent(new Event("posts:changed"));
      navigate("/");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Post as Safiripod</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <div
          className="flex aspect-square w-full items-center justify-center rounded-2xl px-6 text-center text-lg font-semibold"
          style={{ background: bg, color: fg }}
        >
          {caption || "Your message…"}
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="What does Safiripod want to share?"
          className="w-full resize-none rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="rounded-xl border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Category —</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Broadcast
            </span>
            <input
              type="checkbox"
              checked={broadcast}
              onChange={(e) => setBroadcast(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {[
            ["linear-gradient(135deg,#0F172A,#1E293B)", "#F8FAFC"],
            ["linear-gradient(135deg,#F97316,#EA580C)", "#FFF7ED"],
            ["linear-gradient(135deg,#0EA5E9,#0369A1)", "#F0F9FF"],
            ["linear-gradient(135deg,#16A34A,#065F46)", "#F0FDF4"],
            ["linear-gradient(135deg,#DB2777,#7C2D12)", "#FDF2F8"],
          ].map(([b, f]) => (
            <button
              key={b}
              onClick={() => {
                setBg(b);
                setFg(f);
              }}
              className="aspect-square rounded-xl ring-2 ring-transparent hover:ring-foreground"
              style={{ background: b }}
              aria-label="Pick theme"
            />
          ))}
        </div>

        <button
          onClick={publish}
          disabled={busy}
          className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Posting…" : "Post as Safiripod"}
        </button>
      </div>
    </div>
  );
}
