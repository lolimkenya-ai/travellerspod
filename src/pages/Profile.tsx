import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MapPin, Settings, Briefcase } from "lucide-react";
import { useState } from "react";
import { ALL_USERS } from "@/data/users";
import { POSTS } from "@/data/posts";
import { useBoards } from "@/contexts/BoardsContext";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS = ["Posts", "Reposts", "Boards"] as const;
type Tab = (typeof TABS)[number];

export default function Profile() {
  const { nametag = "" } = useParams();
  const navigate = useNavigate();
  const user = ALL_USERS.find((u) => u.nametag === nametag) ?? ALL_USERS[0];
  const [tab, setTab] = useState<Tab>("Posts");
  const { boards } = useBoards();

  const posts = POSTS.filter((p) => p.authorId === user.id);

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">@{user.nametag}</h1>
        <button aria-label="Settings" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 pt-5">
        <div className="flex items-start gap-4">
          <img src={user.avatar} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-border" />
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-1">
              <h2 className="text-lg font-bold text-foreground">{user.displayName}</h2>
              {user.verified && <BadgeCheck className="h-5 w-5 fill-verified text-verified-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">@{user.nametag}</p>
            <div className="mt-2 flex items-center gap-2">
              {user.accountType === "business" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-verified/15 px-2 py-0.5 text-xs font-semibold text-verified">
                  <Briefcase className="h-3 w-3" /> Business · {user.category}
                </span>
              )}
              {user.accountType === "organization" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                  Organization
                </span>
              )}
            </div>
          </div>
        </div>

        {user.bio && <p className="mt-3 text-sm text-foreground">{user.bio}</p>}

        <div className="mt-4 flex items-center gap-5 text-sm">
          <span><span className="font-semibold text-foreground">{formatCount(user.followers)}</span> <span className="text-muted-foreground">followers</span></span>
          <span><span className="font-semibold text-foreground">{formatCount(user.following)}</span> <span className="text-muted-foreground">following</span></span>
          <span><span className="font-semibold text-foreground">{posts.length}</span> <span className="text-muted-foreground">posts</span></span>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-full bg-foreground py-2 text-sm font-semibold text-background hover:bg-foreground/90">
            Follow
          </button>
          <button
            onClick={() => navigate(`/messages/conv-${user.id}?to=${user.id}`)}
            className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground hover:bg-accent"
          >
            Message
          </button>
        </div>
      </div>

      <nav className="mt-6 flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 border-b-2 py-3 text-sm font-semibold transition-colors",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Posts" && (
        <div className="grid grid-cols-3 gap-px bg-border">
          {posts.map((p) => (
            <div key={p.id} className="aspect-square overflow-hidden bg-muted">
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
          {posts.length === 0 && (
            <p className="col-span-3 py-12 text-center text-sm text-muted-foreground">No posts yet.</p>
          )}
        </div>
      )}

      {tab === "Reposts" && (
        <p className="py-12 text-center text-sm text-muted-foreground">No reposts yet.</p>
      )}

      {tab === "Boards" && (
        <div className="grid grid-cols-2 gap-3 p-4">
          {boards.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid aspect-square grid-cols-2 gap-px bg-border">
                {Array.from({ length: 4 }).map((_, i) => {
                  const src = b.cover[i];
                  return src ? (
                    <img key={i} src={src} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div key={i} className="h-full w-full bg-muted" />
                  );
                })}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-foreground">{b.name}</p>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 text-secondary" />
                  <span className="truncate">{b.location}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
