import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Board {
  id: string;
  name: string;
  location: string | null;
  postIds: string[];
}

interface BoardsContextValue {
  boards: Board[];
  loading: boolean;
  refresh: () => Promise<void>;
  savePostToBoard: (boardId: string, postId: string) => Promise<void>;
  removePostFromBoard: (boardId: string, postId: string) => Promise<void>;
  createBoard: (name: string, location: string, postId?: string) => Promise<Board | null>;
  isPostSaved: (postId: string) => boolean;
}

const BoardsContext = createContext<BoardsContextValue | null>(null);

export function BoardsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setBoards([]);
      return;
    }
    setLoading(true);
    const { data: b } = await supabase
      .from("boards")
      .select("id, name, location")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    const ids = (b ?? []).map((x) => x.id);
    let bp: { board_id: string; post_id: string }[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("board_posts")
        .select("board_id, post_id")
        .in("board_id", ids);
      bp = data ?? [];
    }
    const grouped = new Map<string, string[]>();
    for (const r of bp) {
      const arr = grouped.get(r.board_id) ?? [];
      arr.push(r.post_id);
      grouped.set(r.board_id, arr);
    }
    setBoards(
      (b ?? []).map((x) => ({
        id: x.id,
        name: x.name,
        location: x.location,
        postIds: grouped.get(x.id) ?? [],
      })),
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const savePostToBoard = useCallback(
    async (boardId: string, postId: string) => {
      const { error } = await supabase
        .from("board_posts")
        .insert({ board_id: boardId, post_id: postId });
      // ignore unique violation if already saved
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
      setBoards((prev) =>
        prev.map((b) =>
          b.id === boardId && !b.postIds.includes(postId)
            ? { ...b, postIds: [...b.postIds, postId] }
            : b,
        ),
      );
    },
    [],
  );

  const removePostFromBoard = useCallback(
    async (boardId: string, postId: string) => {
      const { error } = await supabase
        .from("board_posts")
        .delete()
        .eq("board_id", boardId)
        .eq("post_id", postId);
      if (error) throw error;
      setBoards((prev) =>
        prev.map((b) =>
          b.id === boardId ? { ...b, postIds: b.postIds.filter((id) => id !== postId) } : b,
        ),
      );
    },
    [],
  );

  const createBoard = useCallback(
    async (name: string, location: string, postId?: string): Promise<Board | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("boards")
        .insert({ owner_id: user.id, name, location: location || null })
        .select("id, name, location")
        .single();
      if (error || !data) return null;
      let postIds: string[] = [];
      if (postId) {
        const ins = await supabase
          .from("board_posts")
          .insert({ board_id: data.id, post_id: postId });
        if (!ins.error) postIds = [postId];
      }
      const b: Board = {
        id: data.id,
        name: data.name,
        location: data.location,
        postIds,
      };
      setBoards((prev) => [b, ...prev]);
      return b;
    },
    [user],
  );

  const isPostSaved = useCallback(
    (postId: string) => boards.some((b) => b.postIds.includes(postId)),
    [boards],
  );

  return (
    <BoardsContext.Provider
      value={{ boards, loading, refresh, savePostToBoard, removePostFromBoard, createBoard, isPostSaved }}
    >
      {children}
    </BoardsContext.Provider>
  );
}

export function useBoards() {
  const ctx = useContext(BoardsContext);
  if (!ctx) throw new Error("useBoards must be within BoardsProvider");
  return ctx;
}
