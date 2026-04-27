// Edge function: ai-content-assistant
// AI-powered content generation for users
// Generates captions, travel tips, and content suggestions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ContentAssistantRequest {
  type: "caption" | "tips" | "hashtags" | "description";
  context: string;
  tone?: "casual" | "professional" | "funny" | "inspirational";
  length?: "short" | "medium" | "long";
}

interface ContentAssistantResponse {
  type: string;
  content: string | string[];
  suggestions: string[];
  confidence: number;
}

async function generateCaption(
  context: string,
  tone: string = "casual",
  length: string = "medium"
): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return "";

  try {
    const lengthGuide = {
      short: "50-100 characters",
      medium: "100-200 characters",
      long: "200-300 characters",
    };

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
            content: `You are a creative social media caption writer for a travel marketplace. 
Write engaging, authentic captions that encourage engagement and bookings.
Tone: ${tone}
Length: ${lengthGuide[length as keyof typeof lengthGuide]}
Include relevant emojis but don't overuse them.
Make it feel genuine and not overly promotional.`,
          },
          {
            role: "user",
            content: `Write a caption for this travel post: "${context}"`,
          },
        ],
        temperature: 0.8,
        max_tokens: 150,
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Caption generation error:", error);
    return "";
  }
}

async function generateTravelTips(
  destination: string,
  category: string = "general"
): Promise<string[]> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return [];

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
            content: `You are a travel expert for East Africa (Kenya, Tanzania, Uganda).
Generate practical, actionable travel tips.
Focus on: safety, budget, culture, best times to visit, local experiences.
Respond ONLY with a JSON array of strings: ["tip1", "tip2", "tip3", "tip4", "tip5"]`,
          },
          {
            role: "user",
            content: `Generate 5 travel tips for ${destination} (category: ${category})`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";

    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const tips = JSON.parse(jsonMatch[0]);
    return Array.isArray(tips) ? tips.slice(0, 5) : [];
  } catch (error) {
    console.error("Travel tips generation error:", error);
    return [];
  }
}

async function generateHashtags(context: string): Promise<string[]> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return [];

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
            content: `Generate relevant hashtags for travel content.
Focus on: travel, destinations, experiences, local culture.
Include mix of popular and niche hashtags.
Respond ONLY with a JSON array: ["#hashtag1", "#hashtag2", ...]`,
          },
          {
            role: "user",
            content: `Generate 10 hashtags for: "${context}"`,
          },
        ],
        temperature: 0.6,
        max_tokens: 200,
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";

    // Extract JSON array
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const hashtags = JSON.parse(jsonMatch[0]);
    return Array.isArray(hashtags) ? hashtags.slice(0, 15) : [];
  } catch (error) {
    console.error("Hashtag generation error:", error);
    return [];
  }
}

async function generateBusinessDescription(
  businessName: string,
  businessType: string,
  highlights: string
): Promise<string> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return "";

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
            content: `You are a professional copywriter for travel businesses.
Write compelling, SEO-friendly business descriptions.
Include: what they offer, unique selling points, target audience.
Keep it concise (150-200 words) and engaging.`,
          },
          {
            role: "user",
            content: `Write a description for: ${businessName} (${businessType}). Highlights: ${highlights}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 250,
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("Description generation error:", error);
    return "";
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

    const body = (await req.json().catch(() => ({}))) as ContentAssistantRequest;
    const { type, context, tone = "casual", length = "medium" } = body;

    if (!type || !context) {
      return new Response(
        JSON.stringify({ error: "type and context required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let content: string | string[] = "";
    let suggestions: string[] = [];

    switch (type) {
      case "caption": {
        content = await generateCaption(context, tone, length);
        suggestions = await generateHashtags(context);
        break;
      }

      case "tips": {
        content = await generateTravelTips(context);
        suggestions = content.slice(0, 3) as string[];
        break;
      }

      case "hashtags": {
        content = await generateHashtags(context);
        suggestions = (content as string[]).slice(0, 5);
        break;
      }

      case "description": {
        const parts = context.split("|");
        content = await generateBusinessDescription(
          parts[0] || "Business",
          parts[1] || "Travel Business",
          parts[2] || "Quality service"
        );
        suggestions = [];
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "invalid type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Log usage for analytics
    try {
      await supabase.from("ai_usage_logs").insert({
        user_id: caller.id,
        feature_type: type,
        tokens_used: Math.ceil((context.length + JSON.stringify(content).length) / 4),
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to log AI usage:", error);
    }

    return new Response(
      JSON.stringify({
        type,
        content,
        suggestions,
        confidence: 0.85,
      } as ContentAssistantResponse),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("ai-content-assistant error:", error);
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
