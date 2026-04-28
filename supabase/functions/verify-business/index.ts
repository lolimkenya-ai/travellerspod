// Edge function: verify-business
// Scrapes TRA / KATA / KATO listings + Google reviews using Firecrawl,
// summarises fraud signals via Lovable AI, and stores the result via
// the save_ai_verification_review RPC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Source = { url: string; title?: string; snippet?: string; org?: string };

async function firecrawlSearch(query: string, limit = 5): Promise<Source[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!resp.ok) {
      console.error("firecrawl search failed", resp.status, await resp.text().catch(() => ""));
      return [];
    }
    const json = await resp.json();
    // v2 response shape may include data: [{url,title,description,markdown}] or web: { results: [...] }
    const arr: any[] = json?.data ?? json?.web?.results ?? [];
    return arr.slice(0, limit).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.description ?? r.snippet ?? r.markdown?.slice(0, 240),
    }));
  } catch (e) {
    console.error("firecrawl search exception", e);
    return [];
  }
}

async function firecrawlScrape(url: string): Promise<string> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return "";
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!resp.ok) return "";
    const json = await resp.json();
    return (json?.markdown ?? json?.data?.markdown ?? "").slice(0, 4000);
  } catch {
    return "";
  }
}

async function aiAssess(payload: {
  business: any;
  sources: Source[];
  excerpts: { url: string; text: string }[];
}): Promise<{ summary: string; risk_level: "low" | "medium" | "high" | "unknown"; findings: string[] }> {
  // Support OpenAI key or Gemini key (both speak OpenAI-compatible API)
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const apiKey = openaiKey || geminiKey;

  if (!apiKey) {
    return {
      summary: "AI key not configured. Set OPENAI_API_KEY or GEMINI_API_KEY in Supabase Edge Function secrets.",
      risk_level: "unknown",
      findings: ["Manual review required — no AI key configured."],
    };
  }

  // Choose endpoint + model based on which key is available
  const useGemini = !openaiKey && !!geminiKey;
  const endpoint = useGemini
    ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = useGemini ? "gemini-2.0-flash" : "gpt-4o-mini";

  const system =
    "You are a fraud-risk analyst for a Kenyan travel marketplace (Safiripod). " +
    "Given a business's submitted details and excerpts scraped from official tourism " +
    "registries (TRA, KATA, KATO), the business website, and public Google reviews, " +
    "assess the likelihood that this business is legitimate. " +
    "Look for: registry membership match, website existence, scam complaints, " +
    "consistent contact details, recent activity, and impersonation. " +
    "Respond ONLY by calling the assess_business tool.";

  const tool = {
    type: "function",
    function: {
      name: "assess_business",
      description: "Return a fraud-risk assessment.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "1-2 sentence plain-English summary." },
          risk_level: { type: "string", enum: ["low", "medium", "high", "unknown"] },
          findings: {
            type: "array",
            items: { type: "string" },
            description: "Bulleted concrete findings (each tied to a source if possible).",
          },
        },
        required: ["summary", "risk_level", "findings"],
        additionalProperties: false,
      },
    },
  };

  const user = JSON.stringify(payload).slice(0, 14000);

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "assess_business" } },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("AI error", resp.status, text);
    if (resp.status === 429) {
      return { summary: "AI rate-limited, please retry shortly.", risk_level: "unknown", findings: [] };
    }
    return { summary: `AI assessment failed (${resp.status}).`, risk_level: "unknown", findings: [] };
  }
  const json = await resp.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return { summary: "No assessment returned.", risk_level: "unknown", findings: [] };
  try {
    const args = JSON.parse(call.function.arguments);
    return {
      summary: String(args.summary ?? ""),
      risk_level: ["low", "medium", "high", "unknown"].includes(args.risk_level) ? args.risk_level : "unknown",
      findings: Array.isArray(args.findings) ? args.findings.slice(0, 12).map(String) : [],
    };
  } catch {
    return { summary: "AI returned malformed output.", risk_level: "unknown", findings: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
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

    // Caller must be admin / super_admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
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

    const [{ data: profile }, { data: biz }] = await Promise.all([
      supabase.from("profiles").select("display_name, nametag").eq("id", profileId).maybeSingle(),
      supabase.from("business_details").select("*").eq("profile_id", profileId).maybeSingle(),
    ]);
    if (!profile) {
      return new Response(JSON.stringify({ error: "profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = profile.display_name;
    const queries = [
      `${name} site:tra.go.tz`,
      `${name} site:kata.co.ke`,
      `${name} site:kato.travel OR site:katokenya.org`,
      `${name} Kenya travel reviews`,
      `${name} scam OR complaint`,
    ];
    if (biz?.website) queries.push(`${name} ${biz.website}`);

    const allSources: Source[] = [];
    for (const q of queries) {
      const r = await firecrawlSearch(q, 4);
      r.forEach((s) => {
        if (!allSources.find((e) => e.url === s.url)) {
          let org = "web";
          if (/tra\.go\.tz/i.test(s.url)) org = "TRA";
          else if (/kata\.co\.ke/i.test(s.url)) org = "KATA";
          else if (/kato\./i.test(s.url)) org = "KATO";
          else if (/google\.com\/maps|google\.com\/search/i.test(s.url)) org = "Google";
          allSources.push({ ...s, org });
        }
      });
    }

    // Scrape top 3 sources for excerpts to feed AI.
    const top = allSources.slice(0, 3);
    const excerpts: { url: string; text: string }[] = [];
    for (const s of top) {
      const text = await firecrawlScrape(s.url);
      if (text) excerpts.push({ url: s.url, text });
    }

    const ai = await aiAssess({ business: { ...profile, ...biz }, sources: allSources, excerpts });

    // Persist review via RPC (forwards caller auth, so RLS check passes).
    const { data: reviewId, error: rpcErr } = await supabase.rpc("save_ai_verification_review", {
      _profile_id: profileId,
      _summary: ai.summary,
      _risk_level: ai.risk_level,
      _findings: ai.findings,
      _sources: allSources,
    });
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
        summary: ai.summary,
        risk_level: ai.risk_level,
        findings: ai.findings,
        sources: allSources,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-business error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
