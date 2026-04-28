import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
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
  refreshProfile: () => Promise<void>;
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

  const loadProfile = useCallback(async (userId: string, retryCount = 0) => {
    try {
      console.log("📋 Loading profile for user:", userId);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nametag, display_name, avatar_url, account_type, verified")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("❌ Error loading profile:", error);
        throw error;
      }

      if (data) {
        console.log("✅ Profile loaded successfully");
        setProfile(data as AuthProfile);
      } else if (retryCount < 3) {
        // Profile might still be created by the DB trigger — retry
        console.log(`⏳ Profile not found, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => loadProfile(userId, retryCount + 1), 600);
      } else {
        console.warn("⚠️ Profile not found after retries");
        setProfile(null);
      }
    } catch (err) {
      console.error("❌ Error loading profile:", err);
      if (retryCount < 3) {
        console.log(`⏳ Retrying profile load (${retryCount + 1}/3)...`);
        setTimeout(() => loadProfile(userId, retryCount + 1), 600);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        console.log("🔍 Checking existing session...");
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("❌ Session check error:", error);
          throw error;
        }

        if (mounted) {
          if (session?.user) {
            console.log("✅ Session found for user:", session.user.id);
            setUser(session.user);
            await loadProfile(session.user.id);
          } else {
            console.log("ℹ️ No existing session found");
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("❌ Session check error:", err);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log("🔔 Auth event:", event, "Session:", session?.user?.id);

      if (event === "SIGNED_OUT") {
        console.log("👋 User signed out");
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        if (session?.user) {
          console.log("✅ User signed in/updated:", session.user.id);
          setUser(session.user);
          loadProfile(session.user.id);
          setLoading(false);
        }
      } else if (event === "INITIAL_SESSION") {
        console.log("🔄 Initial session check complete");
        if (session?.user) {
          setUser(session.user);
          loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      } else {
        if (session?.user) {
          setUser(session.user);
          loadProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  /** Force-refresh the profile from the DB (useful after edits). */
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadProfile(user.id);
  }, [user, loadProfile]);

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    refreshProfile,
    showSignUp,
    promptSignUp: () => setShowSignUp(true),
    closeSignUp: () => setShowSignUp(false),
    signInWithEmail: async (email, password) => {
      try {
        console.log("🔐 Attempting email sign-in for:", email);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error("❌ Sign-in error:", error);
          return { error: error.message };
        }
        console.log("✅ Sign-in successful");
        setShowSignUp(false);
        toast.success("Welcome back");
        return {};
      } catch (err) {
        console.error("❌ Unexpected sign-in error:", err);
        return { error: "An unexpected error occurred during sign-in" };
      }
    },
    signUpWithEmail: async (email, password, meta) => {
      try {
        console.log("📝 Attempting email sign-up for:", email);
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: meta,
          },
        });

        if (error) {
          console.error("❌ Sign-up error:", error);
          const msg = error.message.toLowerCase();
          if (
            msg.includes("already") ||
            msg.includes("registered") ||
            msg.includes("exists")
          ) {
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

        if (!data.session) {
          return { error: "Check your email to confirm your account, then sign in." };
        }

        setShowSignUp(false);
        toast.success("Welcome to Safiripod ✈️");
        return {};
      } catch (err) {
        console.error("❌ Unexpected sign-up error:", err);
        return { error: "An unexpected error occurred during sign-up" };
      }
    },
    signInWithGoogle: async () => {
      try {
        console.log("🚀 Attempting Google sign-in");
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/`,
          },
        });
        if (error) {
          console.error("❌ Google sign-in error:", error);
          toast.error("Failed to sign in with Google.");
        }
      } catch (err) {
        console.error("❌ Unexpected Google sign-in error:", err);
        toast.error("An unexpected error occurred.");
      }
    },
    signOut: async () => {
      try {
        console.log("👋 Signing out user");
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        console.log("✅ Sign-out successful");
      } catch (err) {
        console.error("❌ Sign-out error:", err);
        toast.error("Failed to sign out. Please try again.");
      }
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
