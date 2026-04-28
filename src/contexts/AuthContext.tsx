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
    let sessionCheckTimeout: NodeJS.Timeout;

    // 1. Check existing session immediately
    const checkSession = async () => {
      try {
        console.log("🔍 Checking existing session...");
        
        // First, try to get the current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("❌ Session check error:", error);
          throw error;
        }
        
        if (mounted) {
          if (session?.user) {
            console.log("✅ Session found for user:", session.user.id);
            setUser(session.user);
            loadProfile(session.user.id);
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

    // 2. Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log("🔔 Auth event:", event, "Session:", session?.user?.id);
      
      if (event === 'SIGNED_OUT') {
        console.log("👋 User signed out");
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          console.log("✅ User signed in/updated:", session.user.id);
          setUser(session.user);
          loadProfile(session.user.id);
          setLoading(false);
        }
      } else if (event === 'INITIAL_SESSION') {
        console.log("🔄 Initial session check complete");
        if (session?.user) {
          console.log("✅ Initial session found:", session.user.id);
          setUser(session.user);
          loadProfile(session.user.id);
        } else {
          console.log("ℹ️ No initial session");
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      } else {
        console.log("ℹ️ Auth event:", event);
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

    // Set a timeout to ensure loading state is cleared after 5 seconds
    sessionCheckTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("⏱️ Session check timeout - clearing loading state");
        setLoading(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(sessionCheckTimeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId: string, retryCount = 0) {
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
        // Profile might still be being created by the DB trigger
        console.log(`⏳ Profile not found, retrying (${retryCount + 1}/3)...`);
        setTimeout(() => loadProfile(userId, retryCount + 1), 500);
      } else {
        console.warn("⚠️ Profile not found after retries");
        setProfile(null);
      }
    } catch (err) {
      console.error("❌ Error loading profile:", err);
      if (retryCount < 3) {
        console.log(`⏳ Retrying profile load (${retryCount + 1}/3)...`);
        setTimeout(() => loadProfile(userId, retryCount + 1), 500);
      }
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
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            console.log("ℹ️ Email already exists, attempting sign-in");
            // Try to sign them in directly with the password they typed
            const signin = await supabase.auth.signInWithPassword({ email, password });
            if (!signin.error) {
              console.log("✅ Sign-in successful for existing account");
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
          console.log("ℹ️ Email confirmation required");
          return { error: "Check your email to confirm your account, then sign in." };
        }
        
        console.log("✅ Sign-up successful");
        setShowSignUp(false);
        toast.success("Welcome to Safiripod ✈️");
        return {};
      } catch (err) {
        console.error("❌ Unexpected sign-up error:", err);
        return { error: "An unexpected error occurred during sign-up" };
      }
    },
    signOut: async () => {
      try {
        console.log("👋 Signing out user");
        
        await supabase.auth.signOut();
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
