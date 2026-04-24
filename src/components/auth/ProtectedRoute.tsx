import { ReactNode, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  /** "user" requires sign-in; "admin"/"super_admin" require role */
  require?: "user" | "moderator" | "admin" | "super_admin";
  /** When unauthenticated, where to redirect (default: open sign-in sheet on home) */
  fallback?: string;
}

export function ProtectedRoute({ children, require = "user", fallback = "/" }: Props) {
  const { user, loading: authLoading, promptSignUp } = useAuth();
  const roles = useRoles();
  const navigate = useNavigate();

  const loading = authLoading || (user ? roles.loading : false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      promptSignUp();
      navigate(fallback, { replace: true });
    }
  }, [loading, user, fallback, navigate, promptSignUp]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return null;

  // Role gates
  const allowed =
    require === "user" ||
    (require === "moderator" && roles.isModerator) ||
    (require === "admin" && roles.isAdmin) ||
    (require === "super_admin" && roles.isSuperAdmin);

  if (!allowed) {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-background p-8 text-center">
        <p className="text-sm font-semibold text-foreground">Access denied</p>
        <p className="mt-1 text-xs text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go home
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
