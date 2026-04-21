import { Feed } from "@/components/feed/Feed";
import { POSTS } from "@/data/posts";
import { useAuth } from "@/contexts/AuthContext";
import { useCategoryFilter } from "@/contexts/CategoryContext";

// Mocked: pretend the user follows these creators
const FOLLOWED = ["u1", "u3", "u6"];

export default function Following() {
  const { user, promptSignUp } = useAuth();
  const { active } = useCategoryFilter();

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

  const posts = POSTS.filter(
    (p) => FOLLOWED.includes(p.authorId) && (active === "All" || p.category === active),
  );

  return (
    <Feed
      posts={posts}
      emptyTitle="Quiet day from your follows"
      emptyBody="Try Discover to find new creators."
    />
  );
}
