import { Link } from "react-router-dom";
import { MapPin, BadgeCheck } from "lucide-react";
import { getUser } from "@/data/users";
import { formatCount, timeAgo } from "@/lib/format";
import { useState } from "react";
import { useRequireAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { Post } from "@/data/types";

export function AuthorChip({ post }: { post: Post }) {
  const author = getUser(post.authorId);
  const [following, setFollowing] = useState(false);
  const requireAuth = useRequireAuth();

  return (
    <div className="flex items-start gap-3">
      <Link to={`/profile/${author.nametag}`} aria-label={author.displayName}>
        <img
          src={author.avatar}
          alt=""
          className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Link
            to={`/profile/${author.nametag}`}
            className="truncate text-sm font-semibold text-foreground"
          >
            {author.displayName}
          </Link>
          {author.verified && <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 text-secondary" />
          <span className="truncate">{post.location}</span>
          <span aria-hidden>·</span>
          <span>{timeAgo(post.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{formatCount(author.followers)} followers</span>
        </div>
      </div>
      <button
        onClick={() => requireAuth(() => setFollowing((f) => !f))}
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
          following
            ? "bg-muted text-foreground"
            : "bg-foreground text-background hover:bg-foreground/90",
        )}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}
