// Edge function: fair-view-algorithm
// Implements Fair-View algorithm for equitable content distribution
// Prioritizes human-created content, ensures all content is viewed once,
// and boosts low-view content while maintaining quality standards

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FeedRequest {
  userId: string;
  limit?: number;
  offset?: number;
  category?: string;
  userPreferences?: Record<string, number>;
}

interface FeedPost {
  id: string;
  caption: string;
  mediaType: string;
  author: {
    id: string;
    displayName: string;
    nametag: string;
    verified: boolean;
    avatar: string;
  };
  stats: {
    likes: number;
    views: number;
    comments: number;
  };
  isHumanCreated: boolean;
  viewCount: number;
  isAd: boolean;
  isBroadcast: boolean;
  fairViewScore: number;
  createdAt: string;
}

/**
 * Calculate Fair-View Score for content distribution
 * Factors:
 * - Human-created content boost (40%)
 * - View count (lower views = higher score) (30%)
 * - Quality metrics (likes, comments) (20%)
 * - Recency (10%)
 */
function calculateFairViewScore(
  post: any,
  userPreferences: Record<string, number>,
  maxViews: number
): number {
  let score = 0;

  // 1. Human-created content boost (40 points max)
  const humanBoost = post.is_ai_generated ? 0 : 40;
  score += humanBoost;

  // 2. View distribution (30 points max)
  // Lower views = higher score (to boost underexposed content)
  const viewScore = Math.max(0, 30 * (1 - post.views_count / (maxViews + 1)));
  score += viewScore;

  // 3. Quality metrics (20 points max)
  const engagementRate = (post.likes_count + post.comments_count * 2) / (post.views_count + 1);
  const qualityScore = Math.min(20, engagementRate * 100);
  score += qualityScore;

  // 4. Recency bonus (10 points max)
  const ageInHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 10 * Math.exp(-ageInHours / 24));
  score += recencyScore;

  // 5. User preference alignment (bonus multiplier)
  let preferenceMultiplier = 1;
  const postTags = post.tags || [];
  const postCategory = post.category || "";

  let matchedPreferences = 0;
  Object.entries(userPreferences).forEach(([pref, weight]) => {
    if (
      postTags.some((tag: string) => tag.toLowerCase().includes(pref.toLowerCase())) ||
      postCategory.toLowerCase().includes(pref.toLowerCase())
    ) {
      matchedPreferences += (weight as number) * 0.1;
    }
  });

  preferenceMultiplier = 1 + Math.min(matchedPreferences, 0.5); // Max 50% boost

  return score * preferenceMultiplier;
}

/**
 * Check if user has already viewed this content
 */
async function hasUserViewed(
  supabase: any,
  userId: string,
  postId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("post_views")
    .select("id")
    .eq("user_id", userId)
    .eq("post_id", postId)
    .maybeSingle();

  return !!data;
}

/**
 * Get posts user hasn't viewed yet (priority)
 */
async function getUnviewedPosts(
  supabase: any,
  userId: string,
  limit: number,
  category?: string,
  userPreferences?: Record<string, number>
): Promise<FeedPost[]> {
  let query = supabase
    .from("posts")
    .select(
      `id, caption, media_type, likes_count, views_count, comments_count, 
       created_at, tags, category, is_ai_generated, removed_at,
       author:author_id(id, display_name, nametag, verified, avatar_url)`
    )
    .eq("removed_at", null)
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data: posts } = await query.limit(limit * 3); // Fetch more to filter

  if (!posts) return [];

  // Filter for unviewed posts
  const unviewedPosts: any[] = [];
  for (const post of posts) {
    const viewed = await hasUserViewed(supabase, userId, post.id);
    if (!viewed) {
      unviewedPosts.push(post);
    }
    if (unviewedPosts.length >= limit) break;
  }

  // Get max views for normalization
  const maxViews = Math.max(...posts.map((p: any) => p.views_count || 0), 1);

  // Calculate Fair-View scores
  const scoredPosts = unviewedPosts.map((post) => ({
    ...post,
    fairViewScore: calculateFairViewScore(
      post,
      userPreferences || {},
      maxViews
    ),
  }));

  // Sort by Fair-View score
  scoredPosts.sort((a, b) => b.fairViewScore - a.fairViewScore);

  return scoredPosts.slice(0, limit).map((post) => ({
    id: post.id,
    caption: post.caption,
    mediaType: post.media_type,
    author: {
      id: post.author.id,
      displayName: post.author.display_name,
      nametag: post.author.nametag,
      verified: post.author.verified,
      avatar: post.author.avatar_url,
    },
    stats: {
      likes: post.likes_count,
      views: post.views_count,
      comments: post.comments_count,
    },
    isHumanCreated: !post.is_ai_generated,
    viewCount: post.views_count,
    isAd: false,
    isBroadcast: false,
    fairViewScore: post.fairViewScore,
    createdAt: post.created_at,
  }));
}

/**
 * Get low-view posts for boost (after user has seen most content)
 */
async function getLowViewPosts(
  supabase: any,
  userId: string,
  limit: number,
  category?: string,
  userPreferences?: Record<string, number>
): Promise<FeedPost[]> {
  let query = supabase
    .from("posts")
    .select(
      `id, caption, media_type, likes_count, views_count, comments_count,
       created_at, tags, category, is_ai_generated, removed_at,
       author:author_id(id, display_name, nametag, verified, avatar_url)`
    )
    .eq("removed_at", null)
    .lt("views_count", 50) // Low view threshold
    .order("views_count", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data: posts } = await query.limit(limit);

  if (!posts) return [];

  // Get max views for normalization
  const maxViews = Math.max(...posts.map((p: any) => p.views_count || 0), 1);

  // Calculate Fair-View scores
  const scoredPosts = posts.map((post) => ({
    ...post,
    fairViewScore: calculateFairViewScore(
      post,
      userPreferences || {},
      maxViews
    ),
  }));

  return scoredPosts.map((post) => ({
    id: post.id,
    caption: post.caption,
    mediaType: post.media_type,
    author: {
      id: post.author.id,
      displayName: post.author.display_name,
      nametag: post.author.nametag,
      verified: post.author.verified,
      avatar: post.author.avatar_url,
    },
    stats: {
      likes: post.likes_count,
      views: post.views_count,
      comments: post.comments_count,
    },
    isHumanCreated: !post.is_ai_generated,
    viewCount: post.views_count,
    isAd: false,
    isBroadcast: false,
    fairViewScore: post.fairViewScore,
    createdAt: post.created_at,
  }));
}

/**
 * Get promoted content (ads/broadcasts) - limited frequency
 */
async function getPromotedContent(
  supabase: any,
  userId: string,
  limit: number
): Promise<FeedPost[]> {
  // Check how many promoted items user has seen today
  const today = new Date().toISOString().split("T")[0];
  const { data: promotedViews } = await supabase
    .from("promoted_content_views")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59`);

  const dailyPromotedLimit = 3;
  if ((promotedViews?.length || 0) >= dailyPromotedLimit) {
    return [];
  }

  const { data: promoted } = await supabase
    .from("posts")
    .select(
      `id, caption, media_type, likes_count, views_count, comments_count,
       created_at, author:author_id(id, display_name, nametag, verified, avatar_url)`
    )
    .eq("is_promoted", true)
    .eq("removed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!promoted) return [];

  return promoted.map((post) => ({
    id: post.id,
    caption: post.caption,
    mediaType: post.media_type,
    author: {
      id: post.author.id,
      displayName: post.author.display_name,
      nametag: post.author.nametag,
      verified: post.author.verified,
      avatar: post.author.avatar_url,
    },
    stats: {
      likes: post.likes_count,
      views: post.views_count,
      comments: post.comments_count,
    },
    isHumanCreated: true,
    viewCount: post.views_count,
    isAd: true,
    isBroadcast: true,
    fairViewScore: 0,
    createdAt: post.created_at,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: ures } = await supabase.auth.getUser();
    const caller = ures.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as FeedRequest;
    const { limit = 20, offset = 0, category, userPreferences = {} } = body;

    const feedPosts: FeedPost[] = [];

    // 1. Priority: Unviewed content (80% of feed)
    const unviewedLimit = Math.ceil(limit * 0.8);
    const unviewedPosts = await getUnviewedPosts(
      supabase,
      caller.id,
      unviewedLimit,
      category,
      userPreferences
    );
    feedPosts.push(...unviewedPosts);

    // 2. Secondary: Low-view content boost (15% of feed)
    if (feedPosts.length < limit * 0.95) {
      const lowViewLimit = Math.ceil(limit * 0.15);
      const lowViewPosts = await getLowViewPosts(
        supabase,
        caller.id,
        lowViewLimit,
        category,
        userPreferences
      );
      feedPosts.push(...lowViewPosts);
    }

    // 3. Tertiary: Promoted content (5% of feed, max 1 per session)
    if (feedPosts.length < limit) {
      const promotedLimit = Math.max(1, Math.ceil(limit * 0.05));
      const promotedPosts = await getPromotedContent(supabase, caller.id, promotedLimit);
      feedPosts.push(...promotedPosts);
    }

    // Slice to exact limit
    const finalFeed = feedPosts.slice(0, limit);

    // Log feed impression
    try {
      await supabase.from("feed_impressions").insert({
        user_id: caller.id,
        posts_count: finalFeed.length,
        algorithm_version: "fair-view-v1",
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log feed impression:", error);
    }

    return new Response(
      JSON.stringify({
        posts: finalFeed,
        totalCount: finalFeed.length,
        algorithmVersion: "fair-view-v1",
        distributionBreakdown: {
          unviewed: unviewedPosts.length,
          lowView: feedPosts.length - unviewedPosts.length - (finalFeed.filter((p) => p.isAd).length),
          promoted: finalFeed.filter((p) => p.isAd).length,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("fair-view-algorithm error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
