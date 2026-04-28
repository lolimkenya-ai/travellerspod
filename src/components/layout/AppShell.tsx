import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, MessageSquare, Plus, Search as SearchIcon, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CategoryBar } from "./CategoryBar";
import { CreateSheet } from "../sheets/CreateSheet";
import { SignUpSheet } from "../sheets/SignUpSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { cn } from "@/lib/utils";

const PRIMARY_TABS = [
  { to: "/", label: "Discover" },
  { to: "/following", label: "Following" },
  { to: "/broadcasts", label: "Broadcasts" },
  { to: "/boards", label: "Trip Boards" },
] as const;

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const { user, profile, promptSignUp } = useAuth();
  const { notif, msgs } = useUnreadCounts();

  const showCategories = location.pathname === "/" || location.pathname === "/following";

  // Reset scroll on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const handleProtected = (path: string) => {
    if (!user) {
      promptSignUp();
      return;
    }
    navigate(path);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[480px] px-4 pt-3 pb-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="text-2xl font-extrabold tracking-tight text-foreground"
              aria-label="Safiripod home"
            >
              Safiripod
            </button>
            <nav className="flex items-center gap-1" aria-label="Primary actions">
              <IconButton label="Create" onClick={() => (user ? setCreateOpen(true) : promptSignUp())} ring>
                <Plus className="h-5 w-5" />
              </IconButton>
              <IconButton label="Search" onClick={() => navigate("/search")}>
                <SearchIcon className="h-5 w-5" />
              </IconButton>
              <IconButton label="Notifications" onClick={() => handleProtected("/notifications")} badge={notif}>
                <Bell className="h-5 w-5" />
              </IconButton>
              <IconButton label="Messages" onClick={() => handleProtected("/messages")} badge={msgs}>
                <MessageSquare className="h-5 w-5" />
              </IconButton>
              {user && (
                <IconButton label="Settings" onClick={() => navigate("/settings")}>
                  <SettingsIcon className="h-5 w-5" />
                </IconButton>
              )}
              <IconButton
                label="Profile"
                onClick={() => (profile ? navigate(`/profile/${profile.nametag}`) : promptSignUp())}
              >
                <UserIcon className="h-5 w-5" />
              </IconButton>
            </nav>
          </div>

          {/* Primary tabs */}
          <nav className="mt-3 flex items-center gap-6 text-base" aria-label="Feed">
            {PRIMARY_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end
                className={({ isActive }) =>
                  cn(
                    "relative pb-2 font-semibold transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {tab.label}
                    {isActive && (
                      <span className="absolute -bottom-px left-0 right-2 h-0.5 rounded-full bg-foreground" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {showCategories && <CategoryBar />}
      </header>

      <main className="mx-auto w-full max-w-[480px] flex-1">
        <Outlet />
      </main>

      {!user && (
        <footer className="mx-auto w-full max-w-[480px] py-6 text-center text-xs text-muted-foreground">
          <a href="/privacy" className="hover:underline">Privacy Policy</a>
        </footer>
      )}

      <CreateSheet open={createOpen} onOpenChange={setCreateOpen} />
      <SignUpSheet />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  ring,
  badge,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  label: string;
  ring?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent",
        ring && "border border-foreground/40",
      )}
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}
