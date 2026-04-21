import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin } from "lucide-react";
import { useBoards } from "@/contexts/BoardsContext";
import { POSTS } from "@/data/posts";

export default function BoardDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { boards } = useBoards();
  const board = boards.find((b) => b.id === id);

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

  const posts = POSTS.filter((p) => board.postIds.includes(p.id));

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">{board.name}</h1>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-secondary" />
            <span>{board.location}</span>
            <span aria-hidden>·</span>
            <span>{board.postIds.length} saved</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-px bg-border p-px">
        {posts.map((p) => (
          <div key={p.id} className="aspect-square overflow-hidden bg-muted">
            {p.media.type === "image" && (
              <img src={p.media.src} alt={p.caption} className="h-full w-full object-cover" />
            )}
            {p.media.type === "video" && (
              <img src={p.media.poster} alt={p.caption} className="h-full w-full object-cover" />
            )}
            {p.media.type === "text" && (
              <div
                className="flex h-full w-full items-center justify-center p-3 text-center text-xs font-bold"
                style={{ background: p.media.background, color: p.media.foreground }}
              >
                <p className="line-clamp-6">{p.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
