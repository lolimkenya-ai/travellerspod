import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon, TrendingUp, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useDebouncedSearch } from "@/hooks/useAdvancedAI";

const TRENDING = ["Safari Kenya", "Zanzibar hotels", "Budget Nairobi", "Kilimanjaro hike", "Serengeti tours"];

export default function Search() {
  const navigate = useNavigate();
  const { query, setQuery, results, suggestions, loading, executionTime } = useDebouncedSearch(300);

  // Group results by type
  const userMatches = results.filter(r => r.type === 'business');
  const postMatches = results.filter(r => r.type === 'post');

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full bg-muted px-4 py-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, places, posts"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
      </header>

      <div className="p-4">
        {!query && (
          <>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" /> Trending now
            </h2>
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button
                  key={t}
                  onClick={() => setQuery(t)}
                  className="rounded-full bg-muted px-4 py-2 text-sm text-foreground hover:bg-accent"
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {query && suggestions.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Suggestions</h3>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {query && userMatches.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creators & Businesses</h3>
            <div className="space-y-1">
              {userMatches.map((u) => (
                <Link
                  key={u.id}
                  to={`/profile/${u.id}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent"
                >
                  <img src={u.metadata?.avatar_url || "/placeholder.svg"} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-foreground">{u.title}</p>
                      {u.metadata?.verified && <div className="h-3 w-3 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {query && postMatches.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posts</h3>
              {executionTime > 0 && <span className="text-[10px] text-muted-foreground">{executionTime}ms</span>}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {postMatches.map((p) => (
                <Link key={p.id} to={`/post/${p.id}`} className="aspect-square overflow-hidden rounded-lg bg-muted relative group">
                  <img 
                    src={p.metadata?.media_url || "/placeholder.svg"} 
                    alt="" 
                    className="h-full w-full object-cover transition-transform group-hover:scale-105" 
                  />
                  <div className="absolute bottom-1 right-1 rounded bg-black/50 px-1 text-[10px] text-white">
                    {p.relevanceScore}%
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {query && !loading && results.length === 0 && (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
            <p className="mt-1 text-xs text-muted-foreground">Try searching for destinations or activities.</p>
          </div>
        )}
      </div>
    </div>
  );
}
