import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert, ExternalLink, Trash2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRoles } from "@/hooks/useRoles";

type Row = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "dismissed" | "actioned";
  created_at: string;
};

type PostPreview = {
  id: string;
  caption: string;
  media_type: "image" | "video" | "text";
  media_url: string | null;
  poster_url: string | null;
  text_background: string | null;
  text_foreground: string | null;
  author_id: string;
  removed_at: string | null;
  removal_reason: string | null;
  author?: { display_name: string; nametag: string };
};

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  scam_fraud: "Scam / fraud",
  harassment: "Harassment",
  hate: "Hate speech",
  nudity_sexual: "Nudity / sexual",
  violence: "Violence",
  misinformation: "Misinformation",
  impersonation: "Impersonation",
  other: "Other",
};

export default function Reports() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useRoles();
  const [rows, setRows] = useState<Row[]>([]);
  const [posts, setPosts] = useState<Record<string, PostPreview>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");

  async function refresh() {
    setLoading(true);
    let q = supabase
      .from("content_reports")
      .select("id, reporter_id, post_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (filter === "open") q = q.in("status", ["open", "reviewing"]);
    const { data: rs, error } = await q;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const reports = (rs as Row[]) ?? [];
    setRows(reports);
    const ids = Array.from(new Set(reports.map((r) => r.post_id).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: ps } = await supabase
        .from("posts")
        .select(
          `id, caption, media_type, media_url, poster_url, text_background, text_foreground,
           author_id, removed_at, removal_reason,
           author:profiles!posts_author_id_fkey ( display_name, nametag )`,
        )
        .in("id", ids);
      const map: Record<string, PostPreview> = {};
      (ps ?? []).forEach((p: any) => (map[p.id] = p));
      setPosts(map);
    } else {
      setPosts({});
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function takedown(postId: string, reason: string) {
    const { error } = await supabase.rpc("takedown_post", { _post_id: postId, _reason: reason });
    if (error) toast.error(error.message);
    else {
      toast.success("Post removed; author notified.");
      refresh();
    }
  }

  async function dismiss(reportId: string) {
    const { error } = await supabase
      .from("content_reports")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("id", reportId);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function restore(postId: string) {
    const { error } = await supabase.rpc("restore_post", { _post_id: postId });
    if (error) toast.error(error.message);
    else {
      toast.success("Post restored.");
      refresh();
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <h1 className="text-base font-semibold text-foreground">Reports queue</h1>
        </div>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(["open", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                (filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground")
              }
            >
              {f === "open" ? "Open" : "All"}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4">
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Nothing to review.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const p = r.post_id ? posts[r.post_id] : undefined;
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {r.status}
                    </span>
                  </div>
                  {r.details && (
                    <p className="mt-2 text-sm text-foreground">"{r.details}"</p>
                  )}

                  {p ? (
                    <div className="mt-3 flex gap-3 rounded-xl border border-border bg-background p-2">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {p.media_type === "image" && p.media_url && (
                          <img src={p.media_url} className="h-full w-full object-cover" alt="" />
                        )}
                        {p.media_type === "video" && p.poster_url && (
                          <img src={p.poster_url} className="h-full w-full object-cover" alt="" />
                        )}
                        {p.media_type === "text" && (
                          <div
                            className="flex h-full w-full items-center justify-center p-1 text-center text-[9px] font-bold"
                            style={{
                              background: p.text_background ?? "#1E293B",
                              color: p.text_foreground ?? "#F8FAFC",
                            }}
                          >
                            <span className="line-clamp-4">{p.caption}</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          @{p.author?.nametag ?? "user"} — {p.author?.display_name ?? ""}
                        </p>
                        <p className="mt-1 line-clamp-3 text-sm text-foreground">{p.caption}</p>
                        {p.removed_at && (
                          <p className="mt-1 text-[11px] font-semibold text-destructive">
                            Removed: {p.removal_reason ?? "policy violation"}
                          </p>
                        )}
                        <Link
                          to={`/post/${p.id}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                        >
                          View post <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs italic text-muted-foreground">
                      Post unavailable (deleted).
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {p && !p.removed_at && (
                      <button
                        onClick={() =>
                          takedown(p.id, REASON_LABEL[r.reason] ?? r.reason)
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                      >
                        <Trash2 className="h-3 w-3" /> Take down + notify
                      </button>
                    )}
                    {p && p.removed_at && (isAdmin || isSuperAdmin) && (
                      <button
                        onClick={() => restore(p.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground"
                      >
                        <RotateCcw className="h-3 w-3" /> Restore
                      </button>
                    )}
                    {r.status !== "dismissed" && (
                      <button
                        onClick={() => dismiss(r.id)}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
