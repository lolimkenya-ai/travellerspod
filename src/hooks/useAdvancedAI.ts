import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface SearchResult {
  id: string;
  type: "post" | "business" | "destination";
  title: string;
  description: string;
  relevanceScore: number;
  matchedFields: string[];
  userPreferenceMatch: number;
  metadata: Record<string, any>;
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
 * Hook for AI-powered search with real-time suggestions
 */
export function useAISearch() {
  const { user } = useAuth();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState(0);

  const search = useCallback(
    async (query: string, filters?: Record<string, any>) => {
      if (!user) return;
      if (!query || query.trim().length === 0) {
        setResults([]);
        setSuggestions([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: callError } = await supabase.functions.invoke(
          "ai-search-recommendations",
          {
            body: {
              query,
              userId: user.id,
              filters,
              limit: 20,
              offset: 0,
            },
          }
        );

        if (callError) throw callError;

        setResults(data?.results || []);
        setSuggestions(data?.suggestions || []);
        setExecutionTime(data?.executionTime || 0);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Search failed";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return {
    results,
    suggestions,
    loading,
    error,
    executionTime,
    search,
  };
}

/**
 * Hook for learning user preferences from behavior
 */
export function usePreferenceLearning() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Record<string, number>>({});
  const [engagementStyle, setEngagementStyle] = useState<string>("mixed");
  const [loading, setLoading] = useState(false);

  const recordBehavior = useCallback(
    async (
      postId: string,
      action: "view" | "like" | "share" | "scroll_past" | "comment" | "save",
      metadata?: {
        duration?: number;
        scrollDepth?: number;
        postMetadata?: Record<string, any>;
      }
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
              duration: metadata?.duration || 0,
              scrollDepth: metadata?.scrollDepth || 0,
              postMetadata: metadata?.postMetadata || {},
            },
          }
        );

        if (callError) throw callError;

        setPreferences(data?.preferences || {});
        setEngagementStyle(data?.engagementStyle || "mixed");
      } catch (err) {
        console.error("Failed to record behavior:", err);
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return {
    preferences,
    engagementStyle,
    loading,
    recordBehavior,
  };
}

/**
 * Hook for Fair-View algorithm feed
 */
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
          {
            body: {
              userId: user.id,
              limit: 20,
              offset: 0,
              category,
              userPreferences,
            },
          }
        );

        if (callError) throw callError;

        setPosts(data?.posts || []);
        setDistribution(data?.distributionBreakdown || {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load feed";
        setError(message);
        toast.error(message);
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
        const { data, error: rpcError } = await supabase.rpc(
          "record_post_view",
          {
            _user_id: user.id,
            _post_id: postId,
          }
        );

        if (rpcError) throw rpcError;

        return data?.[0];
      } catch (err) {
        console.error("Failed to record post view:", err);
      }
    },
    [user]
  );

  return {
    posts,
    loading,
    error,
    distribution,
    loadFeed,
    recordPostView,
  };
}

/**
 * Hook for user preference insights
 */
export function usePreferenceInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_user_preference_insights",
        {
          _user_id: user.id,
        }
      );

      if (error) throw error;
      setInsights(data?.[0] || null);
    } catch (err) {
      console.error("Failed to fetch preference insights:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    insights,
    loading,
    fetchInsights,
  };
}

/**
 * Hook for trending search topics (admin)
 */
export function useTrendingSearchTopics(days: number = 7) {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_trending_search_topics",
        {
          _days: days,
        }
      );

      if (error) throw error;
      setTopics(data || []);
    } catch (err) {
      console.error("Failed to fetch trending topics:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  return {
    topics,
    loading,
    fetchTrending,
  };
}

/**
 * Hook for algorithm performance metrics (admin)
 */
export function useAlgorithmMetrics(days: number = 7) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_algorithm_performance_metrics",
        {
          _days: days,
        }
      );

      if (error) throw error;
      setMetrics(data?.[0] || null);
    } catch (err) {
      console.error("Failed to fetch algorithm metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  return {
    metrics,
    loading,
    fetchMetrics,
  };
}

/**
 * Hook for detecting AI-generated captions
 */
export function useAIDetection() {
  const [isAI, setIsAI] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [indicators, setIndicators] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const detectCaption = useCallback(async (caption: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "detect_ai_generated_caption",
        {
          _caption: caption,
        }
      );

      if (error) throw error;

      const result = data?.[0];
      setIsAI(result?.is_ai_generated || false);
      setConfidence(result?.confidence || 0);
      setIndicators(result?.indicators || []);
    } catch (err) {
      console.error("Failed to detect AI caption:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isAI,
    confidence,
    indicators,
    loading,
    detectCaption,
  };
}

/**
 * Hook for comprehensive search with debouncing
 */
export function useDebouncedSearch(delayMs: number = 300) {
  const { search, results, suggestions, loading, error, executionTime } =
    useAISearch();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim().length > 0) {
        search(query);
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [query, delayMs, search]);

  return {
    query,
    setQuery,
    results,
    suggestions,
    loading,
    error,
    executionTime,
  };
}
