import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Roles {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
}

/** Reads role memberships server-side (never trust client claims). */
export function useRoles(): Roles {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<Roles>({
    isSuperAdmin: false,
    isAdmin: false,
    isModerator: false,
    loading: true,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't query until auth has finished loading
    if (authLoading) return;

    let cancelled = false;

    if (!user) {
      setRoles({ isSuperAdmin: false, isAdmin: false, isModerator: false, loading: false });
      return;
    }

    // Safety timeout — never leave loading: true forever
    timeoutRef.current = setTimeout(() => {
      if (!cancelled) {
        console.warn("⏱️ useRoles timeout — clearing loading state");
        setRoles((prev) => ({ ...prev, loading: false }));
      }
    }, 6000);

    (async () => {
      try {
        // Allow the server to promote to super_admin on first sign-in
        try { await supabase.rpc("ensure_super_admin"); } catch { /* ignore */ }

        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (error) {
          console.error("❌ useRoles error:", error);
          setRoles({ isSuperAdmin: false, isAdmin: false, isModerator: false, loading: false });
          return;
        }

        const set = new Set((data ?? []).map((r) => r.role as string));
        const isSuperAdmin = set.has("super_admin");
        const isAdmin = set.has("admin") || isSuperAdmin;
        const isModerator = set.has("moderator") || isAdmin;

        setRoles({ isSuperAdmin, isAdmin, isModerator, loading: false });
      } catch (err) {
        console.error("❌ useRoles unexpected error:", err);
        if (!cancelled) {
          setRoles({ isSuperAdmin: false, isAdmin: false, isModerator: false, loading: false });
        }
      } finally {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    })();

    return () => {
      cancelled = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user, authLoading]);

  return roles;
}
