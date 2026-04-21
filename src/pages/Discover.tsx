import { useMemo } from "react";
import { Feed } from "@/components/feed/Feed";
import { POSTS } from "@/data/posts";
import { useCategoryFilter } from "@/contexts/CategoryContext";

export default function Discover() {
  const { active } = useCategoryFilter();

  const posts = useMemo(() => {
    const nonBroadcast = POSTS.filter((p) => !p.isBroadcast);
    const filtered = active === "All" ? nonBroadcast : nonBroadcast.filter((p) => p.category === active);
    // Sprinkle a broadcast post in position 2 for realism
    const broadcast = POSTS.find((p) => p.isBroadcast);
    if (!broadcast || filtered.length < 2) return filtered;
    return [filtered[0], broadcast, ...filtered.slice(1)];
  }, [active]);

  return (
    <Feed
      posts={posts}
      emptyTitle={`No posts in ${active}`}
      emptyBody="Try a different category or check back soon."
    />
  );
}
