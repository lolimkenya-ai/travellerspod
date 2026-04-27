// Edge function: learn-user-preferences
// Learns user preferences from scrolling, engagement, and interaction behavior
// Updates preference profile in real-time for personalization

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UserBehavior {
  userId: string;
  postId: string;
  action: "view" | "like" | "share" | "scroll_past" | "comment" | "save";
  duration?: number; // milliseconds spent viewing
  scrollDepth?: number; // 0-100 percentage
  timestamp: string;
  postMetadata?: {
    category?: string;
    author?: string;
    tags?: string[];
    businessType?: string;
    priceRange?: [number, number];
    location?: string;
  };
}

interface PreferenceUpdate {
  category?: number;
  businessType?: string;
  location?: string;
  priceRange?: [number, number];
  keywords?: Record<string, number>;
  authorPreferences?: Record<string, number>;
  engagementStyle?: "likes" | "comments" | "shares" | "saves" | "mixed";
  contentType?: Record<string, number>;
}

/**
 * Extract keywords and preferences from post metadata
 */
function extractPreferences(behavior: UserBehavior): Record<string, number> {
  const preferences: Record<string, number> = {};
  const { action, postMetadata = {} } = behavior;

  // Weight based on action type
  const actionWeights: Record<string, number> = {
    view: 1,
    scroll_past: -0.5,
    like: 3,
    comment: 4,
    share: 5,
    save: 4,
  };

  const weight = actionWeights[action] || 1;

  // Extract category
  if (postMetadata.category) {
    preferences[`category:${postMetadata.category}`] = (preferences[`category:${postMetadata.category}`] || 0) + weight;
  }

  // Extract business type
  if (postMetadata.businessType) {
    preferences[`business:${postMetadata.businessType}`] = (preferences[`business:${postMetadata.businessType}`] || 0) + weight;
  }

  // Extract location
  if (postMetadata.location) {
    preferences[`location:${postMetadata.location}`] = (preferences[`location:${postMetadata.location}`] || 0) + weight;
  }

  // Extract tags
  if (postMetadata.tags && Array.isArray(postMetadata.tags)) {
    postMetadata.tags.forEach((tag) => {
      preferences[`tag:${tag}`] = (preferences[`tag:${tag}`] || 0) + weight * 0.5;
    });
  }

  // Duration bonus (longer view = stronger preference)
  if (behavior.duration && behavior.duration > 5000) {
    const durationBonus = Math.min(behavior.duration / 10000, 2);
    Object.keys(preferences).forEach((key) => {
      preferences[key] *= durationBonus;
    });
  }

  return preferences;
}

/**
 * Decay old preferences to favor recent behavior
 */
function decayPreferences(
  currentPrefs: Record<string, number>,
  decayFactor: number = 0.95
): Record<string, number> {
  const decayed: Record<string, number> = {};
  Object.entries(currentPrefs).forEach(([key, value]) => {
    decayed[key] = value * decayFactor;
  });
  return decayed;
}

/**
 * Merge new preferences with existing ones
 */
function mergePreferences(
  existing: Record<string, number>,
  newPrefs: Record<string, number>,
  learningRate: number = 0.3
): Record<string, number> {
  const merged: Record<string, number> = { ...existing };

  Object.entries(newPrefs).forEach(([key, value]) => {
    if (merged[key]) {
      // Exponential moving average
      merged[key] = merged[key] * (1 - learningRate) + value * learningRate;
    } else {
      merged[key] = value * learningRate;
    }
  });

  // Remove very weak preferences (noise reduction)
  Object.entries(merged).forEach(([key, value]) => {
    if (Math.abs(value) < 0.1) {
      delete merged[key];
    }
  });

  return merged;
}

/**
 * Detect engagement style from behavior patterns
 */
function detectEngagementStyle(
  behaviors: UserBehavior[]
): "likes" | "comments" | "shares" | "saves" | "mixed" {
  const actionCounts: Record<string, number> = {};

  behaviors.forEach((b) => {
    if (["like", "comment", "share", "save"].includes(b.action)) {
      actionCounts[b.action] = (actionCounts[b.action] || 0) + 1;
    }
  });

  const sorted = Object.entries(actionCounts).sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return "mixed";

  const topAction = sorted[0][0];
  const topCount = sorted[0][1];
  const secondCount = sorted[1]?.[1] || 0;

  // If top action is significantly more frequent, use it
  if (topCount > secondCount * 1.5) {
    return topAction as "likes" | "comments" | "shares" | "saves";
  }

  return "mixed";
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

    const body = (await req.json().catch(() => ({}))) as UserBehavior;
    const { postId, action, duration = 0, scrollDepth = 0, postMetadata = {} } = body;

    if (!postId || !action) {
      return new Response(
        JSON.stringify({ error: "postId and action required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log user behavior
    const { error: logError } = await supabase.from("user_behavior_logs").insert({
      user_id: caller.id,
      post_id: postId,
      action,
      duration,
      scroll_depth: scrollDepth,
      post_metadata: postMetadata,
      created_at: new Date().toISOString(),
    });

    if (logError) {
      console.error("Failed to log behavior:", logError);
    }

    // Get current user preferences
    const { data: prefData } = await supabase
      .from("user_search_preferences")
      .select("preferences, last_updated")
      .eq("user_id", caller.id)
      .maybeSingle();

    let currentPrefs = prefData?.preferences || {};
    const lastUpdated = prefData?.last_updated ? new Date(prefData.last_updated) : new Date(0);

    // Decay preferences based on time since last update
    const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.pow(0.95, daysSinceUpdate);
    currentPrefs = decayPreferences(currentPrefs, decayFactor);

    // Extract new preferences from this behavior
    const newPrefs = extractPreferences({
      userId: caller.id,
      postId,
      action,
      duration,
      scrollDepth,
      timestamp: new Date().toISOString(),
      postMetadata,
    });

    // Merge preferences
    const updatedPrefs = mergePreferences(currentPrefs, newPrefs);

    // Get recent behaviors for engagement style detection
    const { data: recentBehaviors } = await supabase
      .from("user_behavior_logs")
      .select("action")
      .eq("user_id", caller.id)
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(100);

    const engagementStyle = detectEngagementStyle(
      (recentBehaviors || []).map((b: any) => ({ action: b.action }))
    );

    // Upsert user preferences
    const { error: upsertError } = await supabase
      .from("user_search_preferences")
      .upsert(
        {
          user_id: caller.id,
          preferences: updatedPrefs,
          engagement_style: engagementStyle,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Failed to update preferences:", upsertError);
      return new Response(JSON.stringify({ error: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        preferences: updatedPrefs,
        engagementStyle,
        preferencesUpdated: Object.keys(newPrefs).length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("learn-user-preferences error:", error);
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
