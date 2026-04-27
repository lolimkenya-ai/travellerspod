// Edge function: verify-business-ai
// Enhanced business verification using OpenAI API
// Analyzes business details, website credibility, and risk factors

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerificationAnalysis {
  riskLevel: "low" | "medium" | "high" | "unknown";
  credibilityScore: number;
  findings: string[];
  recommendations: string[];
  summary: string;
}

async function analyzeBusinessCredibility(
  businessData: Record<string, any>
): Promise<VerificationAnalysis> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    return {
      riskLevel: "unknown",
      credibilityScore: 0,
      findings: ["AI verification unavailable"],
      recommendations: ["Manual review required"],
      summary: "Unable to perform AI verification",
    };
  }

  try {
    const prompt = `You are a business verification expert for a travel marketplace in Kenya/Tanzania. 
Analyze the following business information for credibility and fraud risk:

Business Name: ${businessData.business_name || "N/A"}
Website: ${businessData.website || "N/A"}
Email: ${businessData.email || "N/A"}
Phone: ${businessData.phone || "N/A"}
TRA Listing: ${businessData.tra_listing_url || "N/A"}
KATA Listing: ${businessData.kata_listing_url || "N/A"}
KATO Listing: ${businessData.kato_listing_url || "N/A"}
Description: ${businessData.description || "N/A"}
Years in Business: ${businessData.years_in_business || "N/A"}

Assess:
1. Website legitimacy (domain age, SSL, professional design)
2. Registry verification (TRA/KATA/KATO presence)
3. Contact information consistency
4. Red flags (new business, missing info, suspicious patterns)
5. Overall risk level

Respond ONLY with valid JSON: {
  "riskLevel": "low|medium|high",
  "credibilityScore": 0-100,
  "findings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2"],
  "summary": "brief summary"
}`;

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
            content:
              "You are a business verification expert. Respond ONLY with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("OpenAI verification error:", response.status, error);
      return {
        riskLevel: "unknown",
        credibilityScore: 0,
        findings: ["AI verification failed"],
        recommendations: ["Manual review recommended"],
        summary: "Verification check failed",
      };
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]);

    return {
      riskLevel: ["low", "medium", "high"].includes(result.riskLevel)
        ? result.riskLevel
        : "unknown",
      credibilityScore: Math.min(Math.max(result.credibilityScore || 0, 0), 100),
      findings: Array.isArray(result.findings)
        ? result.findings.slice(0, 10)
        : [],
      recommendations: Array.isArray(result.recommendations)
        ? result.recommendations.slice(0, 5)
        : [],
      summary: result.summary || "No summary provided",
    };
  } catch (error) {
    console.error("Business analysis error:", error);
    return {
      riskLevel: "unknown",
      credibilityScore: 0,
      findings: ["Analysis failed"],
      recommendations: ["Manual review required"],
      summary: "Unable to complete verification",
    };
  }
}

async function checkWebsiteReputation(website: string): Promise<{
  isActive: boolean;
  hasSSL: boolean;
  reputationScore: number;
}> {
  if (!website) {
    return { isActive: false, hasSSL: false, reputationScore: 0 };
  }

  try {
    // Check if website is accessible and has SSL
    const url = website.startsWith("http") ? website : `https://${website}`;
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    }).catch(() => null);

    const isActive = response?.ok || false;
    const hasSSL = url.startsWith("https");

    // Simple reputation check based on domain characteristics
    let reputationScore = 50;
    if (hasSSL) reputationScore += 20;
    if (isActive) reputationScore += 20;
    if (!website.includes("free") && !website.includes("temp")) reputationScore += 10;

    return {
      isActive,
      hasSSL,
      reputationScore: Math.min(reputationScore, 100),
    };
  } catch (error) {
    console.error("Website check error:", error);
    return { isActive: false, hasSSL: false, reputationScore: 0 };
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

    // Check authorization
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const allowed = (roles ?? []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin"
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const profileId = body?.profileId as string | undefined;

    if (!profileId) {
      return new Response(JSON.stringify({ error: "profileId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch profile and business details
    const [{ data: profile }, { data: businessDetails }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      supabase
        .from("business_details")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle(),
    ]);

    if (!profile) {
      return new Response(JSON.stringify({ error: "profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run verification checks in parallel
    const [credibilityAnalysis, websiteReputation] = await Promise.all([
      analyzeBusinessCredibility({
        business_name: profile.display_name,
        ...businessDetails,
      }),
      businessDetails?.website
        ? checkWebsiteReputation(businessDetails.website)
        : Promise.resolve({ isActive: false, hasSSL: false, reputationScore: 0 }),
    ]);

    // Combine results
    const finalRiskLevel =
      credibilityAnalysis.riskLevel === "unknown" &&
      websiteReputation.reputationScore < 40
        ? "high"
        : credibilityAnalysis.riskLevel;

    const finalCredibilityScore = Math.round(
      (credibilityAnalysis.credibilityScore + websiteReputation.reputationScore) /
        2
    );

    // Save verification review
    const { data: reviewId, error: rpcErr } = await supabase.rpc(
      "save_ai_verification_review",
      {
        _profile_id: profileId,
        _summary: credibilityAnalysis.summary,
        _risk_level: finalRiskLevel,
        _findings: [
          ...credibilityAnalysis.findings,
          websiteReputation.isActive
            ? "Website is active and accessible"
            : "Website not accessible",
          websiteReputation.hasSSL
            ? "Website has SSL certificate"
            : "Website lacks SSL certificate",
        ],
        _sources: [
          {
            url: businessDetails?.website || "N/A",
            title: "Business Website",
            org: "website",
          },
          {
            url: businessDetails?.tra_listing_url || "N/A",
            title: "TRA Listing",
            org: "TRA",
          },
          {
            url: businessDetails?.kata_listing_url || "N/A",
            title: "KATA Listing",
            org: "KATA",
          },
        ],
      }
    );

    if (rpcErr) {
      console.error("save_ai_verification_review error", rpcErr);
      return new Response(JSON.stringify({ error: rpcErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        id: reviewId,
        riskLevel: finalRiskLevel,
        credibilityScore: finalCredibilityScore,
        findings: credibilityAnalysis.findings,
        recommendations: credibilityAnalysis.recommendations,
        summary: credibilityAnalysis.summary,
        websiteReputation,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("verify-business-ai error:", error);
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
