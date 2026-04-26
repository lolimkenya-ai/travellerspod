import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  ShieldCheck,
  ShieldOff,
  Loader2,
  KeyRound,
  ScrollText,
  FileText,
  Search as SearchIcon,
  Trash2,
  Eye,
  Flag,
  AlertTriangle,
  PenSquare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "queue" | "verified" | "users" | "posts" | "audit";

interface PendingProfile {
  id: string;
  display_name: string;
  nametag: string;
  avatar_url: string | null;
  verification_status: "unverified" | "pending" | "verified";
  account_type: string;
  flagged_danger?: boolean;
  danger_reason?: string | null;
  business: {
    category_slug: string | null;
    associations: string | null;
    registration_number: string | null;
    address: string | null;
    country: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    website: string | null;
  } | null;
}

interface UserRow {
  id: string;
  display_name: string;
  nametag: string;
  avatar_url: string | null;
  account_type: string;
  verified: boolean;
  flagged_danger: boolean;
  followers_count: number;
  roles: string[];
}

interface PostRow {
  id: string;
  caption: string;
  media_type: string;
  is_broadcast: boolean;
  created_at: string;
  author: { display_name: string; nametag: string; avatar_url: string | null } | null;
}

interface AuditRow {
  id: string;
  actor_email: string | null;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface VDoc {
  id: string;
  label: string;
  file_url: string;
  content_type: string | null;
  size_bytes: number | null;
  status: string;
  flag_reason: string | null;
  review_message: string | null;
  created_at: string;
}

export default function Access() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, loading: rolesLoading } = useRoles();
  const [tab, setTab] = useState<Tab>("queue");

  if (rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Frame back={() => navigate("/")} title="Access">
        <Empty
          icon={<KeyRound className="h-8 w-8 text-muted-foreground" />}
          title="Sign in required"
          subtitle="Sign in with the super-admin account to manage Safiripod."
        />
      </Frame>
    );
  }

  if (!isAdmin) {
    return (
      <Frame back={() => navigate("/")} title="Access">
        <Empty
          icon={<KeyRound className="h-8 w-8 text-muted-foreground" />}
          title="Access denied"
          subtitle="This area is for Safiripod admins only."
        />
      </Frame>
    );
  }

  return (
    <Frame back={() => navigate("/")} title="Safiripod admin">
      <div className="sticky top-[57px] z-10 -mt-px overflow-x-auto border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex min-w-max max-w-6xl items-center justify-between gap-2 px-3 py-2">
          <div className="flex gap-1">
            {([
              ["queue", "Queue"],
              ["verified", "Verified"],
              ["users", "Users"],
              ["posts", "Posts"],
              ...(isSuperAdmin ? ([["audit", "Audit log"]] as const) : []),
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k as Tab)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  tab === k
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {isSuperAdmin && (
            <Link
              to="/access/compose"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <PenSquare className="h-3.5 w-3.5" /> Post as Safiripod
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl">
        {tab === "queue" && <QueueTab />}
        {tab === "verified" && <VerifiedTab />}
        {tab === "users" && <UsersTab isSuperAdmin={isSuperAdmin} />}
        {tab === "posts" && <PostsTab />}
        {tab === "audit" && isSuperAdmin && <AuditTab />}
      </div>
    </Frame>
  );
}

/* ------------------------- Queue ------------------------- */

function QueueTab() {
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, nametag, avatar_url, verification_status, account_type, flagged_danger, danger_reason")
      .eq("verification_status", "pending")
      .order("updated_at", { ascending: false });
    const ids = (profiles ?? []).map((p) => p.id);
    const map = new Map<string, PendingProfile["business"]>();
    if (ids.length) {
      const { data: biz } = await supabase.from("business_details").select("*").in("profile_id", ids);
      biz?.forEach((b) => map.set(b.profile_id, b as PendingProfile["business"]));
    }
    setPending(
      (profiles ?? []).map((p: any) => ({ ...(p as PendingProfile), business: map.get(p.id) ?? null })),
    );
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) return <Spinner />;
  if (pending.length === 0)
    return (
      <Empty
        icon={<ShieldCheck className="h-8 w-8 text-muted-foreground" />}
        title="Queue empty"
        subtitle="No pending verification requests."
      />
    );

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {pending.map((p) => (
        <ReviewCard
          key={p.id}
          profile={p}
          expanded={openId === p.id}
          onToggle={() => setOpenId((prev) => (prev === p.id ? null : p.id))}
          onChanged={refresh}
        />
      ))}
    </div>
  );
}

function ReviewCard({
  profile,
  expanded,
  onToggle,
  onChanged,
}: {
  profile: PendingProfile;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const b = profile.business;
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!expanded) return;
    setDocsLoading(true);
    supabase
      .from("verification_documents")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setDocs((data ?? []) as VDoc[]);
        setDocsLoading(false);
      });
  }, [expanded, profile.id]);

  async function decide(decision: "verified" | "unverified") {
    if (decision === "unverified" && !reason.trim()) {
      toast.error("Please add a reason — the user will see it.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("decide_verification", {
      _profile: profile.id,
      _decision: decision,
      _reason: decision === "unverified" ? reason.trim() : null,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(decision === "verified" ? "Verified" : "Rejected with reason");
      onChanged();
    }
  }

  async function flagDoc(d: VDoc) {
    const r = window.prompt("Why is this document being flagged?", d.flag_reason ?? "");
    if (r === null) return;
    const { error } = await supabase.rpc("flag_document", {
      _doc: d.id,
      _flagged: true,
      _reason: r.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Flagged");
      setDocs((arr) => arr.map((x) => (x.id === d.id ? { ...x, status: "flagged", flag_reason: r.trim() || null } : x)));
    }
  }

  async function setDanger(on: boolean) {
    let r: string | null = null;
    if (on) {
      r = window.prompt("Reason this account is dangerous? (shown to admins, used for protection)") ?? null;
      if (!r || !r.trim()) return;
    }
    const { error } = await supabase.rpc("set_user_danger", {
      _user: profile.id,
      _flagged: on,
      _reason: r,
    });
    if (error) toast.error(error.message);
    else {
      toast.success(on ? "Marked as danger account" : "Cleared danger flag");
      onChanged();
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <button onClick={onToggle} className="flex w-full items-center gap-3 text-left">
        <img
          src={profile.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.display_name)}`}
          alt=""
          className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
            {profile.display_name}
            {profile.flagged_danger && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          </p>
          <p className="truncate text-xs text-muted-foreground">@{profile.nametag} · {profile.account_type}</p>
        </div>
        <Eye className="h-4 w-4 text-muted-foreground" />
      </button>

      {b && (
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs">
          {b.category_slug && <Detail k="Category" v={b.category_slug} />}
          {b.associations && <Detail k="Associations" v={b.associations} />}
          {b.registration_number && <Detail k="Reg №" v={b.registration_number} />}
          {(b.address || b.country) && <Detail k="Location" v={[b.address, b.country].filter(Boolean).join(", ")} />}
          {b.contact_email && <Detail k="Email" v={b.contact_email} />}
          {b.contact_phone && <Detail k="Phone" v={b.contact_phone} />}
          {b.website && <Detail k="Website" v={b.website} />}
        </div>
      )}

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Documents</p>
          {docsLoading ? (
            <Spinner />
          ) : docs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{d.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {d.content_type ?? "file"} · {d.status}
                      {d.flag_reason && ` · ${d.flag_reason}`}
                    </p>
                  </div>
                  <a
                    href={d.file_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"
                  >
                    Open
                  </a>
                  <button
                    onClick={() => flagDoc(d)}
                    className="rounded-full bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
                    aria-label="Flag document"
                  >
                    <Flag className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Reason if rejecting (shown to user in their verification thread)…"
            className="mt-3 w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              disabled={busy}
              onClick={() => decide("verified")}
              className="inline-flex items-center justify-center gap-1 rounded-full bg-verified/20 py-2 text-xs font-semibold text-verified-foreground hover:bg-verified/30 disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Approve
            </button>
            <button
              disabled={busy}
              onClick={() => decide("unverified")}
              className="inline-flex items-center justify-center gap-1 rounded-full bg-destructive/15 py-2 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-50"
            >
              <ShieldOff className="h-3.5 w-3.5" /> Reject
            </button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2">
            <button
              onClick={() => setDanger(!profile.flagged_danger)}
              className={cn(
                "inline-flex items-center justify-center gap-1 rounded-full py-1.5 text-[11px] font-semibold",
                profile.flagged_danger
                  ? "bg-muted text-foreground hover:bg-accent"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20",
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {profile.flagged_danger ? "Clear danger flag" : "Mark as danger account"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Verified ------------------------- */

function VerifiedTab() {
  const [list, setList] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, nametag, avatar_url, verification_status, account_type, flagged_danger, danger_reason")
      .eq("verification_status", "verified")
      .order("updated_at", { ascending: false })
      .limit(200);
    setList(((data ?? []) as PendingProfile[]).map((p) => ({ ...p, business: null })));
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function revoke(id: string) {
    const reason = window.prompt("Reason for revoking verification (sent to user)") ?? "";
    if (!reason.trim()) return;
    const { error } = await supabase.rpc("decide_verification", {
      _profile: id,
      _decision: "unverified",
      _reason: reason.trim(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Revoked");
      refresh();
    }
  }

  if (loading) return <Spinner />;
  if (list.length === 0)
    return <Empty icon={<BadgeCheck className="h-8 w-8 text-muted-foreground" />} title="No verified accounts yet" subtitle="" />;

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <img
              src={p.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.display_name)}`}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                {p.display_name}
                <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />
              </p>
              <p className="text-xs text-muted-foreground">@{p.nametag}</p>
            </div>
          </div>
          <button
            onClick={() => revoke(p.id)}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-full bg-muted py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
          >
            <ShieldOff className="h-3 w-3" /> Revoke verification
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Users ------------------------- */

function UsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("id, display_name, nametag, avatar_url, account_type, verified, flagged_danger, followers_count")
      .order("followers_count", { ascending: false })
      .limit(60);
    if (q.trim()) {
      const term = `%${q.trim()}%`;
      query = query.or(`display_name.ilike.${term},nametag.ilike.${term}`);
    }
    const { data: profiles } = await query;
    const ids = (profiles ?? []).map((p) => p.id);
    const roleMap = new Map<string, string[]>();
    if (ids.length) {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      roles?.forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
    }
    setUsers(
      (profiles ?? []).map((p: any) => ({ ...(p as Omit<UserRow, "roles">), roles: roleMap.get(p.id) ?? [] })),
    );
    setLoading(false);
  }
  useEffect(() => {
    const h = setTimeout(refresh, 200);
    return () => clearTimeout(h);
  }, [q]);

  async function setRole(userId: string, role: "admin" | "moderator", on: boolean) {
    if (on) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
      toast.success(`${role} granted`);
    } else {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) return toast.error(error.message);
      toast.success(`${role} revoked`);
    }
    refresh();
  }

  async function toggleDanger(u: UserRow) {
    let reason: string | null = null;
    if (!u.flagged_danger) {
      reason = window.prompt("Reason for flagging this account as dangerous?") ?? null;
      if (!reason || !reason.trim()) return;
    }
    const { error } = await supabase.rpc("set_user_danger", {
      _user: u.id,
      _flagged: !u.flagged_danger,
      _reason: reason,
    });
    if (error) return toast.error(error.message);
    toast.success(u.flagged_danger ? "Cleared" : "Flagged");
    refresh();
  }

  return (
    <div className="px-4 py-4">
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users by name or @tag"
          className="w-full rounded-full border border-border bg-muted py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <img
                src={u.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.display_name)}`}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
              />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                  {u.display_name}
                  {u.verified && <BadgeCheck className="h-3.5 w-3.5 fill-verified text-verified-foreground" />}
                  {u.flagged_danger && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{u.nametag} · {u.account_type} · {u.followers_count} followers
                </p>
                {u.roles.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {isSuperAdmin && (
                  <>
                    <RoleToggle on={u.roles.includes("admin")} label="Admin" onChange={(v) => setRole(u.id, "admin", v)} />
                    <RoleToggle on={u.roles.includes("moderator")} label="Mod" onChange={(v) => setRole(u.id, "moderator", v)} />
                  </>
                )}
                <button
                  onClick={() => toggleDanger(u)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    u.flagged_danger
                      ? "border-border text-foreground hover:bg-accent"
                      : "border-destructive/40 text-destructive hover:bg-destructive/10",
                  )}
                >
                  {u.flagged_danger ? "Unflag" : "Flag"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleToggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* ------------------------- Posts ------------------------- */

function PostsTab() {
  const [q, setQ] = useState("");
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    let query = supabase
      .from("posts")
      .select("id, caption, media_type, is_broadcast, created_at, profiles!posts_author_id_fkey(display_name, nametag, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q.trim()) query = query.ilike("caption", `%${q.trim()}%`);
    const { data } = await query;
    setPosts(
      (data ?? []).map((p: any) => ({
        id: p.id,
        caption: p.caption,
        media_type: p.media_type,
        is_broadcast: p.is_broadcast,
        created_at: p.created_at,
        author: p.profiles ?? null,
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    const h = setTimeout(refresh, 200);
    return () => clearTimeout(h);
  }, [q]);

  async function remove(id: string) {
    if (!confirm("Delete this post permanently?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed");
      refresh();
    }
  }

  return (
    <div className="px-4 py-4">
      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search posts by caption"
          className="w-full rounded-full border border-border bg-muted py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    @{p.author?.nametag ?? "?"} · {p.media_type}
                    {p.is_broadcast && <span className="ml-2 rounded-full bg-primary/15 px-2 text-[10px] font-bold text-primary">BROADCAST</span>}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm text-foreground">{p.caption}</p>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
                  aria-label="Delete post"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Audit ------------------------- */

function AuditTab() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  async function refresh() {
    setLoading(true);
    let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (actionFilter) q = q.eq("action", actionFilter);
    const { data } = await q;
    setLogs((data ?? []) as AuditRow[]);
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, [actionFilter]);

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs]);

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setActionFilter("")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            !actionFilter ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
          )}
        >
          All
        </button>
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => setActionFilter(a)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              actionFilter === a ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground",
            )}
          >
            {a}
          </button>
        ))}
      </div>
      {loading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <Empty icon={<ScrollText className="h-8 w-8 text-muted-foreground" />} title="No log entries" subtitle="" />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {logs.map((l) => (
            <div key={l.id} className="rounded-xl border border-border bg-card p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-semibold text-foreground">{l.action}</span>
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 truncate text-muted-foreground">
                {l.actor_email ?? l.actor_id ?? "system"}
                {l.entity_type && ` → ${l.entity_type}:${l.entity_id}`}
              </p>
              {Object.keys(l.metadata ?? {}).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                  {JSON.stringify(l.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Layout helpers ------------------------- */

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{k}:</span> {v}
    </p>
  );
}

function Frame({ back, title, children }: { back: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3">
          <button onClick={back} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
        </div>
      </header>
      {children}
    </div>
  );
}

function Empty({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon}
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
