import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User as SupaUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
    try {
      // First, try to get the existing profile
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nametag, display_name, avatar_url, account_type, verified")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data as AuthProfile);
        return;
      }

      // If no profile exists, create one (handles OAuth sign-ups)
      if (error?.code === "PGRST116" || !data) {
        const user = await supabase.auth.getUser();
        if (user.data?.user) {
          const email = user.data.user.email || "";
          const displayName = user.data.user.user_metadata?.full_name || email.split("@")[0];
          const nametag = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");

          const { data: newProfile, error: createError } = await supabase
            .from("profiles")
            .insert([
              {
                id: userId,
                nametag: nametag || `user_${userId.slice(0, 8)}`,
                display_name: displayName,
                avatar_url: user.data.user.user_metadata?.avatar_url || null,
                account_type: "personal",
                verified: false,
              },
            ])
            .select("id, nametag, display_name, avatar_url, account_type, verified")
            .single();

          if (newProfile) {
            setProfile(newProfile as AuthProfile);
          }
        }
      }
    } catch (err) {
      console.error("Error loading/creating profile:", err);
    }
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
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: meta,
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          // Try to sign them in directly with the password they typed
          const signin = await supabase.auth.signInWithPassword({ email, password });
          if (!signin.error) {
            setShowSignUp(false);
            toast.success("Welcome back — you already had an account.");
            return {};
          }
          return { error: "That email is already registered. Try signing in instead." };
        }
        return { error: error.message };
      }
      // If session is null, auto-confirm is off and user must click email link
      if (!data.session) {
        return { error: "Check your email to confirm your account, then sign in." };
      }
      setShowSignUp(false);
      toast.success("Welcome to Safiripod ✈️");
      return {};
    },
    signInWithGoogle: async () => {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/`,
          },
        });
        if (error) {
          toast.error(error.message ?? "Google sign-in failed");
        }
        // Note: User will be redirected to Google, then back to the app.
        // The onAuthStateChange listener will handle the session update.
      } catch (err) {
        toast.error("Google sign-in failed. Please try again.");
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
