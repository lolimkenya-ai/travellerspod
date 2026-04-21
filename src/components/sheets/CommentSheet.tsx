import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Heart, MessageCircle, Repeat2, Send } from "lucide-react";
import { useState } from "react";
import { getComments } from "@/data/comments";
import { getUser } from "@/data/users";
import { useRequireAuth } from "@/contexts/AuthContext";
import { formatCount, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Post, Comment } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: Post;
}

export function CommentSheet({ open, onOpenChange, post }: Props) {
  const baseComments = getComments(post.id);
  const [draft, setDraft] = useState("");
  const [extra, setExtra] = useState<Comment[]>([]);
  const requireAuth = useRequireAuth();

  const all = [...extra, ...baseComments];

  const submit = () => {
    if (!draft.trim()) return;
    requireAuth(() => {
      setExtra((prev) => [
        {
          id: `c-new-${Date.now()}`,
          postId: post.id,
          authorId: "me",
          body: draft.trim(),
          createdAt: new Date().toISOString(),
          likes: 0,
        },
        ...prev,
      ]);
      setDraft("");
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="text-base">
            {formatCount(post.comments + extra.length)} comments
          </SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(85vh-58px-72px)] flex-col overflow-y-auto">
          {all.length === 0 && (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              No comments yet — be the first.
            </div>
          )}
          {all.map((c) => (
            <CommentRow key={c.id} comment={c} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Add a comment..."
              className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              aria-label="Post comment"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CommentRow({ comment, depth = 0 }: { comment: Comment; depth?: number }) {
  const author = getUser(comment.authorId);
  const [liked, setLiked] = useState(false);
  const requireAuth = useRequireAuth();

  return (
    <div className={cn("border-b border-border/50", depth > 0 && "ml-10 border-b-0 border-l border-border/40 pl-3")}>
      <div className="flex gap-3 px-4 py-3">
        <img src={author.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">@{author.nametag}</span>
            <span>{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-foreground">{comment.body}</p>

          {comment.inlineRepost && (
            <div className="mt-3 rounded-xl border border-border bg-background p-3">
              <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Repeat2 className="h-3 w-3" /> Reposted with thoughts
              </div>
              <p className="text-sm text-foreground">{comment.inlineRepost.body}</p>
            </div>
          )}

          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={() => requireAuth(() => setLiked((l) => !l))}
              className={cn("flex items-center gap-1", liked && "text-primary")}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-primary")} />
              {formatCount(comment.likes + (liked ? 1 : 0))}
            </button>
            <button className="flex items-center gap-1 hover:text-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>
        </div>
      </div>
      {comment.replies?.map((r) => (
        <CommentRow key={r.id} comment={r} depth={depth + 1} />
      ))}
    </div>
  );
}
