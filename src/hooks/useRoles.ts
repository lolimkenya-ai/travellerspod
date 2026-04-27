import { useEffect, useState } from "react";
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
  const { user } = useAuth();
  const [roles, setRoles] = useState<Roles>({
    isSuperAdmin: false,
    isAdmin: false,
    isModerator: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles({ isSuperAdmin: false, isAdmin: false, isModerator: false, loading: false });
      return;
    }

    (async () => {
      // First, give the server a chance to grant super_admin if this is the
      // configured super-admin email signing in for the first time.
      try { await supabase.rpc("ensure_super_admin"); } catch { /* ignore */ }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (cancelled) return;
      const set = new Set((data ?? []).map((r) => r.role as string));
      const isSuperAdmin = set.has("super_admin");
      const isAdmin = set.has("admin") || isSuperAdmin;
      const isModerator = set.has("moderator") || isAdmin;

      setRoles({
        isSuperAdmin,
        isAdmin,
        isModerator,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return roles;
}
