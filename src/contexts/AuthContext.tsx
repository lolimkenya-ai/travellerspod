import { createContext, useContext, useState, ReactNode } from "react";
import { ME, type User } from "@/data/users";

interface AuthContextValue {
  user: User | null;
  signIn: () => void;
  signOut: () => void;
  showSignUp: boolean;
  promptSignUp: () => void;
  closeSignUp: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        signIn: () => {
          setUser(ME);
          setShowSignUp(false);
        },
        signOut: () => setUser(null),
        showSignUp,
        promptSignUp: () => setShowSignUp(true),
        closeSignUp: () => setShowSignUp(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
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
