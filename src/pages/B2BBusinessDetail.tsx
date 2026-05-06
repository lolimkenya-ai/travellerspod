import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ExternalLink, Loader2, MessageSquare, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface BizProfile {
  id: string;
  display_name: string;
  nametag: string;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean | null;
  account_type: string;
  verification_status: string;
}

interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  unit: string | null;
  external_url: string | null;
}

interface ExternalLink {
  id: string;
  label: string;
  url: string;
}

export default function B2BBusinessDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BizProfile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: prof }, { data: ls }, { data: ln }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, nametag, avatar_url, bio, is_verified, account_type, verification_status")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("b2b_listings" as any)
          .select("id, title, description, category, price, currency, unit, external_url")
          .eq("business_id", id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("b2b_external_links" as any)
          .select("id, label, url")
          .eq("business_id", id)
          .order("sort_order", { ascending: true }),
      ]);
      if (cancelled) return;
      setProfile((prof as unknown as BizProfile) ?? null);
      setListings((ls as unknown as Listing[]) ?? []);
      setLinks((ln as unknown as ExternalLink[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function startB2BChat() {
    if (!user || !profile) return;
    setStarting(true);
    const { data, error } = await supabase.rpc("start_dm", {
      _other: profile.id,
      _is_inquiry: false,
      _is_b2b: true,
    });
    setStarting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate(`/messages/${data as string}`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mx-auto min-h-screen max-w-[640px] bg-background p-8 text-center text-sm text-muted-foreground">
        Business not found.
      </div>
    );
  }

  const isSelf = user?.id === profile.id;

  return (
    <div className="mx-auto min-h-screen max-w-[720px] bg-background pb-12">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">B2B Profile</h1>
      </header>

      {/* Profile head */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <img
            src={
              profile.avatar_url ??
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.display_name)}`
            }
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-base font-semibold text-foreground">{profile.display_name}</p>
              {profile.is_verified && (
                <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />
              )}
            </div>
            <Link to={`/profile/${profile.nametag}`} className="text-xs text-muted-foreground">
              @{profile.nametag} · View public profile
            </Link>
          </div>
        </div>
        {profile.bio && <p className="mt-3 text-sm text-foreground">{profile.bio}</p>}

        {!isSelf && (
          <button
            onClick={startB2BChat}
            disabled={starting}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            Message for B2B rates
          </button>
        )}
      </div>

      {/* Services */}
      <div className="px-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Services & rates
        </h2>
        {listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No published B2B services yet.
          </p>
        ) : (
          <div className="space-y-2">
            {listings.map((l) => (
              <div key={l.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{l.title}</p>
                    {l.category && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        <Tag className="h-2.5 w-2.5" />
                        {l.category}
                      </span>
                    )}
                    {l.description && (
                      <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">
                        {l.description}
                      </p>
                    )}
                  </div>
                  {l.price != null && (
                    <div className="shrink-0 text-right">
                      <p className="text-base font-bold text-foreground">
                        {l.currency} {Number(l.price).toLocaleString()}
                      </p>
                      {l.unit && <p className="text-[10px] text-muted-foreground">{l.unit}</p>}
                    </div>
                  )}
                </div>
                {l.external_url && (
                  <a
                    href={l.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Book on partner platform
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* External B2B links */}
      {links.length > 0 && (
        <div className="mt-6 px-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Other B2B platforms
          </h2>
          <div className="space-y-2">
            {links.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent"
              >
                <span className="truncate text-sm text-foreground">{l.label}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
