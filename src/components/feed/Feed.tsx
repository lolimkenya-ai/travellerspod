import { PostCard } from "../post/PostCard";
import type { Post } from "@/data/types";

interface Props {
  posts: Post[];
  emptyTitle?: string;
  emptyBody?: string;
}

export function Feed({ posts, emptyTitle = "Nothing here yet", emptyBody }: Props) {
  if (posts.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">{emptyTitle}</h2>
        {emptyBody && <p className="mt-2 text-sm text-muted-foreground">{emptyBody}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
