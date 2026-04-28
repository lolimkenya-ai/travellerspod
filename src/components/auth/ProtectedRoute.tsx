import { ReactNode, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  /** "user" requires sign-in; "moderator"/"admin"/"super_admin" require role */
  require?: "user" | "moderator" | "admin" | "super_admin";
  /** When unauthenticated, where to redirect (default: home) */
  fallback?: string;
}

export function ProtectedRoute({ children, require = "user", fallback = "/" }: Props) {
  const { user, loading: authLoading, promptSignUp } = useAuth();
  const roles = useRoles();
  const navigate = useNavigate();

  // Only wait for roles if we have a user AND we need a role beyond "user"
  const needsRoleCheck = require !== "user";
  const loading = authLoading || (user && needsRoleCheck ? roles.loading : false);

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

  // Role gates — super_admin inherits admin, admin inherits moderator
  const allowed =
    require === "user" ||
    (require === "moderator" && roles.isModerator) ||
    (require === "admin" && roles.isAdmin) ||
    (require === "super_admin" && roles.isSuperAdmin);

  if (!allowed) {
    const roleLabel =
      require === "super_admin"
        ? "Super Admin"
        : require === "admin"
          ? "Admin"
          : "Moderator";

    return (
      <div className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center bg-background p-8 text-center">
        <div className="rounded-2xl border border-border bg-card p-8">
          <p className="text-base font-semibold text-foreground">🔒 Access denied</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This page requires <span className="font-semibold text-foreground">{roleLabel}</span> access.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              Go back
            </button>
            <button
              onClick={() => navigate("/")}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
