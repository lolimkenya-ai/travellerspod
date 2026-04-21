import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface SeenPostsContextValue {
  seen: Set<string>;
  markSeen: (id: string) => void;
  reset: () => void;
}

const SeenPostsContext = createContext<SeenPostsContextValue | null>(null);

export function SeenPostsProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => setSeen(new Set()), []);

  return <SeenPostsContext.Provider value={{ seen, markSeen, reset }}>{children}</SeenPostsContext.Provider>;
}

export function useSeenPosts() {
  const ctx = useContext(SeenPostsContext);
  if (!ctx) throw new Error("useSeenPosts must be within SeenPostsProvider");
  return ctx;
}
