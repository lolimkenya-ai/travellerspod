import { Feed } from "@/components/feed/Feed";
import { POSTS } from "@/data/posts";

export default function Broadcasts() {
  const posts = POSTS.filter((p) => p.isBroadcast);
  return (
    <Feed
      posts={posts}
      emptyTitle="No broadcasts right now"
      emptyBody="Broadcasts are boosted posts from organization accounts — check back soon."
    />
  );
}
