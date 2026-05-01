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
  MessageSquare,
  Crown,
  Shield,
  ShieldCheck,
  ShieldOff,
  FileText,
  RefreshCw,
  ArrowLeft,
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

const TABS = ["overview", "users", "audit", "flags", "settings"] as const;
type Tab = typeof TABS[number];

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

  useEffect(() => {
    if (!isSuperAdmin) return;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchAuditLogs(), fetchUsers(), fetchSettings()]);
      setLoading(false);
    };
    load();
  }, [isSuperAdmin, fetchStats, fetchAuditLogs, fetchUsers, fetchSettings]);

  /* ---- Actions ---- */

  const handleAssignRole = async (userId: string, role: "admin" | "moderator" | "super_admin" | "user") => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (error) throw error;

      // Audit log
      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        action: `assign_role:${role}`,
        entity_type: "user",
        entity_id: userId,
      });

      toast.success(`Role "${role}" assigned`);
      fetchUsers(userSearch);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to assign role");
    }
  };

  const handleRevokeRole = async (userId: string, role: "admin" | "moderator" | "super_admin" | "user") => {
    if (role === "user") return; // can't revoke base user role
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        action: `revoke_role:${role}`,
        entity_type: "user",
        entity_id: userId,
      });

      toast.success(`Role "${role}" revoked`);
      fetchUsers(userSearch);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to revoke role");
    }
  };

  const handleUpdateSetting = async (settingKey: string, newValue: any) => {
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: settingKey, value: typeof newValue === "string" ? newValue : JSON.stringify(newValue) }, { onConflict: "key" });
      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        action: "update_setting",
        entity_type: "app_setting",
        entity_id: settingKey,
        metadata: { new_value: newValue },
      });

      toast.success("Setting updated");
      fetchSettings();
      setSelectedSetting(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update setting");
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
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4 text-center">
                  <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-500" />
                  <p className="text-sm text-foreground font-semibold">User Flags</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Flag management is available in the Reports queue.
                  </p>
                  <button
                    onClick={() => navigate("/access/reports")}
                    className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    Go to Reports
                  </button>
                </div>
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
}: {
  user: ManagedUser;
  currentUserId: string;
  onAssignRole: (id: string, role: string) => void;
  onRevokeRole: (id: string, role: string) => void;
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
          </div>
        )}
      </div>
    </div>
  );
}


