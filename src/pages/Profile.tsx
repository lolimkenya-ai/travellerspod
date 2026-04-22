import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Settings, Briefcase, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRequireAuth } from "@/contexts/AuthContext";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VerifiedBusinessModal } from "@/components/profile/VerifiedBusinessModal";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const TABS = ["Posts", "Reposts", "Boards"] as const;
type Tab = (typeof TABS)[number];

export default function Profile() {
  const { nametag = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile: meProfile, signOut } = useAuth();
  const requireAuth = useRequireAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Posts");
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);

  const isMe = !!meProfile && meProfile.nametag === nametag;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("nametag", nametag)
        .maybeSingle();
      if (cancelled) return;
      setProfile(p);
      setLoading(false);

      if (p && user && user.id !== p.id) {
        const { data: f } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("followee_id", p.id)
          .maybeSingle();
        if (!cancelled) setFollowing(!!f);
      } else {
        setFollowing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nametag, user]);

  async function toggleFollow() {
    if (!profile) return;
    requireAuth(async () => {
      if (!user) return;
      if (user.id === profile.id) {
        toast.error("You can't follow yourself");
        return;
      }
      setFollowBusy(true);
      if (following) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("followee_id", profile.id);
        if (error) toast.error(error.message);
        else {
          setFollowing(false);
          setProfile((p) => p && { ...p, followers_count: Math.max(0, p.followers_count - 1) });
        }
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, followee_id: profile.id });
        if (error) toast.error(error.message);
        else {
          setFollowing(true);
          setProfile((p) => p && { ...p, followers_count: p.followers_count + 1 });
        }
      }
      setFollowBusy(false);
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-background p-6 text-center">
        <button onClick={() => navigate(-1)} className="mb-4 text-sm text-muted-foreground">
          ← Back
        </button>
        <p className="text-foreground">Profile not found.</p>
      </div>
    );
  }

  const isBusiness = profile.account_type === "business";

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-sm font-semibold text-foreground">@{profile.nametag}</h1>
        <button
          aria-label="Settings"
          onClick={isMe ? () => signOut() : undefined}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <Settings className="h-5 w-5" />
        </button>
      </header>

      <div className="px-4 pt-5">
        <div className="flex items-start gap-4">
          <img
            src={
              profile.avatar_url ??
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.display_name)}`
            }
            alt=""
            className="h-20 w-20 rounded-full object-cover ring-2 ring-border"
          />
          <div className="flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{profile.display_name}</h2>
              {profile.verified && isBusiness && (
                <button
                  onClick={() => setBizOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-verified/15 px-2 py-0.5 text-xs font-semibold text-verified-foreground transition-colors hover:bg-verified/25"
                  aria-label="View verified business details"
                >
                  <BadgeCheck className="h-3.5 w-3.5 fill-verified text-verified-foreground" />
                  Verified business
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.nametag}</p>
            {profile.account_type === "organization" && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                <Briefcase className="h-3 w-3" /> Organization
              </span>
            )}
          </div>
        </div>

        {profile.bio && <p className="mt-3 text-sm text-foreground">{profile.bio}</p>}

        <div className="mt-4 flex items-center gap-5 text-sm">
          <span>
            <span className="font-semibold text-foreground">{formatCount(profile.followers_count)}</span>{" "}
            <span className="text-muted-foreground">followers</span>
          </span>
          <span>
            <span className="font-semibold text-foreground">{formatCount(profile.following_count)}</span>{" "}
            <span className="text-muted-foreground">following</span>
          </span>
        </div>

        {!isMe && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                following
                  ? "border border-border bg-muted text-foreground"
                  : "bg-foreground text-background hover:bg-foreground/90",
              )}
            >
              {following ? "Following" : "Follow"}
            </button>
            <button
              onClick={() => navigate(`/messages/conv-${profile.id}?to=${profile.id}`)}
              className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              Message
            </button>
          </div>
        )}
      </div>

      <nav className="mt-6 flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 border-b-2 py-3 text-sm font-semibold transition-colors",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      <p className="py-12 text-center text-sm text-muted-foreground">
        {tab === "Posts" && "No posts yet."}
        {tab === "Reposts" && "No reposts yet."}
        {tab === "Boards" && "No boards yet."}
      </p>

      <VerifiedBusinessModal
        open={bizOpen}
        onOpenChange={setBizOpen}
        profileId={profile.id}
        displayName={profile.display_name}
      />
    </div>
  );
}
