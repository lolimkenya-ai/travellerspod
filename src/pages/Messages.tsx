import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Mail, Loader2, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/format";

interface ConvRow {
  id: string;
  is_inquiry: boolean;
  last_message: string | null;
  last_message_at: string;
  my_last_read: string;
  other: {
    id: string;
    nametag: string;
    display_name: string;
    avatar_url: string | null;
    verified: boolean;
  } | null;
}

export default function Messages() {
  const navigate = useNavigate();
  const { user, promptSignUp } = useAuth();
  const [rows, setRows] = useState<ConvRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    // Get every conversation the user participates in.
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const myReadByConv = new Map((parts ?? []).map((p) => [p.conversation_id, p.last_read_at]));

    const { data: convs } = await supabase
      .from("conversations")
      .select("id, is_inquiry, last_message, last_message_at")
      .in("id", ids)
      .order("last_message_at", { ascending: false });

    // Resolve "the other" participant for each conversation.
    const { data: others } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id")
      .in("conversation_id", ids)
      .neq("user_id", user.id);

    const otherIdByConv = new Map<string, string>();
    for (const r of others ?? []) {
      // pick first other if there are several (group chats not modeled in UI yet)
      if (!otherIdByConv.has(r.conversation_id)) otherIdByConv.set(r.conversation_id, r.user_id);
    }
    const otherIds = Array.from(new Set(otherIdByConv.values()));
    const { data: profs } = otherIds.length
      ? await supabase
          .from("profiles")
          .select("id, nametag, display_name, avatar_url, verified")
          .in("id", otherIds)
      : { data: [] as any[] };
    const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));

    const out: ConvRow[] = (convs ?? []).map((c) => {
      const otherId = otherIdByConv.get(c.id);
      return {
        id: c.id,
        is_inquiry: c.is_inquiry,
        last_message: c.last_message,
        last_message_at: c.last_message_at,
        my_last_read: myReadByConv.get(c.id) ?? c.last_message_at,
        other: otherId ? (profById.get(otherId) ?? null) : null,
      };
    });
    setRows(out);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    refresh();
    const ch = supabase
      .channel(`msgs-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  if (!user) {
    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center bg-background px-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Sign in to use messages</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Talk to creators and book directly with verified businesses.
        </p>
        <button
          onClick={promptSignUp}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign up free
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Messages</h1>
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
          <MessageSquarePlus className="mb-2 h-7 w-7 text-muted-foreground" />
          <h2 className="text-base font-semibold text-foreground">No conversations yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap "Inquire Now" or "Message" on a profile to start a chat.
          </p>
        </div>
      )}

      <div>
        {rows.map((c) => {
          const unread = new Date(c.last_message_at) > new Date(c.my_last_read) && !!c.last_message;
          const otherName = c.other?.display_name ?? "Unknown";
          const avatar =
            c.other?.avatar_url ??
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(otherName)}`;
          return (
            <Link
              key={c.id}
              to={`/messages/${c.id}`}
              className="flex items-center gap-3 border-b border-border/50 px-4 py-3 hover:bg-accent"
            >
              <img src={avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-sm font-semibold text-foreground">{otherName}</p>
                  {c.other?.verified && (
                    <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />
                  )}
                  {c.is_inquiry && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Mail className="h-2.5 w-2.5" /> Inquiry
                    </span>
                  )}
                </div>
                <p
                  className={`mt-0.5 line-clamp-1 text-xs ${
                    unread ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {c.last_message ?? "Say hi 👋"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                {unread && <span className="h-2 w-2 rounded-full bg-primary" />}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
