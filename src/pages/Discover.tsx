import { Feed } from "@/components/feed/Feed";
import { POSTS } from "@/data/posts";
import { useCategoryFilter } from "@/contexts/CategoryContext";
import { usePosts } from "@/hooks/usePosts";
import { Loader2 } from "lucide-react";

export default function Discover() {
  const { active } = useCategoryFilter();
  const { posts: dbPosts, loading } = usePosts({ scope: "discover", categoryLabel: active });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Fall back to mocks while the DB is empty so first-time visitors still see
  // a populated feed. As soon as real posts exist, those take over.
  let posts = dbPosts;
  if (posts.length === 0) {
    const nonBroadcast = POSTS.filter((p) => !p.isBroadcast);
    posts = active === "All" ? nonBroadcast : nonBroadcast.filter((p) => p.category === active);
  }

  return (
    <Feed
      posts={posts}
      emptyTitle={`No posts in ${active}`}
      emptyBody="Try a different category or check back soon."
    />
  );
}
