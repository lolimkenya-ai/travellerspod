import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Flag,
  Loader2,
  Settings,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Trash2,
  RotateCcw,
  Video,
  Image as ImageIcon,
  MessageSquare,
  Crown,
  Shield,
  ShieldCheck,
  ShieldOff,
  FileText,
  RefreshCw,
  ArrowLeft,
  Link as LinkIcon,
  Plus,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SystemStats {
  total_users: number;
  total_posts: number;
  total_reports: number;
  open_reports: number;
  removed_posts: number;
  verified_businesses: number;
  pending_verifications: number;
  total_messages: number;
  active_conversations: number;
}

interface AuditLog {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  metadata: any;
}

interface ManagedUser {
  id: string;
  nametag: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  account_type: string;
  flagged_danger: boolean;
  created_at: string;
  roles: string[];
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const TABS = ["overview", "moderation", "reports", "users", "audit", "flags", "resources", "settings"] as const;
type Tab = typeof TABS[number];

interface ModPost {
  id: string;
  author_id: string;
  media_type: string;
  media_url: string | null;
  poster_url: string | null;
  caption: string | null;
  removed_at: string | null;
  removal_reason: string | null;
  created_at: string;
  author?: { display_name: string; nametag: string; avatar_url: string | null } | null;
}

interface ContentReport {
  id: string;
  reporter_id: string;
  post_id: string | null;
  comment_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolution_note: string | null;
}

export default function SuperadminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetting, setSelectedSetting] = useState<any>(null);
  const [settingValue, setSettingValue] = useState("");
  const [settings, setSettings] = useState<any[]>([]);
  const [modPosts, setModPosts] = useState<ModPost[]>([]);
  const [modFilter, setModFilter] = useState<"active" | "removed">("active");
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [reportFilter, setReportFilter] = useState<"open" | "resolved">("open");
  const [resources, setResources] = useState<any[]>([]);
  const [editingResource, setEditingResource] = useState<any | null>(null);
  const [resourceBusy, setResourceBusy] = useState(false);

  const loadResources = useCallback(async () => {
    const { data, error } = await supabase
      .from("business_resources" as any)
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setResources((data as any[]) ?? []);
  }, []);

  useEffect(() => {
    if (activeTab === "resources") void loadResources();
  }, [activeTab, loadResources]);

  async function saveResource(r: any) {
    setResourceBusy(true);
    try {
      const payload = {
        title: r.title?.trim() ?? "",
        url: r.url?.trim() ?? "",
        description: r.description?.trim() || null,
        category: r.category?.trim() || null,
        icon: r.icon?.trim() || null,
        sort_order: Number(r.sort_order) || 0,
        is_active: r.is_active !== false,
      };
      if (!payload.title || !payload.url) {
        toast.error("Title and URL required");
        return;
      }
      if (r.id) {
        const { error } = await supabase.from("business_resources" as any).update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_resources" as any).insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
      toast.success("Saved");
      setEditingResource(null);
      await loadResources();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setResourceBusy(false);
    }
  }

  async function deleteResource(id: string) {
    if (!confirm("Delete this resource?")) return;
    const { error } = await supabase.from("business_resources" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResources((rs) => rs.filter((x) => x.id !== id));
  }

  // Redirect if not super admin (once roles resolved)
  useEffect(() => {
    if (!rolesLoading && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, rolesLoading, navigate]);

  /* ---- Data fetchers ---- */

  const fetchStats = useCallback(async () => {
    try {
      const [users, posts, reports, openReports, removed, verified, pending, msgs, convs] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("posts").select("*", { count: "exact", head: true }),
        supabase.from("content_reports").select("*", { count: "exact", head: true }),
        supabase.from("content_reports").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("posts").select("*", { count: "exact", head: true }).not("removed_at", "is", null),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_verified", true).eq("account_type", "business"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("verification_status", "pending"),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase.from("conversations").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        total_users: users.count ?? 0,
        total_posts: posts.count ?? 0,
        total_reports: reports.count ?? 0,
        open_reports: openReports.count ?? 0,
        removed_posts: removed.count ?? 0,
        verified_businesses: verified.count ?? 0,
        pending_verifications: pending.count ?? 0,
        total_messages: msgs.count ?? 0,
        active_conversations: convs.count ?? 0,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!error) setAuditLogs((data as AuditLog[]) ?? []);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    }
  }, []);

  const fetchUsers = useCallback(async (search?: string) => {
    try {
      let query = supabase
        .from("profiles")
        .select("id, nametag, display_name, avatar_url, is_verified, account_type, flagged_danger, created_at")
        .order("created_at", { ascending: false })
        .limit(40);

      if (search?.trim()) {
        query = query.or(`display_name.ilike.%${search}%,nametag.ilike.%${search}%`);
      }

      const { data: profiles, error } = await query;
      if (error) throw error;

      // Fetch roles for each user
      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roleRows } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] };

      const roleMap = new Map<string, string[]>();
      for (const r of roleRows ?? []) {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role);
        roleMap.set(r.user_id, list);
      }

      setManagedUsers(
        (profiles ?? []).map((p) => ({
          ...p,
          roles: roleMap.get(p.id) ?? ["user"],
        }))
      );
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .order("key");
      if (!error) setSettings(data ?? []);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  const fetchModPosts = useCallback(async (filter: "active" | "removed") => {
    try {
      let query = supabase
        .from("posts")
        .select("id, author_id, media_type, media_url, poster_url, caption, removed_at, removal_reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (filter === "active") query = query.is("removed_at", null);
      else query = query.not("removed_at", "is", null);
      const { data, error } = await query;
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((p) => p.author_id)));
      const { data: authors } = ids.length
        ? await supabase.from("profiles").select("id, display_name, nametag, avatar_url").in("id", ids)
        : { data: [] };
      const aMap = new Map((authors ?? []).map((a: any) => [a.id, a]));
      setModPosts((data ?? []).map((p: any) => ({ ...p, author: aMap.get(p.author_id) ?? null })));
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    }
  }, []);

  const fetchReports = useCallback(async (filter: "open" | "resolved") => {
    try {
      const statuses = filter === "open" ? ["open", "reviewing"] as const : ["actioned", "dismissed"] as const;
      const { data, error } = await supabase
        .from("content_reports")
        .select("*")
        .in("status", statuses as any)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setReports((data as ContentReport[]) ?? []);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchStats(),
        fetchAuditLogs(),
        fetchUsers(),
        fetchSettings(),
        fetchModPosts("active"),
        fetchReports("open"),
      ]);
      setLoading(false);
    };
    load();
  }, [isSuperAdmin, fetchStats, fetchAuditLogs, fetchUsers, fetchSettings, fetchModPosts, fetchReports]);

  useEffect(() => { if (isSuperAdmin) fetchModPosts(modFilter); }, [modFilter, isSuperAdmin, fetchModPosts]);
  useEffect(() => { if (isSuperAdmin) fetchReports(reportFilter); }, [reportFilter, isSuperAdmin, fetchReports]);

  /* ---- Actions ---- */

  const handleAssignRole = async (userId: string, role: "admin" | "moderator" | "super_admin" | "user") => {
    try {
      const { error } = await supabase.rpc("grant_role", { _user_id: userId, _role: role });
      if (error) throw error;
      toast.success(`Role "${role}" assigned`);
      fetchUsers(userSearch);
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to assign role");
    }
  };

  const handleRevokeRole = async (userId: string, role: "admin" | "moderator" | "super_admin" | "user") => {
    if (role === "user") return;
    try {
      const { error } = await supabase.rpc("revoke_role", { _user_id: userId, _role: role });
      if (error) throw error;
      toast.success(`Role "${role}" revoked`);
      fetchUsers(userSearch);
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to revoke role");
    }
  };

  const handleToggleFlag = async (userId: string, currentlyFlagged: boolean) => {
    try {
      const reason = currentlyFlagged
        ? null
        : window.prompt("Reason for flagging this user?") || "manual review";
      const { error } = await supabase.rpc("set_user_flag", {
        _user_id: userId,
        _flagged: !currentlyFlagged,
        _reason: reason,
      });
      if (error) throw error;
      toast.success(currentlyFlagged ? "User unflagged" : "User flagged");
      fetchUsers(userSearch);
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update flag");
    }
  };

  const handleUpdateSetting = async (settingKey: string, newValue: any) => {
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: settingKey, value: typeof newValue === "string" ? newValue : JSON.stringify(newValue) }, { onConflict: "key" });
      if (error) throw error;

      await supabase.rpc("log_admin_action", {
        _action: "update_setting",
        _entity_type: "app_setting",
        _entity_id: settingKey,
        _metadata: { new_value: newValue },
      });

      toast.success("Setting updated");
      fetchSettings();
      fetchAuditLogs();
      setSelectedSetting(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update setting");
    }
  };

  const handleRemovePost = async (postId: string) => {
    const reason = window.prompt("Reason for removing this post?", "Violates community guidelines");
    if (reason === null) return;
    try {
      const { error } = await supabase.rpc("remove_post", { _post_id: postId, _reason: reason });
      if (error) throw error;
      toast.success("Post removed");
      fetchModPosts(modFilter);
      fetchStats();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove post");
    }
  };

  const handleRestorePost = async (postId: string) => {
    try {
      const { error } = await supabase.rpc("restore_post", { _post_id: postId });
      if (error) throw error;
      toast.success("Post restored");
      fetchModPosts(modFilter);
      fetchStats();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to restore post");
    }
  };

  const handleResolveReport = async (reportId: string, removePost: boolean) => {
    const note = window.prompt(removePost ? "Resolution note (will also remove the post):" : "Resolution note:", "");
    if (note === null) return;
    try {
      const { error } = await supabase.rpc("resolve_report", {
        _report_id: reportId,
        _note: note || null,
        _remove_post: removePost,
      });
      if (error) throw error;
      toast.success("Report resolved");
      fetchReports(reportFilter);
      fetchModPosts(modFilter);
      fetchStats();
      fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to resolve report");
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredAudit = auditLogs.filter(
    (l) =>
      l.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entity_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.actor_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                <h1 className="text-xl font-bold text-foreground">Super Admin</h1>
              </div>
              <p className="text-xs text-muted-foreground">Full system control</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Tab nav */}
        <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={Users} label="Total Users" value={stats?.total_users ?? 0} color="blue" />
                  <StatCard icon={Activity} label="Total Posts" value={stats?.total_posts ?? 0} color="green" />
                  <StatCard icon={Flag} label="Open Reports" value={stats?.open_reports ?? 0} color="red" />
                  <StatCard icon={CheckCircle} label="Verified Businesses" value={stats?.verified_businesses ?? 0} color="green" />
                  <StatCard icon={Trash2} label="Removed Posts" value={stats?.removed_posts ?? 0} color="orange" />
                  <StatCard icon={Clock} label="Pending Verifications" value={stats?.pending_verifications ?? 0} color="yellow" />
                  <StatCard icon={MessageSquare} label="Total Messages" value={stats?.total_messages ?? 0} color="blue" />
                  <StatCard icon={BarChart3} label="Active Convos" value={stats?.active_conversations ?? 0} color="green" />
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Content Health</h3>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Reports</span>
                      <span className="font-semibold">{stats?.total_reports ?? 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolution Rate</span>
                      <span className="font-semibold">
                        {stats && stats.total_reports > 0
                          ? Math.round(
                              ((stats.total_reports - stats.open_reports) / stats.total_reports) * 100
                            )
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── MODERATION ── */}
            {activeTab === "moderation" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    {(["active", "removed"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setModFilter(f)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                          modFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => fetchModPosts(modFilter)}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {modPosts.map((p) => (
                    <ModPostCard
                      key={p.id}
                      post={p}
                      onRemove={() => handleRemovePost(p.id)}
                      onRestore={() => handleRestorePost(p.id)}
                      onView={() => navigate(`/post/${p.id}`)}
                    />
                  ))}
                  {modPosts.length === 0 && (
                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No posts</p>
                  )}
                </div>
              </div>
            )}

            {/* ── REPORTS ── */}
            {activeTab === "reports" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    {(["open", "resolved"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setReportFilter(f)}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-semibold capitalize",
                          reportFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => fetchReports(reportFilter)}
                    className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {reports.map((r) => (
                    <div key={r.id} className="rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                              {r.reason}
                            </span>
                            <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                          </div>
                          {r.details && <p className="mt-2 text-sm text-foreground">{r.details}</p>}
                          {r.resolution_note && (
                            <p className="mt-1 text-xs text-muted-foreground">Resolution: {r.resolution_note}</p>
                          )}
                          {r.post_id && (
                            <button
                              onClick={() => navigate(`/post/${r.post_id}`)}
                              className="mt-2 text-xs text-primary hover:underline"
                            >
                              View reported post →
                            </button>
                          )}
                        </div>
                        {reportFilter === "open" && (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleResolveReport(r.id, true)}
                              className="rounded-full bg-destructive px-3 py-1 text-[10px] font-semibold text-destructive-foreground hover:opacity-90"
                            >
                              Remove & resolve
                            </button>
                            <button
                              onClick={() => handleResolveReport(r.id, false)}
                              className="rounded-full border border-border px-3 py-1 text-[10px] font-semibold text-foreground hover:bg-accent"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {reports.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No reports</p>
                  )}
                </div>
              </div>
            )}

            {/* ── USER MANAGEMENT ── */}
            {activeTab === "users" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search users by name or @nametag"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchUsers(userSearch)}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button
                    onClick={() => fetchUsers(userSearch)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {managedUsers.map((u) => (
                    <UserManagementRow
                      key={u.id}
                      user={u}
                      currentUserId={user?.id ?? ""}
                      onAssignRole={handleAssignRole}
                      onRevokeRole={handleRevokeRole}
                      onToggleFlag={handleToggleFlag}
                    />
                  ))}
                  {managedUsers.length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No users found</p>
                  )}
                </div>
              </div>
            )}

            {/* ── AUDIT LOGS ── */}
            {activeTab === "audit" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Filter by action or entity type..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <button onClick={fetchAuditLogs} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {filteredAudit.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No audit logs found</p>
                    </div>
                  ) : (
                    filteredAudit.map((log) => (
                      <div key={log.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono font-semibold text-primary">
                                {log.action}
                              </span>
                              {log.entity_type && (
                                <span className="text-xs text-muted-foreground">
                                  on <span className="font-medium text-foreground">{log.entity_type}</span>
                                </span>
                              )}
                            </div>
                            {log.actor_email && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                by {log.actor_email}
                              </p>
                            )}
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <pre className="mt-2 max-h-20 overflow-auto rounded bg-muted p-2 text-[10px] text-muted-foreground">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {timeAgo(log.created_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── FLAGS ── */}
            {activeTab === "flags" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    Flagged users ({managedUsers.filter((u) => u.flagged_danger).length})
                  </p>
                  <button
                    onClick={() => navigate("/access/reports")}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
                  >
                    Open reports queue
                  </button>
                </div>
                {managedUsers.filter((u) => u.flagged_danger).length === 0 ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                    <p className="text-sm text-muted-foreground">No flagged users in current page.</p>
                  </div>
                ) : (
                  managedUsers
                    .filter((u) => u.flagged_danger)
                    .map((u) => (
                      <UserManagementRow
                        key={u.id}
                        user={u}
                        currentUserId={user?.id ?? ""}
                        onAssignRole={handleAssignRole}
                        onRevokeRole={handleRevokeRole}
                        onToggleFlag={handleToggleFlag}
                      />
                    ))
                )}
              </div>
            )}

            {/* ── RESOURCES ── */}
            {activeTab === "resources" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    External product links shown to verified businesses on their dashboard.
                  </p>
                  <button
                    onClick={() =>
                      setEditingResource({
                        title: "",
                        url: "",
                        description: "",
                        category: "",
                        icon: "",
                        sort_order: 0,
                        is_active: true,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add resource
                  </button>
                </div>

                {resources.length === 0 ? (
                  <div className="py-12 text-center">
                    <LinkIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No resources yet</p>
                  </div>
                ) : (
                  resources.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-semibold text-foreground">{r.title}</h3>
                            {!r.is_active && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                hidden
                              </span>
                            )}
                            {r.category && (
                              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-foreground">
                                {r.category}
                              </span>
                            )}
                          </div>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 block truncate text-xs text-primary hover:underline"
                          >
                            {r.url}
                          </a>
                          {r.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => setEditingResource(r)}
                            className="rounded-full p-1.5 hover:bg-accent"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => deleteResource(r.id)}
                            className="rounded-full p-1.5 hover:bg-accent"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {editingResource && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
                      <h2 className="mb-3 text-base font-bold text-foreground">
                        {editingResource.id ? "Edit resource" : "New resource"}
                      </h2>
                      <div className="space-y-2">
                        <input
                          placeholder="Title *"
                          value={editingResource.title ?? ""}
                          onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                        />
                        <input
                          placeholder="URL * (https://...)"
                          value={editingResource.url ?? ""}
                          onChange={(e) => setEditingResource({ ...editingResource, url: e.target.value })}
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                        />
                        <textarea
                          placeholder="Description"
                          value={editingResource.description ?? ""}
                          onChange={(e) =>
                            setEditingResource({ ...editingResource, description: e.target.value })
                          }
                          className="h-20 w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                        />
                        <div className="flex gap-2">
                          <input
                            placeholder="Category"
                            value={editingResource.category ?? ""}
                            onChange={(e) =>
                              setEditingResource({ ...editingResource, category: e.target.value })
                            }
                            className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Sort"
                            value={editingResource.sort_order ?? 0}
                            onChange={(e) =>
                              setEditingResource({ ...editingResource, sort_order: e.target.value })
                            }
                            className="w-20 rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={editingResource.is_active !== false}
                            onChange={(e) =>
                              setEditingResource({ ...editingResource, is_active: e.target.checked })
                            }
                          />
                          Active (visible to verified businesses)
                        </label>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          disabled={resourceBusy}
                          onClick={() => saveResource(editingResource)}
                          className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          {resourceBusy ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingResource(null)}
                          className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SETTINGS ── */}
            {activeTab === "settings" && (
              <div className="space-y-4">
                {settings.length === 0 ? (
                  <div className="py-12 text-center">
                    <Settings className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No settings available</p>
                  </div>
                ) : (
                  settings.map((s) => (
                    <div
                      key={s.key}
                      onClick={() => { setSelectedSetting(s); setSettingValue(s.value ?? ""); }}
                      className="cursor-pointer rounded-lg border border-border bg-card p-4 hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <h3 className="font-mono text-sm font-semibold text-foreground">{s.key}</h3>
                          <p className="mt-1 rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground inline-block">
                            {s.value}
                          </p>
                        </div>
                        <Settings className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </div>
                  ))
                )}

                {/* Editor modal */}
                {selectedSetting && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
                      <h2 className="text-base font-bold text-foreground">
                        Edit: <span className="font-mono">{selectedSetting.key}</span>
                      </h2>
                      <textarea
                        value={settingValue}
                        onChange={(e) => setSettingValue(e.target.value)}
                        className="mt-3 h-40 w-full rounded-lg border border-border bg-muted p-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleUpdateSetting(selectedSetting.key, settingValue)}
                          className="flex-1 rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setSelectedSetting(null)}
                          className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground hover:bg-accent"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                       */
/* ------------------------------------------------------------------ */

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    yellow: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
        </div>
        <div className={cn("rounded-lg p-2.5", colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function UserManagementRow({
  user,
  currentUserId,
  onAssignRole,
  onRevokeRole,
  onToggleFlag,
}: {
  user: ManagedUser;
  currentUserId: string;
  onAssignRole: (id: string, role: string) => void;
  onRevokeRole: (id: string, role: string) => void;
  onToggleFlag: (id: string, currentlyFlagged: boolean) => void;
}) {
  const isSelf = user.id === currentUserId;
  const hasAdmin = user.roles.includes("admin") || user.roles.includes("super_admin");
  const hasMod = user.roles.includes("moderator");

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4",
      user.flagged_danger && "border-destructive/40 bg-destructive/5"
    )}>
      <div className="flex items-center gap-3">
        <img
          src={
            user.avatar_url ??
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.display_name)}`
          }
          alt=""
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold text-foreground">{user.display_name}</p>
            {user.is_verified && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
            {user.flagged_danger && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          </div>
          <p className="text-xs text-muted-foreground">@{user.nametag}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <span
                key={r}
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  r === "super_admin"
                    ? "bg-amber-100 text-amber-700"
                    : r === "admin"
                      ? "bg-primary/10 text-primary"
                      : r === "moderator"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-muted text-muted-foreground"
                )}
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        {!isSelf && (
          <div className="flex flex-col gap-1">
            {!hasAdmin && (
              <button
                onClick={() => onAssignRole(user.id, "admin")}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20"
              >
                <ShieldCheck className="h-3 w-3" /> +Admin
              </button>
            )}
            {hasAdmin && !user.roles.includes("super_admin") && (
              <button
                onClick={() => onRevokeRole(user.id, "admin")}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/20"
              >
                <ShieldOff className="h-3 w-3" /> −Admin
              </button>
            )}
            {!hasMod && !hasAdmin && (
              <button
                onClick={() => onAssignRole(user.id, "moderator")}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-200"
              >
                <Shield className="h-3 w-3" /> +Mod
              </button>
            )}
            {hasMod && !hasAdmin && (
              <button
                onClick={() => onRevokeRole(user.id, "moderator")}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/20"
              >
                <ShieldOff className="h-3 w-3" /> −Mod
              </button>
            )}
            <button
              onClick={() => onToggleFlag(user.id, user.flagged_danger)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                user.flagged_danger
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              {user.flagged_danger ? "Unflag" : "Flag"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



function ModPostCard({
  post,
  onRemove,
  onRestore,
  onView,
}: {
  post: ModPost;
  onRemove: () => void;
  onRestore: () => void;
  onView: () => void;
}) {
  const isRemoved = !!post.removed_at;
  const isVideo = post.media_type === "video";
  const isImage = post.media_type === "image";
  const thumb = post.poster_url ?? (isImage ? post.media_url : null);

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border border-border bg-card",
      isRemoved && "opacity-60"
    )}>
      <div className="relative aspect-video bg-muted">
        {isVideo && post.media_url ? (
          <video
            src={post.media_url}
            poster={post.poster_url ?? undefined}
            controls
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : thumb ? (
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Text post
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {isVideo ? <Video className="h-3 w-3" /> : isImage ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          {post.media_type}
        </span>
        {isRemoved && (
          <span className="absolute right-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
            Removed
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <img
            src={
              post.author?.avatar_url ??
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(post.author?.display_name ?? "U")}`
            }
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {post.author?.display_name ?? "Unknown"}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              @{post.author?.nametag ?? "?"} · {timeAgo(post.created_at)}
            </p>
          </div>
        </div>
        {post.caption && (
          <p className="mt-2 line-clamp-2 text-xs text-foreground">{post.caption}</p>
        )}
        {post.removal_reason && (
          <p className="mt-1 text-[10px] text-destructive">Reason: {post.removal_reason}</p>
        )}
        <div className="mt-3 flex gap-1.5">
          <button
            onClick={onView}
            className="flex-1 rounded-full border border-border py-1.5 text-[11px] font-semibold text-foreground hover:bg-accent"
          >
            View
          </button>
          {isRemoved ? (
            <button
              onClick={onRestore}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              <RotateCcw className="h-3 w-3" /> Restore
            </button>
          ) : (
            <button
              onClick={onRemove}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-destructive py-1.5 text-[11px] font-semibold text-destructive-foreground hover:opacity-90"
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
