import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Settings as SettingsIcon, Briefcase, Loader2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRequireAuth } from "@/contexts/AuthContext";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import { VerifiedBusinessModal } from "@/components/profile/VerifiedBusinessModal";
import { Feed } from "@/components/feed/Feed";
import { usePosts } from "@/hooks/usePosts";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const TABS = ["Posts", "Reposts", "Followers", "Following"] as const;
type Tab = (typeof TABS)[number];

interface MiniProfile {
  id: string;
  nametag: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
}

export default function Profile() {
  const { nametag = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile: meProfile } = useAuth();
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

  const { posts: authorPosts, loading: postsLoading } = usePosts({
    scope: "author",
    authorId: profile?.id,
  });

  const reposts = authorPosts.filter((p) => p.quote);
  const originals = authorPosts.filter((p) => !p.quote);

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
        {isMe ? (
          <button
            aria-label="Settings"
            onClick={() => navigate("/settings")}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-9 w-9" />
        )}
      </header>

      {profile.flagged_danger && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Flagged account</p>
            {profile.danger_reason && <p className="mt-1 text-destructive/90">{profile.danger_reason}</p>}
          </div>
        </div>
      )}

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
          <button onClick={() => setTab("Followers")} className="hover:underline">
            <span className="font-semibold text-foreground">{formatCount(profile.followers_count)}</span>{" "}
            <span className="text-muted-foreground">followers</span>
          </button>
          <button onClick={() => setTab("Following")} className="hover:underline">
            <span className="font-semibold text-foreground">{formatCount(profile.following_count)}</span>{" "}
            <span className="text-muted-foreground">following</span>
          </button>
        </div>

        {isMe ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate("/settings/profile")}
              className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              Edit profile
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="flex-1 rounded-full border border-border py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              Settings
            </button>
          </div>
        ) : (
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
              "flex-1 border-b-2 py-3 text-xs font-semibold transition-colors sm:text-sm",
              tab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="pb-12">
        {tab === "Posts" &&
          (postsLoading ? (
            <Spinner />
          ) : (
            <Feed posts={originals} emptyTitle="No posts yet" emptyBody={isMe ? "Tap + to share your first trip." : ""} />
          ))}

        {tab === "Reposts" &&
          (postsLoading ? (
            <Spinner />
          ) : (
            <Feed posts={reposts} emptyTitle="No reposts yet" />
          ))}

        {tab === "Followers" && <FollowList kind="followers" profileId={profile.id} />}
        {tab === "Following" && <FollowList kind="following" profileId={profile.id} />}
      </div>

      <VerifiedBusinessModal
        open={bizOpen}
        onOpenChange={setBizOpen}
        profileId={profile.id}
        displayName={profile.display_name}
      />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function FollowList({ profileId, kind }: { profileId: string; kind: "followers" | "following" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState<MiniProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // Use explicit FK aliases so PostgREST embeds the right side.
      const select =
        kind === "followers"
          ? "follower:profiles!follows_follower_id_fkey(id, nametag, display_name, avatar_url, verified)"
          : "followee:profiles!follows_followee_id_fkey(id, nametag, display_name, avatar_url, verified)";
      const filter = kind === "followers" ? "followee_id" : "follower_id";

      const { data, error } = await supabase
        .from("follows")
        .select(select)
        .eq(filter, profileId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        // Fallback if FK alias names differ — fetch ids then resolve profiles.
        const idCol = kind === "followers" ? "follower_id" : "followee_id";
        const { data: rows } = await supabase.from("follows").select(idCol).eq(filter, profileId).limit(200);
        const ids = (rows ?? []).map((r: any) => r[idCol]).filter(Boolean);
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, nametag, display_name, avatar_url, verified")
            .in("id", ids);
          setList((profs ?? []) as MiniProfile[]);
        } else {
          setList([]);
        }
      } else {
        const out: MiniProfile[] = (data ?? [])
          .map((r: any) => (kind === "followers" ? r.follower : r.followee))
          .filter(Boolean);
        setList(out);
      }
      setLoading(false);

      if (user) {
        const { data: my } = await supabase
          .from("follows")
          .select("followee_id")
          .eq("follower_id", user.id);
        if (!cancelled) setFollowingSet(new Set((my ?? []).map((r) => r.followee_id)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId, kind, user]);

  async function toggle(id: string) {
    if (!user) return;
    if (id === user.id) {
      toast.error("You can't follow yourself");
      return;
    }
    const isFollowing = followingSet.has(id);
    const next = new Set(followingSet);
    if (isFollowing) {
      next.delete(id);
      setFollowingSet(next);
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followee_id", id);
      if (error) {
        next.add(id);
        setFollowingSet(new Set(next));
        toast.error(error.message);
      }
    } else {
      next.add(id);
      setFollowingSet(next);
      const { error } = await supabase.from("follows").insert({ follower_id: user.id, followee_id: id });
      if (error) {
        next.delete(id);
        setFollowingSet(new Set(next));
        toast.error(error.message);
      }
    }
  }

  if (loading) return <Spinner />;
  if (list.length === 0)
    return <p className="px-6 py-12 text-center text-sm text-muted-foreground">Nobody here yet.</p>;

  return (
    <ul className="divide-y divide-border">
      {list.map((p) => {
        const isMe = user?.id === p.id;
        const isFollowing = followingSet.has(p.id);
        return (
          <li key={p.id} className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(`/profile/${p.nametag}`)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <img
                src={p.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.display_name)}`}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-1 ring-border"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
                  {p.display_name}
                  {p.verified && <BadgeCheck className="h-3.5 w-3.5 fill-verified text-verified-foreground" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">@{p.nametag}</p>
              </div>
            </button>
            {!isMe && user && (
              <button
                onClick={() => toggle(p.id)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  isFollowing
                    ? "border border-border bg-muted text-foreground"
                    : "bg-foreground text-background",
                )}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
