// Lightweight, real-data implementations.
// Older "advanced AI" hooks that depended on RPCs/edge functions which were
// never deployed have been removed. The two used by the app are kept and now
// query Postgres directly.

import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ------------------------------------------------------------------ */
/* Search                                                              */
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

async function sqlSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.trim();
  const results: SearchResult[] = [];

  // Profiles (people + businesses)
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
      relevanceScore: p.is_verified ? 95 : 80,
      matchedFields: ["display_name"],
      userPreferenceMatch: 0,
      metadata: {
        avatar_url: p.avatar_url,
        verified: p.is_verified,
        nametag: p.nametag,
        account_type: p.account_type,
      },
    });
  }

  // Posts — try the GIN-indexed full-text search first, fall back to ilike.
  const tsQuery = q.split(/\s+/).filter(Boolean).join(" & ");
  let posts: any[] = [];
  if (tsQuery) {
    const { data } = await supabase
      .from("posts")
      .select("id, caption, media_url, poster_url, location, author_id, likes_count")
      .textSearch("search_vector", tsQuery, { type: "plain" })
      .is("removed_at", null)
      .order("likes_count", { ascending: false })
      .limit(15);
    posts = data ?? [];
  }
  if (posts.length === 0) {
    const { data } = await supabase
      .from("posts")
      .select("id, caption, media_url, poster_url, location, author_id, likes_count")
      .or(`caption.ilike.%${q}%,location.ilike.%${q}%`)
      .is("removed_at", null)
      .order("likes_count", { ascending: false })
      .limit(15);
    posts = data ?? [];
  }

  for (const p of posts) {
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

export function useAISearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState(0);

  const search = useCallback(async (query: string) => {
    if (!query || query.trim().length === 0) {
      setResults([]);
      setSuggestions([]);
      return;
    }
    setLoading(true);
    setError(null);
    const start = Date.now();
    try {
      const rows = await sqlSearch(query);
      setResults(rows);
      setSuggestions([]);
      setExecutionTime(Date.now() - start);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, suggestions, loading, error, executionTime, search };
}

export function useDebouncedSearch(delayMs: number = 300) {
  const { search, results, suggestions, loading, error, executionTime } = useAISearch();
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) return;
    debounceRef.current = setTimeout(() => {
      search(query);
    }, delayMs);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, delayMs, search]);

  return { query, setQuery, results, suggestions, loading, error, executionTime };
}
