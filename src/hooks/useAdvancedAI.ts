import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  id: string;
  type: "post" | "business" | "user" | "destination";
  title: string;
  description: string;
  relevanceScore: number;
  matchedFields: string[];
  userPreferenceMatch: number;
  metadata: Record<string, any>;
}

/* ------------------------------------------------------------------ */
/* SQL-based fallback search (always works, no external deps)          */
/* ------------------------------------------------------------------ */

async function sqlSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.trim();
  const results: SearchResult[] = [];

  // Search profiles (users & businesses) - using trigram similarity for display_name and nametag
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nametag, display_name, avatar_url, is_verified, account_type, bio")
    .or(`display_name.ilike.%${q}%,nametag.ilike.%${q}%,bio.ilike.%${q}%`)
    .limit(12);

  for (const p of profiles ?? []) {
    results.push({
      id: p.id,
      type: p.account_type === "business" ? "business" : "user",
      title: p.display_name,
      description: `@${p.nametag}${p.bio ? " · " + p.bio.slice(0, 60) : ""}`,
      relevanceScore: (p as any).is_verified ? 95 : 80,
      matchedFields: ["display_name"],
      userPreferenceMatch: 0,
      metadata: {
        avatar_url: p.avatar_url,
        verified: (p as any).is_verified,
        nametag: p.nametag,
        account_type: p.account_type,
      },
    });
  }

  // Search posts - using full-text search with tsvector
  const { data: posts } = await supabase
    .from("posts")
    .select("id, caption, media_url, poster_url, location, author_id, likes_count")
    .textSearch("search_vector", q.split(" ").join(" & "))
    .is("removed_at", null)
    .order("likes_count", { ascending: false })
    .limit(15);

  // Fallback to ilike if textSearch yields nothing (common for short queries)
  let finalPosts = posts ?? [];
  if (finalPosts.length === 0) {
    const { data: ilikePosts } = await supabase
      .from("posts")
      .select("id, caption, media_url, poster_url, location, author_id, likes_count")
      .ilike("caption", `%${q}%`)
      .is("removed_at", null)
      .limit(15);
    finalPosts = ilikePosts ?? [];
  }

  for (const p of finalPosts) {
    results.push({
      id: p.id,
      type: "post",
      title: p.caption?.slice(0, 80) ?? "",
      description: p.location ?? "",
      relevanceScore: 70,
      matchedFields: ["caption"],
      userPreferenceMatch: 0,
      metadata: {
        media_url: p.poster_url ?? p.media_url,
        location: p.location,
        author_id: p.author_id,
      },
    });
  }

  return results;
}

/* ------------------------------------------------------------------ */
/* AI-powered search (attempts Edge Function, falls back to SQL)       */
/* ------------------------------------------------------------------ */

export function useAISearch() {
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState(0);

  const search = useCallback(
    async (query: string, filters?: Record<string, any>) => {
      if (!query || query.trim().length === 0) {
        setResults([]);
        setSuggestions([]);
        return;
      }

      setLoading(true);
      setError(null);
      const start = Date.now();

      try {
        // Attempt AI edge function first (if user is logged in)
        if (user) {
          const { data, error: callError } = await supabase.functions.invoke(
            "ai-search-recommendations",
            {
              body: { query, userId: user.id, filters, limit: 20, offset: 0 },
            }
          );

          if (!callError && data?.results?.length > 0) {
            setResults(data.results);
            setSuggestions(data.suggestions ?? []);
            setExecutionTime(Date.now() - start);
            return;
          }
        }

        // Fallback: always-available SQL search
        const fallback = await sqlSearch(query);
        setResults(fallback);
        setSuggestions([]);
        setExecutionTime(Date.now() - start);
      } catch (err) {
        // Last resort: try pure SQL even if something throws above
        try {
          const fallback = await sqlSearch(query);
          setResults(fallback);
        } catch {
          setError("Search failed. Please try again.");
          setResults([]);
        }
        setExecutionTime(Date.now() - start);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return { results, suggestions, loading, error, executionTime, search };
}

/* ------------------------------------------------------------------ */
/* Debounced search (used by Search.tsx)                               */
/* ------------------------------------------------------------------ */

export function useDebouncedSearch(delayMs: number = 300) {
  const { search, results, suggestions, loading, error, executionTime } = useAISearch();
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      search(query);
    }, delayMs);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, delayMs, search]);

  return { query, setQuery, results, suggestions, loading, error, executionTime };
}

/* ------------------------------------------------------------------ */
/* Preference learning                                                 */
/* ------------------------------------------------------------------ */

export function usePreferenceLearning() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Record<string, number>>({});
  const [engagementStyle, setEngagementStyle] = useState<string>("mixed");
  const [loading, setLoading] = useState(false);

  const recordBehavior = useCallback(
    async (
      postId: string,
      action: "view" | "like" | "share" | "scroll_past" | "comment" | "save",
      metadata?: { duration?: number; scrollDepth?: number; postMetadata?: Record<string, any> }
    ) => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error: callError } = await supabase.functions.invoke(
          "learn-user-preferences",
          {
            body: {
              userId: user.id,
              postId,
              action,
              duration: metadata?.duration ?? 0,
              scrollDepth: metadata?.scrollDepth ?? 0,
              postMetadata: metadata?.postMetadata ?? {},
            },
          }
        );
        if (!callError) {
          setPreferences(data?.preferences ?? {});
          setEngagementStyle(data?.engagementStyle ?? "mixed");
        }
      } catch {
        // silent — preference learning is best-effort
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return { preferences, engagementStyle, loading, recordBehavior };
}

/* ------------------------------------------------------------------ */
/* Fair-View feed                                                      */
/* ------------------------------------------------------------------ */

interface FeedPost {
  id: string;
  caption: string;
  mediaType: string;
  author: { id: string; displayName: string; nametag: string; verified: boolean; avatar: string };
  stats: { likes: number; views: number; comments: number };
  isHumanCreated: boolean;
  viewCount: number;
  isAd: boolean;
  isBroadcast: boolean;
  fairViewScore: number;
  createdAt: string;
}

export function useFairViewFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [distribution, setDistribution] = useState<Record<string, number>>({});

  const loadFeed = useCallback(
    async (category?: string, userPreferences?: Record<string, number>) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error: callError } = await supabase.functions.invoke(
          "fair-view-algorithm",
          { body: { userId: user.id, limit: 20, offset: 0, category, userPreferences } }
        );
        if (callError) throw callError;
        setPosts(data?.posts ?? []);
        setDistribution(data?.distributionBreakdown ?? {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load feed";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  const recordPostView = useCallback(
    async (postId: string) => {
      if (!user) return;
      try {
        await supabase.rpc("record_post_view", { _user_id: user.id, _post_id: postId });
      } catch {
        // silent
      }
    },
    [user]
  );

  return { posts, loading, error, distribution, loadFeed, recordPostView };
}

/* ------------------------------------------------------------------ */
/* Insight hooks (admin)                                               */
/* ------------------------------------------------------------------ */

export function usePreferenceInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_user_preference_insights", {
        _user_id: user.id,
      });
      if (!error) setInsights(data?.[0] ?? null);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user]);

  return { insights, loading, fetchInsights };
}

export function useTrendingSearchTopics(days: number = 7) {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.rpc("get_trending_search_topics", { _days: days });
      setTopics(data ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [days]);

  return { topics, loading, fetchTrending };
}

export function useAlgorithmMetrics(days: number = 7) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.rpc("get_algorithm_performance_metrics", { _days: days });
      setMetrics(data?.[0] ?? null);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [days]);

  return { metrics, loading, fetchMetrics };
}

export function useAIDetection() {
  const [isAI, setIsAI] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [indicators, setIndicators] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const detectCaption = useCallback(async (caption: string) => {
    setLoading(true);
    try {
      const { data } = await supabase.rpc("detect_ai_generated_caption", { _caption: caption });
      const result = data?.[0];
      setIsAI(result?.is_ai_generated ?? false);
      setConfidence(result?.confidence ?? 0);
      setIndicators(result?.indicators ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  return { isAI, confidence, indicators, loading, detectCaption };
}
