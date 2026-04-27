import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type AIFeatureType = "caption" | "tips" | "hashtags" | "description";
export type ToneType = "casual" | "professional" | "funny" | "inspirational";
export type LengthType = "short" | "medium" | "long";

interface AIAssistantResponse {
  type: string;
  content: string | string[];
  suggestions: string[];
  confidence: number;
}

interface RateLimitInfo {
  allowed: boolean;
  remaining_calls: number;
  reset_at: string;
}

/**
 * Hook for AI content assistant features
 * Generates captions, travel tips, hashtags, and descriptions
 */
export function useAIAssistant() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  const checkRateLimit = useCallback(
    async (feature: AIFeatureType): Promise<boolean> => {
      if (!user) return false;

      try {
        const { data, error: rpcError } = await supabase.rpc(
          "check_ai_rate_limit",
          {
            _user_id: user.id,
            _feature: feature,
          }
        );

        if (rpcError) throw rpcError;

        const result = (data as any[])?.[0];
        if (result) {
          setRateLimitInfo({
            allowed: result.allowed,
            remaining_calls: result.remaining_calls,
            reset_at: result.reset_at,
          });
        }

        return result?.allowed || false;
      } catch (err) {
        console.error("Rate limit check failed:", err);
        return true; // Allow on error
      }
    },
    [user]
  );

  const generateCaption = useCallback(
    async (
      context: string,
      tone: ToneType = "casual",
      length: LengthType = "medium"
    ): Promise<AIAssistantResponse | null> => {
      setLoading(true);
      setError(null);

      try {
        const allowed = await checkRateLimit("caption");
        if (!allowed) {
          const message = "Rate limit exceeded. Please try again later.";
          setError(message);
          toast.error(message);
          return null;
        }

        const { data, error: callError } = await supabase.functions.invoke(
          "ai-content-assistant",
          {
            body: {
              type: "caption",
              context,
              tone,
              length,
            },
          }
        );

        if (callError) throw callError;
        return data as AIAssistantResponse;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate caption";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [checkRateLimit]
  );

  const generateTravelTips = useCallback(
    async (destination: string, category: string = "general"): Promise<string[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const allowed = await checkRateLimit("tips");
        if (!allowed) {
          const message = "Rate limit exceeded. Please try again later.";
          setError(message);
          toast.error(message);
          return null;
        }

        const { data, error: callError } = await supabase.functions.invoke(
          "ai-content-assistant",
          {
            body: {
              type: "tips",
              context: `${destination}|${category}`,
            },
          }
        );

        if (callError) throw callError;
        return (data?.content as string[]) || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate tips";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [checkRateLimit]
  );

  const generateHashtags = useCallback(
    async (context: string): Promise<string[] | null> => {
      setLoading(true);
      setError(null);

      try {
        const allowed = await checkRateLimit("hashtags");
        if (!allowed) {
          const message = "Rate limit exceeded. Please try again later.";
          setError(message);
          toast.error(message);
          return null;
        }

        const { data, error: callError } = await supabase.functions.invoke(
          "ai-content-assistant",
          {
            body: {
              type: "hashtags",
              context,
            },
          }
        );

        if (callError) throw callError;
        return (data?.content as string[]) || [];
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate hashtags";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [checkRateLimit]
  );

  const generateDescription = useCallback(
    async (
      businessName: string,
      businessType: string,
      highlights: string
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const allowed = await checkRateLimit("description");
        if (!allowed) {
          const message = "Rate limit exceeded. Please try again later.";
          setError(message);
          toast.error(message);
          return null;
        }

        const { data, error: callError } = await supabase.functions.invoke(
          "ai-content-assistant",
          {
            body: {
              type: "description",
              context: `${businessName}|${businessType}|${highlights}`,
            },
          }
        );

        if (callError) throw callError;
        return (data?.content as string) || "";
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate description";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [checkRateLimit]
  );

  return {
    loading,
    error,
    rateLimitInfo,
    generateCaption,
    generateTravelTips,
    generateHashtags,
    generateDescription,
  };
}

/**
 * Hook for AI content moderation
 */
export function useContentModeration() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const moderateContent = useCallback(
    async (postId: string, caption: string, mediaType?: string) => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: callError } = await supabase.functions.invoke(
          "moderate-content",
          {
            body: {
              postId,
              caption,
              mediaType,
            },
          }
        );

        if (callError) throw callError;
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Moderation check failed";
        setError(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    moderateContent,
  };
}

/**
 * Hook for AI business verification
 */
export function useBusinessVerification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifyBusiness = useCallback(
    async (profileId: string) => {
      if (!user) {
        setError("Not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: callError } = await supabase.functions.invoke(
          "verify-business-ai",
          {
            body: { profileId },
          }
        );

        if (callError) throw callError;
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user]
  );

  return {
    loading,
    error,
    verifyBusiness,
  };
}

/**
 * Hook for AI usage statistics
 */
export function useAIUsageStats(days: number = 30) {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_ai_usage_stats", {
        _user_id: user.id,
        _days: days,
      });

      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch AI usage stats:", err);
    } finally {
      setLoading(false);
    }
  }, [user, days]);

  return {
    stats,
    loading,
    fetchStats,
  };
}

/**
 * Hook for moderation statistics (admin only)
 */
export function useModerationStats(days: number = 30) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_moderation_stats", {
        _days: days,
      });

      if (error) throw error;
      setStats((data as any[])?.[0] || null);
    } catch (err) {
      console.error("Failed to fetch moderation stats:", err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  return {
    stats,
    loading,
    fetchStats,
  };
}
