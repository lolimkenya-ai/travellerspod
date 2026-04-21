import { useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ShieldCheck, ShieldOff, Loader2, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";

interface PendingProfile {
  id: string;
  display_name: string;
  nametag: string;
  avatar_url: string | null;
  verification_status: "unverified" | "pending" | "verified";
  business: {
    category_slug: string | null;
    associations: string | null;
    registration_number: string | null;
    address: string | null;
    country: string | null;
    contact_email: string | null;
    website: string | null;
  } | null;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [hasAnyAdmin, setHasAnyAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [verified, setVerified] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, nametag, avatar_url, verification_status")
      .in("verification_status", ["pending", "verified"])
      .order("updated_at", { ascending: false });

    const ids = (profiles ?? []).map((p) => p.id);
    let bizMap = new Map<string, any>();
    if (ids.length) {
      const { data: biz } = await supabase
        .from("business_details")
        .select("*")
        .in("profile_id", ids);
      biz?.forEach((b) => bizMap.set(b.profile_id, b));
    }
    const enriched =
      profiles?.map((p) => ({ ...(p as any), business: bizMap.get(p.id) ?? null })) ?? [];
    setPending(enriched.filter((p) => p.verification_status === "pending"));
    setVerified(enriched.filter((p) => p.verification_status === "verified"));
    setLoading(false);
  }

  useEffect(() => {
    // Check whether any admin exists at all (for bootstrap)
    supabase
      .from("user_roles")
      .select("id", { head: true, count: "exact" })
      .eq("role", "admin")
      .then(({ count }) => setHasAnyAdmin((count ?? 0) > 0));
  }, []);

  useEffect(() => {
    if (isAdmin) refresh();
  }, [isAdmin]);

  async function setStatus(id: string, status: "verified" | "unverified") {
    const { error } = await supabase.from("profiles").update({ verification_status: status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(status === "verified" ? "Approved" : "Revoked");
      refresh();
    }
  }

  async function claimAdmin() {
    const { error } = await supabase.rpc("claim_first_admin");
    if (error) toast.error(error.message);
    else {
      toast.success("You are now an admin");
      window.location.reload();
    }
  }

  if (roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-background p-8 text-center text-sm text-muted-foreground">
        Sign in to access admin tools.
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-background">
        <Header back={() => navigate(-1)} title="Admin" />
        <div className="p-6">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">Admin access required</p>
            {hasAnyAdmin === false ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  No admin exists yet. Claim the first admin role for this project.
                </p>
                <button
                  onClick={claimAdmin}
                  className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Claim first admin
                </button>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Ask an existing admin to grant you the role.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <Header back={() => navigate(-1)} title="Verification queue" />

      <div className="px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pending ({pending.length})
        </p>
        {loading ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" />
        ) : pending.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((p) => (
              <Card key={p.id} profile={p} onApprove={() => setStatus(p.id, "verified")} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Verified ({verified.length})
        </p>
        {verified.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No verified businesses yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {verified.map((p) => (
              <Card key={p.id} profile={p} onRevoke={() => setStatus(p.id, "unverified")} verified />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ back, title }: { back: () => void; title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
      <button onClick={back} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="text-base font-semibold text-foreground">{title}</h1>
    </header>
  );
}

function Card({
  profile,
  onApprove,
  onRevoke,
  verified,
}: {
  profile: PendingProfile;
  onApprove?: () => void;
  onRevoke?: () => void;
  verified?: boolean;
}) {
  const b = profile.business;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <img
          src={
            profile.avatar_url ??
            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profile.display_name)}`
          }
          alt=""
          className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold text-foreground">
            {profile.display_name}
            {verified && <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />}
          </p>
          <p className="text-xs text-muted-foreground">@{profile.nametag}</p>
        </div>
      </div>
      {b && (
        <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-foreground">
          {b.category_slug && <Detail k="Category" v={b.category_slug} />}
          {b.associations && <Detail k="Associations" v={b.associations} />}
          {b.registration_number && <Detail k="Reg №" v={b.registration_number} />}
          {(b.address || b.country) && (
            <Detail k="Location" v={[b.address, b.country].filter(Boolean).join(", ")} />
          )}
          {b.contact_email && <Detail k="Email" v={b.contact_email} />}
          {b.website && <Detail k="Website" v={b.website} />}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {onApprove && (
          <button
            onClick={onApprove}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-verified/20 py-1.5 text-xs font-semibold text-verified-foreground hover:bg-verified/30"
          >
            <ShieldCheck className="h-3 w-3" /> Approve
          </button>
        )}
        {onRevoke && (
          <button
            onClick={onRevoke}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-muted py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
          >
            <ShieldOff className="h-3 w-3" /> Revoke
          </button>
        )}
      </div>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{k}:</span> {v}
    </p>
  );
}
