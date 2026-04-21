import { Link } from "react-router-dom";
import { MapPin, Plus } from "lucide-react";
import { useBoards } from "@/contexts/BoardsContext";
import { useAuth } from "@/contexts/AuthContext";

export default function Boards() {
  const { boards } = useBoards();
  const { user, promptSignUp } = useAuth();

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

  return (
    <div className="p-4">
      <button className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-4 text-sm font-semibold text-muted-foreground hover:border-foreground hover:text-foreground">
        <Plus className="h-4 w-4" /> New Trip Board
      </button>
      <div className="grid grid-cols-2 gap-3">
        {boards.map((b) => (
          <Link
            key={b.id}
            to={`/boards/${b.id}`}
            className="group overflow-hidden rounded-2xl border border-border bg-card"
          >
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
              <p className="mt-1 text-xs text-muted-foreground">{b.postIds.length} saved</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
