import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User as UserIcon,
  Briefcase,
  ShieldCheck,
  LogOut,
  ChevronRight,
  BadgeCheck,
  Bell,
  Lock,
  KeyRound,
  Mail,
  Trash2,
  ShieldOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { Loader2 } from "lucide-react";

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile, loading, signOut } = useAuth();
  const { isAdmin } = useRoles();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-background p-8 text-center">
        <p className="text-foreground">You need to sign in to access settings.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Go home
        </button>
      </div>
    );
  }

  const isBusiness = profile.account_type === "business";

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Settings</h1>
      </header>

      <div className="px-4 py-6">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <img
            src={
              profile.avatar_url ??
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.display_name)}`
            }
            alt=""
            className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{profile.display_name}</p>
            <p className="text-xs text-muted-foreground">@{profile.nametag}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {profile.account_type}
            </p>
          </div>
        </div>
      </div>

      <Section title="Account">
        <Row to="/settings/profile" icon={<UserIcon className="h-4 w-4" />} label="Edit profile" />
        {isBusiness && (
          <Row
            to="/settings/business"
            icon={<Briefcase className="h-4 w-4" />}
            label="Business details"
            right={<VerificationPill status={profile.verified ? "verified" : undefined} />}
          />
        )}
      </Section>

      <Section title="Privacy & safety">
        <Row to="/settings/privacy" icon={<Lock className="h-4 w-4" />} label="Privacy" />
        <Row to="/settings/blocked" icon={<ShieldOff className="h-4 w-4" />} label="Blocked accounts" />
        <Row to="/settings/notifications" icon={<Bell className="h-4 w-4" />} label="Notifications" />
      </Section>

      <Section title="Security">
        <Row to="/settings/password" icon={<KeyRound className="h-4 w-4" />} label="Change password" />
        <Row to="/settings/email" icon={<Mail className="h-4 w-4" />} label="Change email" />
        <Row to="/settings/sessions" icon={<ShieldCheck className="h-4 w-4" />} label="Sign out everywhere" />
      </Section>

      {isAdmin && (
        <Section title="Admin">
          <Row to="/access" icon={<ShieldCheck className="h-4 w-4" />} label="Safiripod admin" />
        </Section>
      )}

      <Section title="Session">
        <button
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <Row to="/settings/delete" icon={<Trash2 className="h-4 w-4 text-destructive" />} label="Delete account" destructive />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <p className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 border-y border-border bg-card">{children}</div>
    </div>
  );
}

function Row({
  to,
  icon,
  label,
  right,
  destructive,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-border/50 px-4 py-3 text-sm last:border-b-0 hover:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className={`flex-1 ${destructive ? "text-destructive" : "text-foreground"}`}>{label}</span>
      {right}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function VerificationPill({ status }: { status?: "verified" }) {
  if (status === "verified")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-verified/15 px-2 py-0.5 text-xs font-semibold text-verified-foreground">
        <BadgeCheck className="h-3 w-3" /> Verified
      </span>
    );
  return null;
}
