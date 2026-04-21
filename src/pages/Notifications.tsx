import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, MessageCircle, Repeat2, UserPlus, Mail } from "lucide-react";
import { NOTIFICATIONS } from "@/data/notifications";
import { getUser } from "@/data/users";
import { getPost } from "@/data/posts";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/data/types";

const ICONS: Record<Notification["type"], { icon: React.ReactNode; color: string }> = {
  like: { icon: <Heart className="h-4 w-4 fill-current" />, color: "text-primary" },
  comment: { icon: <MessageCircle className="h-4 w-4" />, color: "text-foreground" },
  follow: { icon: <UserPlus className="h-4 w-4" />, color: "text-secondary" },
  repost: { icon: <Repeat2 className="h-4 w-4" />, color: "text-foreground" },
  inquiry: { icon: <Mail className="h-4 w-4" />, color: "text-verified" },
};

const ACTION_TEXT: Record<Notification["type"], string> = {
  like: "liked your post",
  comment: "commented on your post",
  follow: "started following you",
  repost: "reposted your post",
  inquiry: "sent you an inquiry",
};

export default function Notifications() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Notifications</h1>
      </header>
      <div>
        {NOTIFICATIONS.map((n) => {
          const actor = getUser(n.actorId);
          const post = n.postId ? getPost(n.postId) : null;
          const meta = ICONS[n.type];
          return (
            <div key={n.id} className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
              <div className="relative">
                <img src={actor.avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-card ${meta.color}`}>
                  {meta.icon}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">@{actor.nametag}</span>{" "}
                  <span className="text-muted-foreground">{ACTION_TEXT[n.type]}</span>
                </p>
                {n.body && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
              </div>
              {post && post.media.type !== "text" && (
                <img
                  src={post.media.type === "image" ? post.media.src : post.media.poster}
                  alt=""
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
