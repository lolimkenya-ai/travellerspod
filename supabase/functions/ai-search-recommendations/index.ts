// Edge function: ai-search-recommendations
// AI-powered search with real-time population and smart recommendations
// Learns user preferences and provides contextual suggestions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SearchQuery {
  query: string;
  userId: string;
  filters?: {
    priceRange?: [number, number];
    rating?: number;
    location?: string;
    businessType?: string;
  };
  limit?: number;
  offset?: number;
}

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

interface RecommendationResult {
  results: SearchResult[];
  suggestions: string[];
  userPreferences: Record<string, number>;
  executionTime: number;
}

/**
 * Generate smart search suggestions based on query and user history
 */
async function generateSearchSuggestions(
  query: string,
  userId: string
): Promise<string[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return [];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4-mini",
        messages: [
          {
            role: "system",
            content: `You are a travel marketplace search assistant. Generate 5 smart search suggestions based on user query.
Focus on: specific destinations, accommodation types, activities, budget ranges, travel styles.
Respond ONLY with a JSON array: ["suggestion1", "suggestion2", ...]`,
          },
          {
            role: "user",
            content: `User searched for: "${query}". Generate 5 related search suggestions.`,
          },
        ],
        temperature: 0.6,
        max_tokens: 150,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]).slice(0, 5);
  } catch (error) {
    console.error("Search suggestions error:", error);
    return [];
  }
}

/**
 * Calculate relevance score for search results
 */
function calculateRelevanceScore(
  query: string,
  content: Record<string, any>,
  userPreferences: Record<string, number>
): { score: number; matchedFields: string[] } {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const matchedFields: string[] = [];
  let baseScore = 0;

  // Check title
  const title = (content.title || content.display_name || "").toLowerCase();
  const titleMatches = queryTerms.filter((term) => title.includes(term)).length;
  if (titleMatches > 0) {
    baseScore += titleMatches * 30;
    matchedFields.push("title");
  }

  // Check description/caption
  const description = (content.description || content.caption || "").toLowerCase();
  const descMatches = queryTerms.filter((term) => description.includes(term)).length;
  if (descMatches > 0) {
    baseScore += descMatches * 15;
    matchedFields.push("description");
  }

  // Check tags/categories
  const tags = (content.tags || []).map((t: string) => t.toLowerCase());
  const tagMatches = queryTerms.filter((term) => tags.some((tag) => tag.includes(term))).length;
  if (tagMatches > 0) {
    baseScore += tagMatches * 20;
    matchedFields.push("tags");
  }

  // Apply user preference boost
  let preferenceBoost = 0;
  for (const [pref, weight] of Object.entries(userPreferences)) {
    if (description.includes(pref.toLowerCase()) || title.includes(pref.toLowerCase())) {
      preferenceBoost += weight * 10;
    }
  }

  // Normalize score to 0-100
  const finalScore = Math.min(baseScore + preferenceBoost, 100);

  return {
    score: finalScore,
    matchedFields,
  };
}

/**
 * Fetch and rank search results
 */
async function performSearch(
  supabase: any,
  query: SearchQuery
): Promise<SearchResult[]> {
  const { query: searchQuery, userId, filters = {}, limit = 20, offset = 0 } = query;

  try {
    // Get user preferences
    const { data: userPrefs } = await supabase
      .from("user_search_preferences")
      .select("preferences")
      .eq("user_id", userId)
      .maybeSingle();

    const userPreferences = userPrefs?.preferences || {};

    // Search posts
    const { data: posts } = await supabase
      .from("posts")
      .select(
        `id, caption, media_type, likes_count, created_at, 
         author:author_id(id, display_name, nametag, avatar_url, verified),
         category`
      )
      .ilike("caption", `%${searchQuery}%`)
      .eq("removed_at", null)
      .order("created_at", { ascending: false })
      .limit(limit)
      .offset(offset);

    // Search businesses
    const { data: businesses } = await supabase
      .from("profiles")
      .select(
        `id, display_name, nametag, avatar_url, verified, account_type,
         business_details(business_name, description, website)`
      )
      .or(`display_name.ilike.%${searchQuery}%,nametag.ilike.%${searchQuery}%`)
      .eq("account_type", "business")
      .limit(limit)
      .offset(offset);

    // Combine and rank results
    const results: SearchResult[] = [];

    // Add posts
    if (posts) {
      posts.forEach((post: any) => {
        const { score, matchedFields } = calculateRelevanceScore(
          searchQuery,
          {
            title: post.author?.display_name,
            caption: post.caption,
            tags: post.category ? [post.category] : [],
          },
          userPreferences
        );

        results.push({
          id: post.id,
          type: "post",
          title: post.author?.display_name || "Unknown",
          description: post.caption,
          relevanceScore: score,
          matchedFields,
          userPreferenceMatch: Object.values(userPreferences).reduce((a: number, b: number) => a + b, 0) as number,
          metadata: {
            likes: post.likes_count,
            author: post.author,
            category: post.category,
            createdAt: post.created_at,
          },
        });
      });
    }

    // Add businesses
    if (businesses) {
      businesses.forEach((business: any) => {
        const { score, matchedFields } = calculateRelevanceScore(
          searchQuery,
          {
            title: business.display_name,
            description: business.business_details?.[0]?.description,
            tags: [business.account_type],
          },
          userPreferences
        );

        results.push({
          id: business.id,
          type: "business",
          title: business.display_name,
          description: business.business_details?.[0]?.description || "Travel business",
          relevanceScore: score,
          matchedFields,
          userPreferenceMatch: Object.values(userPreferences).reduce((a: number, b: number) => a + b, 0) as number,
          metadata: {
            verified: business.verified,
            website: business.business_details?.[0]?.website,
            businessName: business.business_details?.[0]?.business_name,
          },
        });
      });
    }

    // Sort by relevance score
    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (error) {
    console.error("Search error:", error);
    return [];
  }
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

    const startTime = Date.now();
    const body = (await req.json().catch(() => ({}))) as SearchQuery;
    const { query, filters, limit = 20, offset = 0 } = body;

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform search
    const searchQuery: SearchQuery = {
      query,
      userId: caller.id,
      filters,
      limit,
      offset,
    };

    const results = await performSearch(supabase, searchQuery);

    // Generate suggestions
    const suggestions = await generateSearchSuggestions(query, caller.id);

    // Get user preferences
    const { data: userPrefs } = await supabase
      .from("user_search_preferences")
      .select("preferences")
      .eq("user_id", caller.id)
      .maybeSingle();

    const executionTime = Date.now() - startTime;

    // Log search for analytics
    try {
      await supabase.from("search_analytics_logs").insert({
        user_id: caller.id,
        query,
        results_count: results.length,
        execution_time_ms: executionTime,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log search:", error);
    }

    return new Response(
      JSON.stringify({
        results,
        suggestions,
        userPreferences: userPrefs?.preferences || {},
        executionTime,
      } as RecommendationResult),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("ai-search-recommendations error:", error);
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
