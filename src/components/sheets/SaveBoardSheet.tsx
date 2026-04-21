import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, MapPin } from "lucide-react";
import { useState } from "react";
import { useBoards } from "@/contexts/BoardsContext";
import { toast } from "sonner";
import type { Post } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: Post;
}

export function SaveBoardSheet({ open, onOpenChange, post }: Props) {
  const { boards, savePostToBoard, createBoard } = useBoards();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState(post.location);

  const handleSave = (boardId: string) => {
    savePostToBoard(boardId, post.id);
    toast.success("Saved to board");
    onOpenChange(false);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const b = createBoard(name.trim(), location.trim() || post.location, post.id);
    toast.success(`Created "${b.name}"`);
    setName("");
    setCreating(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>Save to Trip Board</SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(70vh-58px)] flex-col overflow-y-auto">
          {!creating ? (
            <>
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-accent"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                  <Plus className="h-5 w-5 text-foreground" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">New board</p>
                  <p className="text-xs text-muted-foreground">Create a board for this trip</p>
                </div>
              </button>
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSave(b.id)}
                  className="flex items-center gap-3 border-b border-border/50 px-4 py-3 text-left hover:bg-accent"
                >
                  <div className="grid h-12 w-12 grid-cols-2 gap-px overflow-hidden rounded-xl bg-muted">
                    {b.cover.slice(0, 4).map((src, i) => (
                      <img key={i} src={src} alt="" className="h-full w-full object-cover" />
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{b.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 text-secondary" />
                      {b.location}
                      <span aria-hidden>·</span>
                      <span>{b.postIds.length} saved</span>
                    </div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div className="space-y-3 p-4">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Board name (e.g. Bali 2026)"
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Location"
                className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setCreating(false)}
                  className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name.trim()}
                  className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Create board
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
