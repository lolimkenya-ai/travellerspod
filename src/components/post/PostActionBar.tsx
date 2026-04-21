import { Heart, MessageCircle, Repeat2, Share2, Bookmark } from "lucide-react";
import { useState } from "react";
import { useRequireAuth } from "@/contexts/AuthContext";
import { useBoards } from "@/contexts/BoardsContext";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Post } from "@/data/types";

interface Props {
  post: Post;
  onComment: () => void;
  onRepost: () => void;
  onSave: () => void;
  onInquire?: () => void;
  showInquire?: boolean;
}

export function PostActionBar({ post, onComment, onRepost, onSave, onInquire, showInquire }: Props) {
  const [liked, setLiked] = useState(false);
  const [bursting, setBursting] = useState(false);
  const requireAuth = useRequireAuth();
  const { isPostSaved } = useBoards();
  const saved = isPostSaved(post.id);

  const likeCount = liked ? post.likes + 1 : post.likes;

  const handleLike = () =>
    requireAuth(() => {
      setLiked((l) => !l);
      setBursting(true);
      window.setTimeout(() => setBursting(false), 360);
    });

  const handleShare = () =>
    requireAuth(() => {
      navigator.clipboard?.writeText(`${window.location.origin}/post/${post.id}`).catch(() => {});
      toast.success("Link copied to clipboard");
    });

  return (
    <div className="border-t border-border/50 bg-card">
      {/* Stat row */}
      <button
        onClick={onComment}
        className="flex w-full items-center gap-3 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <span>
          <span className="font-semibold text-foreground">{formatCount(likeCount)}</span> likes
        </span>
        <span aria-hidden>·</span>
        <span>{formatCount(post.comments)} comments</span>
        <span aria-hidden>·</span>
        <span>{formatCount(post.reposts)} reposts</span>
      </button>

      {/* Primary action bar — flat, LinkedIn-style */}
      <div className="grid grid-cols-4 border-t border-border/50">
        <ActionButton label="Like" onClick={handleLike} active={liked}>
          <Heart
            className={cn(
              "h-5 w-5 transition-colors",
              liked && "fill-primary text-primary",
              bursting && "animate-like-burst",
            )}
          />
        </ActionButton>
        <ActionButton label="Comment" onClick={onComment}>
          <MessageCircle className="h-5 w-5" />
        </ActionButton>
        <ActionButton label="Repost" onClick={() => requireAuth(onRepost)}>
          <Repeat2 className="h-5 w-5" />
        </ActionButton>
        <ActionButton label="Share" onClick={handleShare}>
          <Share2 className="h-5 w-5" />
        </ActionButton>
      </div>

      {/* Secondary row */}
      <div className="flex items-center justify-between gap-2 border-t border-border/50 px-2 py-2">
        <button
          onClick={() => requireAuth(onSave)}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent",
            saved && "text-secondary",
          )}
        >
          <Bookmark className={cn("h-4 w-4", saved && "fill-secondary")} />
          {saved ? "Saved to board" : "Save to Trip Board"}
        </button>
        {showInquire && (
          <button
            onClick={() => requireAuth(() => onInquire?.())}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Inquire Now
          </button>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 py-3 text-xs font-medium transition-colors hover:bg-accent",
        active ? "text-primary" : "text-foreground",
      )}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}
