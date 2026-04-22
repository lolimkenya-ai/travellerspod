import { Feed } from "@/components/feed/Feed";
import { usePosts } from "@/hooks/usePosts";
import { Loader2 } from "lucide-react";

export default function Broadcasts() {
  const { posts, loading } = usePosts({ scope: "broadcasts" });
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <Feed
      posts={posts}
      emptyTitle="No broadcasts right now"
      emptyBody="Broadcasts are boosted posts from organization accounts — check back soon."
    />
  );
}
