// Edge function: moderate-content
// Analyzes post content for policy violations using OpenAI API
// Flags spam, harassment, adult content, misinformation, etc.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ModerationResult {
  flagged: boolean;
  categories: {
    sexual: boolean;
    hate: boolean;
    harassment: boolean;
    self_harm: boolean;
    sexual_minors: boolean;
    violence: boolean;
    violence_graphic: boolean;
  };
  category_scores: Record<string, number>;
  summary: string;
  recommended_action: "approve" | "flag" | "remove";
  confidence: number;
}

async function moderateWithOpenAI(content: string): Promise<ModerationResult> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    console.error("GROQ_API_KEY not configured");
    return {
      flagged: false,
      categories: {
        sexual: false,
        hate: false,
        harassment: false,
        self_harm: false,
        sexual_minors: false,
        violence: false,
        violence_graphic: false,
      },
      category_scores: {},
      summary: "Moderation unavailable",
      recommended_action: "approve",
      confidence: 0,
    };
  }

  try {
    // Use Groq LLM for moderation (since Groq doesn't have a dedicated moderations endpoint)
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a content moderator. Analyze content for policy violations. Return JSON only: {"flagged":bool, "categories":{"sexual":bool,"hate":bool,"harassment":bool,"self_harm":bool,"sexual_minors":bool,"violence":bool,"violence_graphic":bool}, "category_scores":{}, "confidence":0-1}`,
          },
          {
            role: "user",
            content: content.slice(0, 8000),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Groq moderation error:", response.status, error);
      return {
        flagged: false,
        categories: {
          sexual: false,
          hate: false,
          harassment: false,
          self_harm: false,
          sexual_minors: false,
          violence: false,
          violence_graphic: false,
        },
        category_scores: {},
        summary: "Moderation check failed",
        recommended_action: "approve",
        confidence: 0,
      };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    if (!result) {
      throw new Error("No moderation result returned");
    }

    // Determine recommended action based on flagged categories
    let recommended_action: "approve" | "flag" | "remove" = "approve";
    let summary = "Content appears safe";

    if (result.flagged) {
      const flaggedCategories = Object.entries(result.categories)
        .filter(([_, flagged]) => flagged)
        .map(([category, _]) => category);

      if (
        flaggedCategories.includes("sexual_minors") ||
        flaggedCategories.includes("violence_graphic")
      ) {
        recommended_action = "remove";
        summary = `Content violates policy: ${flaggedCategories.join(", ")}`;
      } else if (
        flaggedCategories.includes("sexual") ||
        flaggedCategories.includes("violence") ||
        flaggedCategories.includes("self_harm")
      ) {
        recommended_action = "flag";
        summary = `Content flagged for review: ${flaggedCategories.join(", ")}`;
      } else {
        recommended_action = "flag";
        summary = `Content may violate policy: ${flaggedCategories.join(", ")}`;
      }
    }

    // Calculate confidence based on category scores
    const scores = Object.values(result.category_scores as Record<string, number>);
    const maxScore = Math.max(...scores);
    const confidence = Math.min(maxScore, 1);

    return {
      flagged: result.flagged,
      categories: result.categories,
      category_scores: result.category_scores,
      summary,
      recommended_action,
      confidence,
    };
  } catch (error) {
    console.error("Moderation error:", error);
    return {
      flagged: false,
      categories: {
        sexual: false,
        hate: false,
        harassment: false,
        self_harm: false,
        sexual_minors: false,
        violence: false,
        violence_graphic: false,
      },
      category_scores: {},
      summary: "Moderation check failed",
      recommended_action: "approve",
      confidence: 0,
    };
  }
}

async function analyzeSpamPatterns(content: string): Promise<{
  isSpam: boolean;
  spamScore: number;
  reasons: string[];
}> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return { isSpam: false, spamScore: 0, reasons: [] };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are a spam detection expert for a travel marketplace. Analyze the given content for spam indicators:
- Excessive links or promotional URLs
- Repeated keywords (keyword stuffing)
- Suspicious patterns (cryptocurrency, investment schemes)
- Misleading claims or clickbait
- Bot-like behavior indicators

Respond with a JSON object: { "isSpam": boolean, "spamScore": 0-1, "reasons": ["reason1", "reason2"] }`,
          },
          {
            role: "user",
            content: `Analyze this content for spam: "${content.slice(0, 500)}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return { isSpam: false, spamScore: 0, reasons: [] };
    }

    const data = await response.json();
    const content_text = data.choices[0]?.message?.content || "{}";

    // Extract JSON from response
    const jsonMatch = content_text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isSpam: false, spamScore: 0, reasons: [] };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      isSpam: result.isSpam || false,
      spamScore: Math.min(result.spamScore || 0, 1),
      reasons: Array.isArray(result.reasons) ? result.reasons.slice(0, 5) : [],
    };
  } catch (error) {
    console.error("Spam analysis error:", error);
    return { isSpam: false, spamScore: 0, reasons: [] };
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

    // Require authentication — prevents anonymous abuse of paid LLM calls
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { postId, caption, mediaType } = body;

    if (!postId || !caption) {
      return new Response(
        JSON.stringify({ error: "postId and caption required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Run moderation checks in parallel
    const [moderationResult, spamAnalysis] = await Promise.all([
      moderateWithOpenAI(caption),
      analyzeSpamPatterns(caption),
    ]);

    // Determine overall action
    let finalAction: "approve" | "flag" | "remove" = "approve";
    const reasons: string[] = [];

    if (moderationResult.recommended_action === "remove") {
      finalAction = "remove";
      reasons.push(`Policy violation: ${moderationResult.summary}`);
    } else if (moderationResult.recommended_action === "flag") {
      finalAction = "flag";
      reasons.push(moderationResult.summary);
    }

    if (spamAnalysis.isSpam && spamAnalysis.spamScore > 0.6) {
      if (finalAction === "approve") {
        finalAction = "flag";
      }
      reasons.push(`Spam detected: ${spamAnalysis.reasons.join(", ")}`);
    }

    // Store moderation result
    const { error: insertError } = await supabase
      .from("content_moderation_logs")
      .insert({
        post_id: postId,
        moderation_result: {
          flagged: moderationResult.flagged,
          categories: moderationResult.categories,
          spam_score: spamAnalysis.spamScore,
          is_spam: spamAnalysis.isSpam,
        },
        recommended_action: finalAction,
        reasons,
        confidence: moderationResult.confidence,
      });

    if (insertError) {
      console.error("Failed to store moderation log:", insertError);
    }

    // If content should be auto-flagged, create a report
    if (finalAction === "flag" || finalAction === "remove") {
      const { error: reportError } = await supabase
        .from("content_reports")
        .insert({
          post_id: postId,
          reason: "automated_moderation",
          details: {
            reasons,
            moderation_score: moderationResult.confidence,
            spam_score: spamAnalysis.spamScore,
          },
          status: finalAction === "remove" ? "actioned" : "open",
        });

      if (reportError) {
        console.error("Failed to create content report:", reportError);
      }
    }

    return new Response(
      JSON.stringify({
        postId,
        action: finalAction,
        flagged: moderationResult.flagged || spamAnalysis.isSpam,
        reasons,
        confidence: moderationResult.confidence,
        spamScore: spamAnalysis.spamScore,
        categories: moderationResult.categories,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("moderate-content error:", error);
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
