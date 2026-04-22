import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerUser } from "@/data/users";
import type { Post } from "@/data/types";

interface PostRow {
  id: string;
  author_id: string;
  media_type: "video" | "image" | "text";
  media_url: string | null;
  poster_url: string | null;
  text_background: string | null;
  text_foreground: string | null;
  caption: string;
  location: string | null;
  category_slug: string | null;
  is_broadcast: boolean;
  is_ad: boolean;
  likes_count: number;
  comments_count: number;
  saves_count: number;
  created_at: string;
  profile?: {
    id: string;
    nametag: string;
    display_name: string;
    avatar_url: string | null;
    account_type: "personal" | "business" | "organization";
    verified: boolean;
    followers_count: number;
    following_count: number;
    bio: string | null;
  } | null;
}

export interface UsePostsOptions {
  scope?: "discover" | "following" | "broadcasts" | "author";
  authorId?: string;
  categoryLabel?: string; // category label from CategoryBar; "All" => no filter
  limit?: number;
}

function rowToPost(row: PostRow): Post {
  // Hydrate the in-memory user store so AuthorChip / mocks resolve the author.
  if (row.profile) {
    registerUser({
      id: row.profile.id,
      nametag: row.profile.nametag,
      displayName: row.profile.display_name,
      avatar:
        row.profile.avatar_url ??
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.profile.display_name)}`,
      bio: row.profile.bio ?? undefined,
      accountType:
        row.profile.account_type === "personal" ? "normal" : (row.profile.account_type as "business" | "organization"),
      verified: row.profile.verified,
      followers: row.profile.followers_count,
      following: row.profile.following_count,
    });
  }

  let media: Post["media"];
  if (row.media_type === "video") {
    media = {
      type: "video",
      src: row.media_url ?? "",
      poster: row.poster_url ?? "",
    };
  } else if (row.media_type === "image") {
    media = { type: "image", src: row.media_url ?? "" };
  } else {
    media = {
      type: "text",
      background: row.text_background ?? "linear-gradient(135deg,#0F172A,#1E293B)",
      foreground: row.text_foreground ?? "#F8FAFC",
    };
  }

  return {
    id: row.id,
    authorId: row.author_id,
    media,
    caption: row.caption,
    location: row.location ?? "",
    category: row.category_slug ?? "",
    createdAt: row.created_at,
    likes: row.likes_count,
    comments: row.comments_count,
    reposts: 0,
    isBroadcast: row.is_broadcast,
    isAd: row.is_ad,
  };
}

export function usePosts({ scope = "discover", authorId, categoryLabel, limit = 50 }: UsePostsOptions = {}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      // Resolve following ids for the "following" scope
      let followingIds: string[] | null = null;
      if (scope === "following") {
        const { data: u } = await supabase.auth.getUser();
        const me = u.user?.id;
        if (!me) {
          if (!cancelled) {
            setPosts([]);
            setLoading(false);
          }
          return;
        }
        const { data: f } = await supabase
          .from("follows")
          .select("followee_id")
          .eq("follower_id", me);
        followingIds = (f ?? []).map((r) => r.followee_id);
        if (followingIds.length === 0) {
          if (!cancelled) {
            setPosts([]);
            setLoading(false);
          }
          return;
        }
      }

      // Resolve category slug from label if needed
      let slug: string | null = null;
      if (categoryLabel && categoryLabel !== "All") {
        const { data: cat } = await supabase
          .from("categories")
          .select("slug")
          .eq("label", categoryLabel)
          .maybeSingle();
        slug = cat?.slug ?? null;
      }

      let q = supabase
        .from("posts")
        .select(
          `id, author_id, media_type, media_url, poster_url, text_background, text_foreground,
           caption, location, category_slug, is_broadcast, is_ad,
           likes_count, comments_count, saves_count, created_at,
           profile:profiles!posts_author_id_fkey ( id, nametag, display_name, avatar_url, account_type, verified, followers_count, following_count, bio )`,
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (scope === "broadcasts") q = q.eq("is_broadcast", true);
      if (scope === "author" && authorId) q = q.eq("author_id", authorId);
      if (scope === "following" && followingIds) q = q.in("author_id", followingIds);
      if (slug) q = q.eq("category_slug", slug);

      const { data, error: err } = await q;
      if (cancelled) return;
      if (err) {
        setError(err.message);
        setPosts([]);
      } else {
        setPosts((data as unknown as PostRow[]).map(rowToPost));
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [scope, authorId, categoryLabel, limit]);

  return { posts, loading, error };
}
