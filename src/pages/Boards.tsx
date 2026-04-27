import { Link } from "react-router-dom";
import { MapPin, Plus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useBoards } from "@/contexts/BoardsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Cover {
  poster_url: string | null;
  media_url: string | null;
}

export default function Boards() {
  const { boards, loading, createBoard, refresh } = useBoards();
  const { user, promptSignUp } = useAuth();
  const [coversByBoard, setCoversByBoard] = useState<Record<string, Cover[]>>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  // Load up to 4 cover thumbs per board
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, Cover[]> = {};
      for (const b of boards) {
        if (b.postIds.length === 0) {
          next[b.id] = [];
          continue;
        }
        const { data } = await supabase
          .from("posts")
          .select("poster_url, media_url")
          .in("id", b.postIds.slice(0, 4));
        next[b.id] = (data as Cover[]) ?? [];
      }
      if (!cancelled) setCoversByBoard(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [boards]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
        <h2 className="text-lg font-semibold text-foreground">Sign in to create Trip Boards</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Save posts to location-based collections — perfect for planning trips.
        </p>
        <button
          onClick={promptSignUp}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
        >
          Sign up free
        </button>
      </div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const b = await createBoard(name.trim(), location.trim());
    setBusy(false);
    if (b) {
      toast.success(`Created "${b.name}"`);
      setName("");
      setLocation("");
      setCreating(false);
      await refresh();
    } else {
      toast.error("Could not create board");
    }
  };

  return (
    <div className="p-4">
      {!creating ? (
        <button
          onClick={() => setCreating(true)}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> New Trip Board
        </button>
      ) : (
        <div className="mb-4 space-y-2 rounded-2xl border border-border bg-card p-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Board name (e.g. Tokyo Spring '26)"
            className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            className="w-full rounded-xl border border-border bg-muted px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setCreating(false);
                setName("");
                setLocation("");
              }}
              className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || busy}
              className="flex flex-1 items-center justify-center rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-sm font-semibold text-foreground">No boards yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap "Save to Trip Board" on any post to start organizing your travels.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {boards.map((b) => {
            const covers = coversByBoard[b.id] ?? [];
            return (
              <Link
                key={b.id}
                to={`/boards/${b.id}`}
                className="group overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="grid aspect-square grid-cols-2 gap-px bg-border">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const c = covers[i];
                    const src = c?.poster_url ?? c?.media_url ?? null;
                    return src ? (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div key={i} className="h-full w-full bg-muted" />
                    );
                  })}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-foreground">{b.name}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {b.location && (
                      <>
                        <MapPin className="h-3 w-3 text-secondary" />
                        <span className="truncate">{b.location}</span>
                      </>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{b.postIds.length} saved</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
