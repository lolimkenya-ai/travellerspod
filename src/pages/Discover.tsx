import { Feed } from "@/components/feed/Feed";
import { useCategoryFilter } from "@/contexts/CategoryContext";
import { useFairViewFeed, usePreferenceLearning } from "@/hooks/useAdvancedAI";
import { Loader2, Sparkles } from "lucide-react";
import { useEffect } from "react";

export default function Discover() {
  const { active } = useCategoryFilter();
  const { posts, loading, loadFeed, distribution } = useFairViewFeed();
  const { preferences } = usePreferenceLearning();

  useEffect(() => {
    loadFeed(active === "All" ? undefined : active, preferences);
  }, [active, loadFeed, preferences]);

  if (loading && posts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {distribution.unviewed > 0 && (
        <div className="sticky top-0 z-20 flex justify-center py-2 pointer-events-none">
          <div className="flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 text-[10px] font-medium text-primary-foreground shadow-lg backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            AI Optimized Feed
          </div>
        </div>
      )}

      <div className="px-4 py-2 text-center text-sm text-muted-foreground">
        SafiriPod helps travelers discover, plan, and share their travel experiences.
      </div>
      
      <Feed
        posts={posts}
        emptyTitle={`No posts in ${active}`}
        emptyBody="Try a different category or check back soon."
      />
    </div>
  );
}
