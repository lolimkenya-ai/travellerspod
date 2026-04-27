import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, BadgeCheck, ShieldCheck, ShieldOff, Loader2, KeyRound,
  ShieldAlert, Sparkles, FileText, ExternalLink, Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "sonner";

interface PendingProfile {
  id: string;
  display_name: string;
  nametag: string;
  avatar_url: string | null;
  verification_status: "unverified" | "pending" | "verified";
  business: BusinessRow | null;
}

interface BusinessRow {
  category_slug: string | null;
  associations: string | null;
  registration_number: string | null;
  address: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  tra_listing_url: string | null;
  kata_listing_url: string | null;
  kato_listing_url: string | null;
}

interface VerificationDoc {
  id: string;
  label: string;
  file_url: string;
  status: string;
  flag_reason: string | null;
  created_at: string;
}

interface AiReview {
  id: string;
  summary: string | null;
  risk_level: "low" | "medium" | "high" | "unknown";
  findings: string[];
  sources: { url: string; title?: string; org?: string; snippet?: string }[];
  created_at: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, isModerator, loading: roleLoading } = useRoles();
  const [hasAnyAdmin, setHasAnyAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingProfile[]>([]);
  const [verified, setVerified] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
    const { error } = await supabase
      .from("profiles")
      .update({ verification_status: status, verified: status === "verified" })
      .eq("id", id);
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
    <div className="mx-auto min-h-screen max-w-3xl bg-background">
      <Header back={() => navigate(-1)} title="Verification queue" />

      <div className="flex flex-wrap gap-2 px-4 pt-3">
        <Link
          to="/access/reports"
          className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
        >
          <ShieldAlert className="h-3 w-3" /> Reports queue
        </Link>
        {isSuperAdmin && (
          <Link
            to="/access/compose"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Post as Safiripod
          </Link>
        )}
      </div>

      <Section title={`Pending (${pending.length})`}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : pending.length === 0 ? (
          <Empty text="No pending requests." />
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <BusinessRow
                key={p.id}
                profile={p}
                expanded={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                onApprove={() => setStatus(p.id, "verified")}
                onChanged={refresh}
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title={`Verified (${verified.length})`}>
        {verified.length === 0 ? (
          <Empty text="No verified businesses yet." />
        ) : (
          <div className="space-y-3">
            {verified.map((p) => (
              <BusinessRow
                key={p.id}
                profile={p}
                expanded={openId === p.id}
                onToggle={() => setOpenId(openId === p.id ? null : p.id)}
                onRevoke={() => setStatus(p.id, "unverified")}
                onChanged={refresh}
                verified
                isSuperAdmin={isSuperAdmin}
              />
            ))}
          </div>
        )}
      </Section>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

function BusinessRow({
  profile, expanded, onToggle, onApprove, onRevoke, onChanged, verified, isSuperAdmin,
}: {
  profile: PendingProfile;
  expanded: boolean;
  onToggle: () => void;
  onApprove?: () => void;
  onRevoke?: () => void;
  onChanged: () => void;
  verified?: boolean;
  isSuperAdmin: boolean;
}) {
  const b = profile.business;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
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
        <span className="text-xs font-semibold text-primary">{expanded ? "Hide" : "Review"}</span>
      </button>

      {expanded && b && <ExpandedReview profileId={profile.id} biz={b} onSaved={onChanged} canEdit={isSuperAdmin} />}

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

function ExpandedReview({
  profileId, biz, onSaved, canEdit,
}: { profileId: string; biz: BusinessRow; onSaved: () => void; canEdit: boolean }) {
  const [docs, setDocs] = useState<VerificationDoc[]>([]);
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [busy, setBusy] = useState(false);
  const [scraping, setScraping] = useState(false);

  // Editable verified weblinks
  const [tra, setTra] = useState(biz.tra_listing_url ?? "");
  const [kata, setKata] = useState(biz.kata_listing_url ?? "");
  const [kato, setKato] = useState(biz.kato_listing_url ?? "");

  useEffect(() => {
    (async () => {
      const [{ data: d }, { data: r }] = await Promise.all([
        supabase
          .from("verification_documents")
          .select("id,label,file_url,status,flag_reason,created_at")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false }),
        supabase
          .from("verification_ai_reviews")
          .select("id,summary,risk_level,findings,sources,created_at")
          .eq("profile_id", profileId)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      setDocs((d as any) ?? []);
      setReviews((r as any) ?? []);
    })();
  }, [profileId]);

  async function flagDoc(id: string) {
    const reason = window.prompt("Reason for flagging this document?");
    if (!reason) return;
    const { error } = await supabase
      .from("verification_documents")
      .update({ status: "flagged", flag_reason: reason, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Flagged.");
  }

  async function runScrape() {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-business", {
        body: { profileId },
      });
      if (error) throw error;
      toast.success("AI review updated.");
      // prepend
      setReviews((prev) => [
        {
          id: data.id,
          summary: data.summary,
          risk_level: data.risk_level,
          findings: data.findings,
          sources: data.sources,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  async function saveLinks() {
    setBusy(true);
    const { error } = await supabase
      .from("business_details")
      .update({
        tra_listing_url: tra.trim() || null,
        kata_listing_url: kata.trim() || null,
        kato_listing_url: kato.trim() || null,
      })
      .eq("profile_id", profileId);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Verified links saved.");
      onSaved();
    }
  }

  async function flagDanger(reason: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ flagged_danger: true, danger_reason: reason })
      .eq("id", profileId);
    if (error) toast.error(error.message);
    else toast.success("Account flagged as danger.");
  }

  const top = reviews[0];

  return (
    <div className="mt-3 space-y-4 border-t border-border pt-3 text-xs">
      {/* Submitted business details */}
      <div className="space-y-1 text-foreground">
        {biz.category_slug && <Detail k="Category" v={biz.category_slug} />}
        {biz.associations && <Detail k="Claimed memberships" v={biz.associations} />}
        {biz.registration_number && <Detail k="Reg #" v={biz.registration_number} />}
        {(biz.address || biz.country) && (
          <Detail k="Location" v={[biz.address, biz.country].filter(Boolean).join(", ")} />
        )}
        {biz.contact_email && <Detail k="Email" v={biz.contact_email} />}
        {biz.contact_phone && <Detail k="Phone" v={biz.contact_phone} />}
        {biz.website && <Detail k="Website" v={biz.website} />}
      </div>

      {/* Documents */}
      <div>
        <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
          <FileText className="h-3 w-3" /> Submitted documents ({docs.length})
        </p>
        {docs.length === 0 ? (
          <p className="text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <a
                  href={d.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 truncate text-primary"
                >
                  {d.label} <ExternalLink className="h-3 w-3" />
                </a>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                    (d.status === "flagged"
                      ? "bg-destructive/15 text-destructive"
                      : d.status === "approved"
                        ? "bg-verified/15 text-verified-foreground"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {d.status}
                </span>
                <button
                  onClick={() => flagDoc(d.id)}
                  className="ml-auto text-[10px] font-semibold text-destructive hover:underline"
                >
                  Flag
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* AI review */}
      <div className="rounded-xl border border-border bg-background p-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="font-semibold text-foreground">AI fraud-risk review</p>
          <button
            onClick={runScrape}
            disabled={scraping}
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {scraping && <Loader2 className="h-3 w-3 animate-spin" />}
            {top ? "Re-scrape" : "Run scrape"}
          </button>
        </div>
        {top ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                  (top.risk_level === "high"
                    ? "bg-destructive/15 text-destructive"
                    : top.risk_level === "medium"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                      : top.risk_level === "low"
                        ? "bg-verified/15 text-verified-foreground"
                        : "bg-muted text-muted-foreground")
                }
              >
                {top.risk_level} risk
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(top.created_at).toLocaleString()}
              </span>
            </div>
            {top.summary && <p className="text-foreground">{top.summary}</p>}
            {top.findings?.length > 0 && (
              <ul className="ml-4 list-disc space-y-0.5 text-foreground">
                {top.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            )}
            {top.sources?.length > 0 && (
              <div>
                <p className="mt-2 font-semibold text-muted-foreground">Sources</p>
                <ul className="space-y-0.5">
                  {top.sources.slice(0, 8).map((s, i) => (
                    <li key={i}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary"
                      >
                        {s.org && <span className="rounded bg-muted px-1 text-[9px] font-semibold">{s.org}</span>}
                        <span className="truncate">{s.title || s.url}</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-muted-foreground">No AI review yet — run a scrape to begin.</p>
        )}
      </div>

      {/* Verified weblinks (admin-curated) */}
      <div className="rounded-xl border border-border bg-background p-3">
        <p className="mb-1 font-semibold text-foreground">Verified listing links (public)</p>
        <p className="mb-2 text-muted-foreground">
          Replace raw contact details with verified registry pages. These appear instead of the business's number.
        </p>
        <LinkInput label="TRA" value={tra} onChange={setTra} />
        <LinkInput label="KATA" value={kata} onChange={setKata} />
        <LinkInput label="KATO" value={kato} onChange={setKato} />
        {canEdit ? (
          <button
            onClick={saveLinks}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background disabled:opacity-50"
          >
            <Save className="h-3 w-3" /> Save links
          </button>
        ) : (
          <p className="text-[10px] italic text-muted-foreground">Super admin only.</p>
        )}
      </div>

      {/* Danger flag */}
      <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3">
        <div>
          <p className="font-semibold text-destructive">Danger / fraud account</p>
          <p className="text-muted-foreground">Flag fraudulent submissions to warn other users.</p>
        </div>
        <button
          onClick={() => {
            const r = window.prompt("Reason this account is flagged as dangerous?");
            if (r) flagDanger(r);
          }}
          className="rounded-full bg-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground"
        >
          Flag account
        </button>
      </div>
    </div>
  );
}

function LinkInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="mb-1 flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`https://${label.toLowerCase()}.example.com/...`}
        className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground"
      />
    </label>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{k}:</span> {v}
    </p>
  );
}
