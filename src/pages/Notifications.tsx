import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Repeat2, UserPlus, Mail, Loader2, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";

type NotifType = "like" | "comment" | "follow" | "repost" | "inquiry";

interface Row {
  id: string;
  type: NotifType;
  actor_id: string | null;
  post_id: string | null;
  conversation_id: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
  actor: {
    nametag: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  post: { poster_url: string | null; media_url: string | null; media_type: string } | null;
}

const ICON_FOR: Record<NotifType, React.ReactNode> = {
  like: <Heart className="h-3.5 w-3.5 fill-current" />,
  comment: <MessageCircle className="h-3.5 w-3.5" />,
  follow: <UserPlus className="h-3.5 w-3.5" />,
  repost: <Repeat2 className="h-3.5 w-3.5" />,
  inquiry: <Mail className="h-3.5 w-3.5" />,
};

const COLOR_FOR: Record<NotifType, string> = {
  like: "text-primary bg-primary/15",
  comment: "text-foreground bg-muted",
  follow: "text-secondary bg-secondary/15",
  repost: "text-foreground bg-muted",
  inquiry: "text-verified-foreground bg-verified/20",
};

const TEXT_FOR: Record<NotifType, string> = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
  repost: "reposted your post",
  inquiry: "sent you a message",
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("notifications")
      .select(
        `id, type, actor_id, post_id, conversation_id, body, read, created_at,
         actor:profiles!notifications_actor_id_fkey ( nametag, display_name, avatar_url ),
         post:posts!notifications_post_id_fkey ( poster_url, media_url, media_type )`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      // Fallback if FK aliases don't resolve — fetch and hydrate manually.
      const { data: bare } = await supabase
        .from("notifications")
        .select("id, type, actor_id, post_id, conversation_id, body, read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const list = (bare ?? []) as any[];
      const actorIds = Array.from(new Set(list.map((r) => r.actor_id).filter(Boolean)));
      const postIds = Array.from(new Set(list.map((r) => r.post_id).filter(Boolean)));
      const [{ data: actors }, { data: posts }] = await Promise.all([
        actorIds.length
          ? supabase.from("profiles").select("id, nametag, display_name, avatar_url").in("id", actorIds)
          : Promise.resolve({ data: [] as any[] }),
        postIds.length
          ? supabase.from("posts").select("id, poster_url, media_url, media_type").in("id", postIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const aMap = new Map((actors ?? []).map((a: any) => [a.id, a]));
      const pMap = new Map((posts ?? []).map((p: any) => [p.id, p]));
      setRows(
        list.map((r) => ({
          ...r,
          actor: aMap.get(r.actor_id) ?? null,
          post: pMap.get(r.post_id) ?? null,
        })),
      );
    } else {
      setRows((data as unknown as Row[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAll();
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        fetchAll,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, fetchAll]);

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    if (error) toast.error(error.message);
    else toast.success("All caught up");
  };

  const markOneRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const linkFor = (n: Row) => {
    if (n.type === "follow" && n.actor) return `/profile/${n.actor.nametag}`;
    if (n.type === "inquiry" && n.conversation_id) return `/messages/${n.conversation_id}`;
    if (n.post_id) return `/`; // post detail not implemented; back to feed
    return "#";
  };

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-base font-semibold text-foreground">Notifications</h1>
        </div>
        {rows.some((r) => !r.read) && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-accent"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </header>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
          <h2 className="text-base font-semibold text-foreground">No notifications yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Likes, comments, and follows will show up here.
          </p>
        </div>
      )}

      <div>
        {rows.map((n) => {
          const actorTag = n.actor?.nametag ?? "user";
          const actorName = n.actor?.display_name ?? "Someone";
          const avatar =
            n.actor?.avatar_url ??
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(actorName)}`;
          const cover = n.post?.poster_url ?? n.post?.media_url ?? null;
          return (
            <Link
              key={n.id}
              to={linkFor(n)}
              onClick={() => !n.read && markOneRead(n.id)}
              className={`flex items-center gap-3 border-b border-border/50 px-4 py-3 hover:bg-accent ${
                n.read ? "" : "bg-primary/5"
              }`}
            >
              <div className="relative">
                <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                <span
                  className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background ${
                    COLOR_FOR[n.type]
                  }`}
                >
                  {ICON_FOR[n.type]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">@{actorTag}</span>{" "}
                  <span className="text-muted-foreground">{TEXT_FOR[n.type]}</span>
                </p>
                {n.body && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.body}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
              </div>
              {cover && (
                <img
                  src={cover}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              {!n.read && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
