import { Feed } from "@/components/feed/Feed";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoryFilter } from "@/contexts/CategoryContext";
import { usePosts } from "@/hooks/usePosts";
import { Loader2 } from "lucide-react";

export default function Following() {
  const { user, promptSignUp } = useAuth();
  const { active } = useCategoryFilter();
  const { posts, loading } = usePosts({ scope: "following", categoryLabel: active });

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Sign in to follow creators</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Build a personal feed of travelers, photographers, and verified businesses.
        </p>
        <button
          onClick={promptSignUp}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign up free
        </button>
      </div>
    );
  }

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
      emptyTitle="Quiet day from your follows"
      emptyBody="Try Discover to find new creators."
    />
  );
}
