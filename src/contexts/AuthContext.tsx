import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User as SupaUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export interface AuthProfile {
  id: string;
  nametag: string;
  display_name: string;
  avatar_url: string | null;
  account_type: "personal" | "business" | "organization";
  verified: boolean;
}

interface AuthContextValue {
  user: SupaUser | null;
  profile: AuthProfile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string,
    meta: { display_name: string; account_type: AuthProfile["account_type"] },
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  showSignUp: boolean;
  promptSignUp: () => void;
  closeSignUp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignUp, setShowSignUp] = useState(false);

  useEffect(() => {
    // 1. Subscribe FIRST to avoid missing events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer DB call to avoid deadlocks inside the callback
        setTimeout(() => loadProfile(session.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    // 2. Then check existing session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nametag, display_name, avatar_url, account_type, verified")
      .eq("id", userId)
      .maybeSingle();
    if (!error && data) setProfile(data as AuthProfile);
  }

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    showSignUp,
    promptSignUp: () => setShowSignUp(true),
    closeSignUp: () => setShowSignUp(false),
    signInWithEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      setShowSignUp(false);
      toast.success("Welcome back");
      return {};
    },
    signUpWithEmail: async (email, password, meta) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: meta,
        },
      });
      if (error) return { error: error.message };
      setShowSignUp(false);
      toast.success("Account created — you’re in.");
      return {};
    },
    signInWithGoogle: async () => {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/`,
      });
      if ("error" in result && result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
      }
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Wraps an action that requires auth — opens signup sheet if not signed in. */
export function useRequireAuth() {
  const { user, promptSignUp } = useAuth();
  return (action: () => void) => {
    if (!user) {
      promptSignUp();
      return false;
    }
    action();
    return true;
  };
}
