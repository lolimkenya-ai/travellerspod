import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search as SearchIcon, TrendingUp } from "lucide-react";
import { useState } from "react";
import { USERS } from "@/data/users";
import { POSTS } from "@/data/posts";

const TRENDING = ["Bali", "Maldives", "Patagonia", "Tokyo ramen", "Safari Kenya", "Niseko powder"];

export default function Search() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const ql = q.toLowerCase();
  const userMatches = ql ? USERS.filter((u) => u.nametag.includes(ql) || u.displayName.toLowerCase().includes(ql)) : [];
  const postMatches = ql
    ? POSTS.filter((p) => p.caption.toLowerCase().includes(ql) || p.location.toLowerCase().includes(ql)).slice(0, 6)
    : [];

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
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search creators, places, posts"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </header>

      <div className="p-4">
        {!q && (
          <>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" /> Trending now
            </h2>
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button
                  key={t}
                  onClick={() => setQ(t)}
                  className="rounded-full bg-muted px-4 py-2 text-sm text-foreground hover:bg-accent"
                >
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {q && userMatches.length > 0 && (
          <section className="mb-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creators</h3>
            <div className="space-y-1">
              {userMatches.map((u) => (
                <Link
                  key={u.id}
                  to={`/profile/${u.nametag}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent"
                >
                  <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{u.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{u.nametag}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {q && postMatches.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posts</h3>
            <div className="grid grid-cols-3 gap-1">
              {postMatches.map((p) => (
                <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-muted">
                  {p.media.type === "image" && <img src={p.media.src} alt="" className="h-full w-full object-cover" />}
                  {p.media.type === "video" && <img src={p.media.poster} alt="" className="h-full w-full object-cover" />}
                  {p.media.type === "text" && (
                    <div
                      className="flex h-full w-full items-center justify-center p-2 text-[10px] font-bold"
                      style={{ background: p.media.background, color: p.media.foreground }}
                    >
                      <p className="line-clamp-4 text-center">{p.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {q && userMatches.length === 0 && postMatches.length === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">No results for "{q}"</p>
        )}
      </div>
    </div>
  );
}
