import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Heart, MessageCircle, Send, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRequireAuth } from "@/contexts/AuthContext";
import { rateLimit, clientCooldown } from "@/lib/rateLimit";
import { formatCount, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Post } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: Post;
}

interface DbComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  likes_count: number;
  parent_id: string | null;
  author: {
    nametag: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export function CommentSheet({ open, onOpenChange, post }: Props) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const [comments, setComments] = useState<DbComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("post_comments")
      .select(
        `id, post_id, author_id, body, created_at, likes_count, parent_id,
         author:profiles!post_comments_author_id_fkey ( nametag, display_name, avatar_url )`,
      )
      .eq("post_id", post.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setComments((data ?? []) as unknown as DbComment[]);
    setLoading(false);
  }, [post.id]);

  // Load comments + subscribe to realtime updates while open.
  useEffect(() => {
    if (!open) return;
    refresh();
    const ch = supabase
      .channel(`comments:${post.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [open, post.id, refresh]);

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    requireAuth(async () => {
      if (!user) return;
      if (!clientCooldown(`comment-${post.id}`, 600)) return;
      setPosting(true);
      const ok = await rateLimit("comment", 20, 60);
      if (!ok) {
        setPosting(false);
        return;
      }
      const { error } = await supabase.from("post_comments").insert({
        post_id: post.id,
        author_id: user.id,
        body,
      });
      setPosting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setDraft("");
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-base">{formatCount(comments.length)} comments</SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(85vh-58px-72px)] flex-col overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && comments.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              No comments yet — be the first.
            </div>
          )}
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 800))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={user ? "Add a comment..." : "Sign in to comment"}
              className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={submit}
              disabled={!draft.trim() || posting}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Post comment"
            >
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CommentRow({ comment }: { comment: DbComment }) {
  const { user, promptSignUp } = useAuth();
  const [liked, setLiked] = useState(false);

  // Optimistic only — comment likes table is not modeled yet; keep as UI-only.
  const onLike = () => {
    if (!user) return promptSignUp();
    setLiked((l) => !l);
  };

  const avatar =
    comment.author?.avatar_url ??
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(comment.author?.display_name ?? comment.author_id)}`;

  return (
    <div className="border-b border-border/50">
      <div className="flex gap-3 px-4 py-3">
        <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">@{comment.author?.nametag ?? "user"}</span>
            <span>{timeAgo(comment.created_at)}</span>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">{comment.body}</p>

          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={onLike}
              className={cn("flex items-center gap-1", liked && "text-primary")}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-primary")} />
              {formatCount(comment.likes_count + (liked ? 1 : 0))}
            </button>
            <button className="flex items-center gap-1 hover:text-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
