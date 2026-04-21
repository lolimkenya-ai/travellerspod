import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { BOARDS } from "@/data/boards";
import type { Board } from "@/data/types";

interface BoardsContextValue {
  boards: Board[];
  savePostToBoard: (boardId: string, postId: string) => void;
  createBoard: (name: string, location: string, postId?: string) => Board;
  isPostSaved: (postId: string) => boolean;
}

const BoardsContext = createContext<BoardsContextValue | null>(null);

export function BoardsProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>(BOARDS);

  const savePostToBoard = useCallback((boardId: string, postId: string) => {
    setBoards((prev) =>
      prev.map((b) =>
        b.id === boardId && !b.postIds.includes(postId)
          ? { ...b, postIds: [...b.postIds, postId] }
          : b,
      ),
    );
  }, []);

  const createBoard = useCallback((name: string, location: string, postId?: string): Board => {
    const newBoard: Board = {
      id: `b${Date.now()}`,
      ownerId: "me",
      name,
      location,
      cover: [],
      postIds: postId ? [postId] : [],
    };
    setBoards((prev) => [newBoard, ...prev]);
    return newBoard;
  }, []);

  const isPostSaved = useCallback(
    (postId: string) => boards.some((b) => b.postIds.includes(postId)),
    [boards],
  );

  return (
    <BoardsContext.Provider value={{ boards, savePostToBoard, createBoard, isPostSaved }}>
      {children}
    </BoardsContext.Provider>
  );
}

export function useBoards() {
  const ctx = useContext(BoardsContext);
  if (!ctx) throw new Error("useBoards must be within BoardsProvider");
  return ctx;
}
