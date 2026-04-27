import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBoards } from "@/contexts/BoardsContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BoardRow {
  id: string;
  name: string;
  location: string | null;
  owner_id: string;
}

interface PostThumb {
  id: string;
  caption: string;
  media_type: "image" | "video" | "text";
  media_url: string | null;
  poster_url: string | null;
  text_background: string | null;
  text_foreground: string | null;
}

export default function BoardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { removePostFromBoard } = useBoards();

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [posts, setPosts] = useState<PostThumb[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: b } = await supabase
        .from("boards")
        .select("id, name, location, owner_id")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      setBoard((b as BoardRow) ?? null);
      if (!b) {
        setLoading(false);
        return;
      }
      const { data: bp } = await supabase
        .from("board_posts")
        .select("post_id")
        .eq("board_id", id);
      const ids = (bp ?? []).map((r) => r.post_id);
      if (ids.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      const { data: ps } = await supabase
        .from("posts")
        .select(
          "id, caption, media_type, media_url, poster_url, text_background, text_foreground",
        )
        .in("id", ids);
      if (!cancelled) setPosts((ps as PostThumb[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="mx-auto max-w-[480px] p-8 text-center">
        <p className="text-sm text-muted-foreground">Board not found.</p>
        <Link to="/boards" className="mt-3 inline-block text-sm font-semibold text-primary">
          Back to boards
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === board.owner_id;

  const remove = async (postId: string) => {
    try {
      await removePostFromBoard(board.id, postId);
      setPosts((p) => p.filter((x) => x.id !== postId));
      toast.success("Removed");
    } catch (e: any) {
      toast.error(e.message ?? "Could not remove");
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">{board.name}</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {board.location && (
              <>
                <MapPin className="h-3 w-3 text-secondary" />
                <span>{board.location}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{posts.length} saved</span>
          </div>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-semibold text-foreground">Nothing saved yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap "Save to Trip Board" on a post to add it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border p-px">
          {posts.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden bg-muted">
              {p.media_type === "image" && p.media_url && (
                <img src={p.media_url} alt={p.caption} className="h-full w-full object-cover" />
              )}
              {p.media_type === "video" && (
                <img
                  src={p.poster_url ?? ""}
                  alt={p.caption}
                  className="h-full w-full object-cover"
                />
              )}
              {p.media_type === "text" && (
                <div
                  className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-bold"
                  style={{
                    background: p.text_background ?? "#1E293B",
                    color: p.text_foreground ?? "#F8FAFC",
                  }}
                >
                  <p className="line-clamp-6">{p.caption}</p>
                </div>
              )}
              {isOwner && (
                <button
                  onClick={() => remove(p.id)}
                  aria-label="Remove from board"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/85 text-foreground opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
