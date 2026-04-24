import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Server-enforced rate limit with friendly UI fallback.
 * Caller still receives an error from the server if exceeded; we surface a toast.
 */
export async function rateLimit(
  action: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    _action: action,
    _max: max,
    _window_seconds: windowSeconds,
  });
  if (error) {
    if (/rate limit/i.test(error.message)) {
      toast.error("You're going a bit fast — try again in a moment.");
    } else if (/auth/i.test(error.message)) {
      toast.error("Please sign in first.");
    } else {
      toast.error(error.message);
    }
    return false;
  }
  return !!data;
}

/** Lightweight client-side cooldown to discourage rapid-fire clicks. */
const lastFired = new Map<string, number>();
export function clientCooldown(action: string, ms: number): boolean {
  const now = Date.now();
  const prev = lastFired.get(action) ?? 0;
  if (now - prev < ms) return false;
  lastFired.set(action, now);
  return true;
}
