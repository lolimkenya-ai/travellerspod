import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { rateLimit } from "@/lib/rateLimit";
import { toast } from "sonner";

/**
 * Persists like state for a single post against `public.post_likes`.
 * Falls back to local optimistic UI for unauthenticated users (and prompts).
 */
export function usePostLike(postId: string, initialCount: number) {
  const { user, promptSignUp } = useAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  // Sync local count when prop changes (e.g., after refetch).
  useEffect(() => setCount(initialCount), [initialCount]);

  // Load current liked-state for this user.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLiked(false);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("post_likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setLiked(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, user]);

  const toggle = useCallback(async () => {
    if (!user) {
      promptSignUp();
      return;
    }
    if (busy) return;
    setBusy(true);

    const ok = await rateLimit("like", 60, 60); // 60 likes per minute
    if (!ok) {
      setBusy(false);
      return;
    }

    // Optimistic
    const wasLiked = liked;
    setLiked(!wasLiked);
    setCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));

    let error: { message: string } | null = null;
    if (wasLiked) {
      const res = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("post_likes")
        .insert({ post_id: postId, user_id: user.id });
      // Ignore duplicate-key errors (already liked).
      if (res.error && (res.error as any).code !== "23505") error = res.error;
    }

    if (error) {
      // Revert optimistic update
      setLiked(wasLiked);
      setCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
      toast.error(error.message);
    }
    setBusy(false);
  }, [busy, liked, postId, promptSignUp, user]);

  return { liked, count, toggle, busy };
}
