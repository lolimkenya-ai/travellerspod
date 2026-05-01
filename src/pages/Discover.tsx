import { Feed } from "@/components/feed/Feed";
import { useCategoryFilter } from "@/contexts/CategoryContext";
import { usePosts } from "@/hooks/usePosts";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Discover() {
  const { user } = useAuth();
  const { active } = useCategoryFilter();
  const { posts, loading } = usePosts({ scope: "discover", categoryLabel: active });

  if (loading && posts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {!user && (
        <div className="px-4 py-2 text-center text-sm text-muted-foreground">
          Travellerspod helps travelers discover, plan, and share real travel experiences.
        </div>
      )}
      <Feed
        posts={posts}
        emptyTitle={`No posts in ${active}`}
        emptyBody="Try a different category or check back soon."
      />
    </div>
  );
}
