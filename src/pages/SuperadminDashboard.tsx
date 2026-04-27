import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Ban,
  Flag,
  Loader2,
  Settings,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface UserFlag {
  id: string;
  user_id: string;
  reason: string;
  flag_type: string;
  flagged_by: string;
  resolved: boolean;
  created_at: string;
}

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: Record<string, any>;
  description: string;
  updated_at: string;
}

export default function SuperadminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [userFlags, setUserFlags] = useState<UserFlag[]>([]);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "flags" | "settings">("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetting, setSelectedSetting] = useState<SystemSetting | null>(null);
  const [settingValue, setSettingValue] = useState("");

  // Redirect if not superadmin
  useEffect(() => {
    if (!rolesLoading && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, rolesLoading, navigate]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_system_statistics");

      if (error) throw error;
      setStats((data as SystemStats[])?.[0] || null);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      toast.error("Failed to load system statistics");
    }
  }, []);

  const fetchUserFlags = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("user_flags")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setUserFlags((data as UserFlag[]) || []);
    } catch (err) {
      console.error("Failed to fetch user flags:", err);
      toast.error("Failed to load user flags");
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .order("setting_key");

      if (error) throw error;
      setSettings((data as SystemSetting[]) || []);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
      toast.error("Failed to load system settings");
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUserFlags(), fetchSettings()]);
      setLoading(false);
    };
    loadData();
  }, [fetchStats, fetchUserFlags, fetchSettings]);

  const handleUpdateSetting = async (settingKey: string, newValue: any) => {
    try {
      const { error } = await supabase
        .from("system_settings")
        .update({
          setting_value: newValue,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", settingKey);

      if (error) throw error;

      // Log audit action
      await supabase.from("audit_logs").insert({
        actor_id: user?.id,
        action_type: "update_setting",
        target_type: "system_setting",
        target_id: settingKey,
        changes: { setting_key: settingKey, new_value: newValue },
      });

      toast.success("Setting updated successfully");
      fetchSettings();
      setSelectedSetting(null);
    } catch (err) {
      console.error("Failed to update setting:", err);
      toast.error("Failed to update setting");
    }
  };

  const handleResolveFlag = async (flagId: string) => {
    try {
      const { error } = await supabase
        .from("user_flags")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq("id", flagId);

      if (error) throw error;

      toast.success("Flag resolved");
      fetchUserFlags();
    } catch (err) {
      console.error("Failed to resolve flag:", err);
      toast.error("Failed to resolve flag");
    }
  };

  const filteredFlags = userFlags.filter((flag) =>
    flag.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flag.flag_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Superadmin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            System management and platform administration
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-border">
          {["overview", "flags", "settings"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={cn(
                "px-4 py-2 font-medium border-b-2 transition-colors",
                activeTab === tab
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeTab === "overview" ? (
          // Overview Tab
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={Users}
                label="Total Users"
                value={stats?.total_users || 0}
                color="blue"
              />
              <StatCard
                icon={Activity}
                label="Total Posts"
                value={stats?.total_posts || 0}
                color="green"
              />
              <StatCard
                icon={Flag}
                label="Open Reports"
                value={stats?.open_reports || 0}
                color="red"
              />
              <StatCard
                icon={Trash2}
                label="Removed Posts"
                value={stats?.removed_posts || 0}
                color="orange"
              />
              <StatCard
                icon={CheckCircle}
                label="Verified Businesses"
                value={stats?.verified_businesses || 0}
                color="green"
              />
              <StatCard
                icon={Clock}
                label="Pending Verifications"
                value={stats?.pending_verifications || 0}
                color="yellow"
              />
            </div>

            {/* Additional Metrics */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-border rounded-lg p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Messaging Activity</h3>
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Messages</span>
                    <span className="font-semibold text-foreground">{stats?.total_messages || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Active Conversations</span>
                    <span className="font-semibold text-foreground">
                      {stats?.active_conversations || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-lg p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Content Health</h3>
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Reports</span>
                    <span className="font-semibold text-foreground">{stats?.total_reports || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Resolution Rate</span>
                    <span className="font-semibold text-foreground">
                      {stats && stats.total_reports > 0
                        ? Math.round(((stats.total_reports - stats.open_reports) / stats.total_reports) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "flags" ? (
          // Flags Tab
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search flags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              {filteredFlags.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No user flags found</p>
                </div>
              ) : (
                filteredFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className="border border-border rounded-lg p-4 bg-card flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Flag className="h-4 w-4 text-red-500" />
                        <span className="font-semibold text-foreground">{flag.flag_type}</span>
                        {flag.resolved && (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{flag.reason}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(flag.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {!flag.resolved && (
                      <button
                        onClick={() => handleResolveFlag(flag.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          // Settings Tab
          <div className="space-y-4">
            <div className="grid gap-4">
              {settings.length === 0 ? (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No settings available</p>
                </div>
              ) : (
                settings.map((setting) => (
                  <div
                    key={setting.id}
                    className="border border-border rounded-lg p-4 bg-card cursor-pointer hover:bg-accent/50"
                    onClick={() => {
                      setSelectedSetting(setting);
                      setSettingValue(JSON.stringify(setting.setting_value, null, 2));
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{setting.setting_key}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{setting.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          Last updated: {new Date(setting.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Settings className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Setting Editor Modal */}
            {selectedSetting && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-lg font-bold text-foreground mb-4">
                    Edit: {selectedSetting.setting_key}
                  </h2>

                  <textarea
                    value={settingValue}
                    onChange={(e) => setSettingValue(e.target.value)}
                    className="w-full h-40 p-3 border border-border rounded-lg bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        handleUpdateSetting(selectedSetting.setting_key, JSON.parse(settingValue));
                      }}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setSelectedSetting(null)}
                      className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    red: "bg-red-100 text-red-600",
    orange: "bg-orange-100 text-orange-600",
    yellow: "bg-yellow-100 text-yellow-600",
  };

  return (
    <div className="border border-border rounded-lg p-6 bg-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-2">{value.toLocaleString()}</p>
        </div>
        <div className={cn("p-3 rounded-lg", colorClasses[color as keyof typeof colorClasses])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

// Icon placeholder for Trash2
function Trash2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  );
}

// Icon placeholder for MessageSquare
function MessageSquare(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}
