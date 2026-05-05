import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Briefcase,
  Inbox,
  Users,
  ShieldCheck,
  BadgeCheck,
  Clock,
  ShieldAlert,
  Trash2,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Heart,
  MessageCircle,
  Bookmark,
  Plus,
  Link as LinkIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "overview" | "posts" | "inquiries" | "team" | "verification" | "resources";

interface PostRow {
  id: string;
  caption: string;
  media_type: string;
  media_url: string | null;
  poster_url: string | null;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  created_at: string;
  removed_at: string | null;
}

interface ConvRow {
  id: string;
  is_inquiry: boolean;
  last_message: string | null;
  last_message_at: string;
  other?: { id: string; display_name: string; nametag: string; avatar_url: string | null } | null;
}

interface MemberRow {
  user_id: string;
  role: string;
  profile?: { display_name: string; nametag: string; avatar_url: string | null } | null;
}

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [convs, setConvs] = useState<ConvRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [verification, setVerification] = useState<string>("unverified");
  const [resources, setResources] = useState<any[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      // Posts
      const { data: p } = await supabase
        .from("posts")
        .select("id, caption, media_type, media_url, poster_url, likes_count, comments_count, saves_count, created_at, removed_at")
        .eq("author_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setPosts((p as PostRow[]) ?? []);

      // Inquiry conversations
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);
      const ids = (parts ?? []).map((x: any) => x.conversation_id);
      if (ids.length) {
        const { data: cs } = await supabase
          .from("conversations")
          .select("id, is_inquiry, last_message, last_message_at")
          .in("id", ids)
          .eq("is_inquiry", true)
          .order("last_message_at", { ascending: false })
          .limit(50);
        const list = (cs as ConvRow[]) ?? [];
        // resolve other participant
        if (list.length) {
          const { data: parts2 } = await supabase
            .from("conversation_participants")
            .select("conversation_id, user_id")
            .in("conversation_id", list.map((c) => c.id));
          const otherIds = Array.from(
            new Set((parts2 ?? []).filter((p: any) => p.user_id !== user!.id).map((p: any) => p.user_id)),
          );
          const { data: profs } = otherIds.length
            ? await supabase
                .from("profiles")
                .select("id, display_name, nametag, avatar_url")
                .in("id", otherIds)
            : { data: [] };
          const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
          for (const c of list) {
            const otherId = (parts2 ?? []).find(
              (x: any) => x.conversation_id === c.id && x.user_id !== user!.id,
            )?.user_id;
            c.other = otherId ? (profMap.get(otherId) as any) ?? null : null;
          }
        }
        setConvs(list);
      } else {
        setConvs([]);
      }

      // Team members (where this user is the business)
      const { data: m } = await supabase
        .from("business_members")
        .select("user_id, role")
        .eq("business_id", user!.id);
      const memberList = (m as MemberRow[]) ?? [];
      if (memberList.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, nametag, avatar_url")
          .in("id", memberList.map((x) => x.user_id));
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        for (const x of memberList) x.profile = (map.get(x.user_id) as any) ?? null;
      }
      setMembers(memberList);

      // Verification status
      const { data: prof } = await supabase
        .from("profiles")
        .select("verification_status")
        .eq("id", user!.id)
        .maybeSingle();
      setVerification((prof as any)?.verification_status ?? "unverified");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const active = posts.filter((p) => !p.removed_at);
    const totals = active.reduce(
      (acc, p) => {
        acc.likes += p.likes_count;
        acc.comments += p.comments_count;
        acc.saves += p.saves_count;
        return acc;
      },
      { likes: 0, comments: 0, saves: 0 },
    );
    return {
      posts: active.length,
      inquiries: convs.length,
      ...totals,
    };
  }, [posts, convs]);

  async function deletePost(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPosts((ps) => ps.filter((p) => p.id !== id));
    toast.success("Post deleted");
  }

  async function addMember() {
    if (!addEmail.trim()) return;
    setAddBusy(true);
    try {
      // Look up profile by nametag (entered after @) or fall back to email-as-nametag
      const tag = addEmail.trim().replace(/^@/, "").toLowerCase();
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, display_name, nametag, avatar_url")
        .eq("nametag", tag)
        .maybeSingle();
      if (!prof) {
        toast.error("No user with that @nametag");
        return;
      }
      if (prof.id === user!.id) {
        toast.error("You're already the owner");
        return;
      }
      const { error } = await supabase.from("business_members").insert({
        business_id: user!.id,
        user_id: prof.id,
        role: "editor",
        added_by: user!.id,
      });
      if (error) throw error;
      toast.success(`Added @${prof.nametag}`);
      setAddEmail("");
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to add");
    } finally {
      setAddBusy(false);
    }
  }

  async function removeMember(userId: string) {
    const { error } = await supabase
      .from("business_members")
      .delete()
      .eq("business_id", user!.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMembers((ms) => ms.filter((m) => m.user_id !== userId));
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !profile) return null;

  if (profile.account_type !== "business") {
    return (
      <div className="mx-auto min-h-screen max-w-[640px] bg-background p-8 text-center">
        <Briefcase className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-foreground">Business dashboard is only available to business accounts.</p>
        <Link
          to="/settings/profile"
          className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Update profile
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[720px] bg-background pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-foreground">Business dashboard</h1>
          <p className="text-xs text-muted-foreground">@{profile.nametag}</p>
        </div>
        <VerifPill status={verification} />
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {(
          [
            ["overview", "Overview", BarChart3],
            ["posts", "Posts", ImageIcon],
            ["inquiries", "Inquiries", Inbox],
            ["team", "Team", Users],
            ["verification", "Verification", ShieldCheck],
            ["resources", "Resources", LinkIcon],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
              tab === k ? "bg-foreground text-background" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-4 py-4">
        {tab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={ImageIcon} label="Active posts" value={stats.posts} />
              <Stat icon={Inbox} label="Open inquiries" value={stats.inquiries} />
              <Stat icon={Heart} label="Total likes" value={stats.likes} />
              <Stat icon={Bookmark} label="Total saves" value={stats.saves} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">Quick actions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/settings/business"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  <Briefcase className="h-3.5 w-3.5" /> Edit business profile
                </Link>
                <Link
                  to="/messages"
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                >
                  <Inbox className="h-3.5 w-3.5" /> Open inbox
                </Link>
              </div>
            </div>
          </div>
        )}

        {tab === "posts" && (
          <div className="space-y-2">
            {posts.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No posts yet.</p>
            )}
            {posts.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex gap-3 rounded-xl border border-border bg-card p-3",
                  p.removed_at && "opacity-60",
                )}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {p.poster_url || p.media_url ? (
                    <img src={p.poster_url ?? p.media_url ?? ""} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-foreground">{p.caption}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {p.likes_count}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {p.comments_count}</span>
                    <span className="inline-flex items-center gap-1"><Bookmark className="h-3 w-3" /> {p.saves_count}</span>
                    {p.removed_at && <span className="text-destructive">Removed</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Link
                    to={`/post/${p.id}`}
                    className="rounded-full p-1.5 hover:bg-accent"
                    aria-label="Open post"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <button
                    onClick={() => deletePost(p.id)}
                    className="rounded-full p-1.5 hover:bg-accent"
                    aria-label="Delete post"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "inquiries" && (
          <div className="space-y-2">
            {convs.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No inquiries yet.</p>
            )}
            {convs.map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent"
              >
                <img
                  src={
                    c.other?.avatar_url ??
                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(c.other?.display_name ?? "?")}`
                  }
                  className="h-10 w-10 rounded-full object-cover"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {c.other?.display_name ?? "Unknown"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{c.last_message ?? "—"}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.last_message_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}

        {tab === "team" && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add team member
              </p>
              <div className="flex gap-2">
                <input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="@nametag"
                  className="flex-1 rounded-full border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={addMember}
                  disabled={addBusy}
                  className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {addBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </button>
              </div>
            </div>
            {members.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No team members yet.</p>
            ) : (
              members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <img
                    src={
                      m.profile?.avatar_url ??
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.profile?.display_name ?? "?")}`
                    }
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {m.profile?.display_name ?? m.user_id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{m.profile?.nametag} · {m.role}
                    </p>
                  </div>
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="rounded-full p-1.5 hover:bg-accent"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "verification" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <VerifPill status={verification} />
              </div>
              <p className="text-sm text-muted-foreground">
                {verification === "verified"
                  ? "Your business is verified. The verification badge appears on your profile and posts."
                  : verification === "pending"
                  ? "Your verification is under review by Safiripod admins."
                  : "Submit verification documents and details to get the verified badge and unlock the Inquire button on your posts."}
              </p>
              <Link
                to="/settings/business"
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {verification === "unverified" ? "Submit for verification" : "Manage verification"}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function VerifPill({ status }: { status: string }) {
  if (status === "verified")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-verified/15 px-2 py-0.5 text-xs font-semibold text-verified-foreground">
        <BadgeCheck className="h-3 w-3" /> Verified
      </span>
    );
  if (status === "pending")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600">
        <Clock className="h-3 w-3" /> Pending
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
      <ShieldAlert className="h-3 w-3" /> Unverified
    </span>
  );
}
