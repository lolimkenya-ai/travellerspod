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
    let mounted = true;

    // 1. Check existing session immediately
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            loadProfile(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Session check error:", err);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    };

    checkSession();

    // 2. Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log("Auth event:", event);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (session?.user) {
        setUser(session.user);
        loadProfile(session.user.id);
        setLoading(false);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId: string, retryCount = 0) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nametag, display_name, avatar_url, account_type, verified")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data as AuthProfile);
      } else if (retryCount < 3) {
        // Profile might still be being created by the DB trigger
        setTimeout(() => loadProfile(userId, retryCount + 1), 500);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
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
