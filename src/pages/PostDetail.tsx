import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/post/PostCard";
import { registerUser } from "@/data/users";
import type { Post } from "@/data/types";

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `id, author_id, media_type, media_url, poster_url, text_background, text_foreground,
           caption, location, category_slug, is_broadcast, is_ad, quote_post_id, media_count,
           likes_count, comments_count, saves_count, created_at,
           profile:profiles!posts_author_id_fkey ( id, nametag, display_name, avatar_url, account_type, verified, followers_count, following_count, bio ),
           extra_media:post_media ( url, poster_url, media_type, position )`,
        )
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const r: any = data;
      if (r.profile) {
        registerUser({
          id: r.profile.id,
          nametag: r.profile.nametag,
          displayName: r.profile.display_name,
          avatar:
            r.profile.avatar_url ??
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.profile.display_name)}`,
          bio: r.profile.bio ?? undefined,
          accountType: r.profile.account_type === "personal" ? "normal" : r.profile.account_type,
          verified: r.profile.verified,
          followers: r.profile.followers_count,
          following: r.profile.following_count,
        });
      }

      let media: Post["media"];
      if (r.media_type === "video") {
        media = { type: "video", src: r.media_url ?? "", poster: r.poster_url ?? "" };
      } else if (r.media_type === "image") {
        media = { type: "image", src: r.media_url ?? "" };
      } else {
        media = {
          type: "text",
          background: r.text_background ?? "linear-gradient(135deg,#0F172A,#1E293B)",
          foreground: r.text_foreground ?? "#F8FAFC",
        };
      }
      const gallery = (r.extra_media ?? [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((m: any) => ({ type: m.media_type, src: m.url, poster: m.poster_url ?? undefined }));

      // Quote (if any)
      let quote: Post["quote"] = null;
      if (r.quote_post_id) {
        const { data: q } = await supabase
          .from("posts")
          .select(
            `id, caption, media_type, media_url, poster_url,
             author:profiles!posts_author_id_fkey ( nametag, display_name, avatar_url )`,
          )
          .eq("id", r.quote_post_id)
          .maybeSingle();
        if (q) {
          quote = {
            id: (q as any).id,
            caption: (q as any).caption,
            authorNametag: (q as any).author?.nametag ?? "user",
            authorDisplayName: (q as any).author?.display_name ?? "User",
            authorAvatar: (q as any).author?.avatar_url ?? null,
            cover: (q as any).poster_url ?? (q as any).media_url ?? null,
            mediaType: (q as any).media_type,
          };
        }
      }

      setPost({
        id: r.id,
        authorId: r.author_id,
        media,
        caption: r.caption,
        location: r.location ?? "",
        category: r.category_slug ?? "",
        createdAt: r.created_at,
        likes: r.likes_count,
        comments: r.comments_count,
        reposts: 0,
        isBroadcast: r.is_broadcast,
        isAd: r.is_ad,
        gallery,
        quote,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Post</h1>
      </header>

      {loading && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && notFound && (
        <div className="p-8 text-center text-sm text-muted-foreground">Post not found.</div>
      )}
      {!loading && post && <PostCard post={post} />}
    </div>
  );
}
