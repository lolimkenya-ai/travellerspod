import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Ban,
  CheckCircle,
  Flag,
  Loader2,
  MessageSquare,
  Search,
  Trash2,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ModerationReport {
  report_id: string;
  status: string;
  reason: string;
  created_at: string;
  post_id: string;
  caption: string;
  media_type: string;
  post_created_at: string;
  post_removed_at: string | null;
  author_id: string;
  author_nametag: string;
  author_display_name: string;
  author_avatar: string | null;
  author_verified: boolean;
  total_reports_for_post: number;
  reporter_nametag: string;
}

export default function ModeratorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isModerator, loading: rolesLoading } = useRoles();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Redirect if not moderator
  useEffect(() => {
    if (!rolesLoading && !isModerator) {
      navigate("/");
    }
  }, [isModerator, rolesLoading, navigate]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_moderation_queue", {
        _status: filterStatus || null,
        _limit: 100,
        _offset: 0,
      });

      if (error) throw error;
      setReports((data as ModerationReport[]) || []);
    } catch (err) {
      console.error("Failed to fetch reports:", err);
      toast.error("Failed to load moderation queue");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleTakedown = async (postId: string, reason: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("takedown_post", {
        _post_id: postId,
        _reason: reason,
      });

      if (error) throw error;

      // Log moderation action
      await supabase.from("moderation_actions").insert({
        moderator_id: user?.id,
        action_type: "takedown",
        target_type: "post",
        target_id: postId,
        reason,
      });

      toast.success("Post removed successfully");
      fetchReports();
      setSelectedReport(null);
    } catch (err) {
      console.error("Failed to takedown post:", err);
      toast.error("Failed to remove post");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (postId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("restore_post", {
        _post_id: postId,
      });

      if (error) throw error;

      // Log moderation action
      await supabase.from("moderation_actions").insert({
        moderator_id: user?.id,
        action_type: "restore",
        target_type: "post",
        target_id: postId,
        reason: "Post restored by moderator",
      });

      toast.success("Post restored successfully");
      fetchReports();
      setSelectedReport(null);
    } catch (err) {
      console.error("Failed to restore post:", err);
      toast.error("Failed to restore post");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("content_reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);

      if (error) throw error;

      toast.success("Report dismissed");
      fetchReports();
      setSelectedReport(null);
    } catch (err) {
      console.error("Failed to dismiss report:", err);
      toast.error("Failed to dismiss report");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("content_reports")
        .update({ status })
        .eq("id", reportId);

      if (error) throw error;

      toast.success(`Report status updated to ${status}`);
      fetchReports();
    } catch (err) {
      console.error("Failed to update report status:", err);
      toast.error("Failed to update report status");
    }
  };

  const filteredReports = reports.filter((report) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      report.caption?.toLowerCase().includes(searchLower) ||
      report.author_display_name?.toLowerCase().includes(searchLower) ||
      report.reason?.toLowerCase().includes(searchLower)
    );
  });

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
          <h1 className="text-2xl font-bold text-foreground">Moderation Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and manage reported content
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              {["open", "reviewing", "dismissed", "actioned"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-colors",
                    filterStatus === status
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  )}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
              <p className="text-muted-foreground mt-2">No {filterStatus} reports at this time.</p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.report_id}
                className="border border-border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {report.reason}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-semibold",
                      report.status === "open" && "bg-red-100 text-red-800",
                      report.status === "reviewing" && "bg-yellow-100 text-yellow-800",
                      report.status === "dismissed" && "bg-gray-100 text-gray-800",
                      report.status === "actioned" && "bg-green-100 text-green-800"
                    )}
                  >
                    {report.status}
                  </span>
                </div>

                <p className="text-sm text-foreground line-clamp-2 mb-3">{report.caption}</p>

                <div className="flex items-center gap-2 mb-3">
                  <img
                    src={
                      report.author_avatar ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${report.author_display_name}`
                    }
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {report.author_display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {report.total_reports_for_post} reports
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {new Date(report.created_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="bg-background w-full md:w-96 rounded-t-lg md:rounded-lg border border-border p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground">Report Details</h2>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Post Content */}
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold text-foreground mb-2">Post Content:</p>
                <p className="text-sm text-foreground mb-3">{selectedReport.caption}</p>
                <div className="flex items-center gap-2">
                  <img
                    src={
                      selectedReport.author_avatar ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${selectedReport.author_display_name}`
                    }
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedReport.author_display_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      @{selectedReport.author_nametag}
                    </p>
                  </div>
                </div>
              </div>

              {/* Report Info */}
              <div className="mb-6 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Reason:</p>
                  <p className="text-sm text-foreground capitalize">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Status:</p>
                  <p className="text-sm text-foreground capitalize">{selectedReport.status}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Total Reports:</p>
                  <p className="text-sm text-foreground">{selectedReport.total_reports_for_post}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Reported By:</p>
                  <p className="text-sm text-foreground">@{selectedReport.reporter_nametag}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {!selectedReport.post_removed_at ? (
                  <>
                    <button
                      onClick={() => handleTakedown(selectedReport.post_id, selectedReport.reason)}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove Post
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleRestore(selectedReport.post_id)}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Restore Post
                  </button>
                )}

                <button
                  onClick={() => handleDismissReport(selectedReport.report_id)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-accent disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Dismiss Report
                </button>

                <select
                  value={selectedReport.status}
                  onChange={(e) => handleUpdateReportStatus(selectedReport.report_id, e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
                >
                  <option value="open">Open</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="actioned">Actioned</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
