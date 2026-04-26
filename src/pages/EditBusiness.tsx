import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Send, BadgeCheck, Clock, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  category_slug: z.string().nullable(),
  associations: z.string().max(500).optional().or(z.literal("")),
  registration_number: z.string().max(120).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  country: z.string().max(80).optional().or(z.literal("")),
  contact_email: z.string().email().or(z.literal("")).optional(),
  contact_phone: z.string().max(40).optional().or(z.literal("")),
  website: z.string().url().or(z.literal("")).optional(),
  instagram: z.string().max(120).optional().or(z.literal("")),
  twitter: z.string().max(120).optional().or(z.literal("")),
  linkedin: z.string().max(200).optional().or(z.literal("")),
  facebook: z.string().max(200).optional().or(z.literal("")),
  tiktok: z.string().max(120).optional().or(z.literal("")),
  youtube: z.string().max(200).optional().or(z.literal("")),
});

type Form = z.infer<typeof schema>;

const EMPTY: Form = {
  category_slug: null,
  associations: "",
  registration_number: "",
  address: "",
  country: "",
  contact_email: "",
  contact_phone: "",
  website: "",
  instagram: "",
  twitter: "",
  linkedin: "",
  facebook: "",
  tiktok: "",
  youtube: "",
};

export default function EditBusiness() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const { categories } = useCategories();
  const [form, setForm] = useState<Form>(EMPTY);
  const [verification, setVerification] = useState<"unverified" | "pending" | "verified">("unverified");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: bd }, { data: pr }] = await Promise.all([
        supabase.from("business_details").select("*").eq("profile_id", user.id).maybeSingle(),
        supabase.from("profiles").select("verification_status").eq("id", user.id).maybeSingle(),
      ]);
      if (bd) {
        setForm({
          category_slug: bd.category_slug,
          associations: bd.associations ?? "",
          registration_number: bd.registration_number ?? "",
          address: bd.address ?? "",
          country: bd.country ?? "",
          contact_email: bd.contact_email ?? "",
          contact_phone: bd.contact_phone ?? "",
          website: bd.website ?? "",
          instagram: bd.instagram ?? "",
          twitter: bd.twitter ?? "",
          linkedin: bd.linkedin ?? "",
          facebook: bd.facebook ?? "",
          tiktok: bd.tiktok ?? "",
          youtube: bd.youtube ?? "",
        });
      }
      if (pr?.verification_status) setVerification(pr.verification_status as any);
    })();
  }, [user]);

  function patch<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!user) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Check fields");
      return;
    }
    setSaving(true);
    const payload = {
      profile_id: user.id,
      ...parsed.data,
      contact_email: parsed.data.contact_email || null,
      website: parsed.data.website || null,
    };
    const { error } = await supabase
      .from("business_details")
      .upsert(payload as any, { onConflict: "profile_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Business details saved");
  }

  async function submitForVerification() {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ verification_status: "pending" })
      .eq("id", user.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      setVerification("pending");
      toast.success("Submitted for verification — an admin will review shortly.");
    }
  }

  async function withdrawSubmission() {
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("profiles")
      .update({ verification_status: "unverified" })
      .eq("id", user.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else setVerification("unverified");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return null;

  if (profile.account_type !== "business") {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-background p-8 text-center">
        <p className="text-foreground">Switch your account to Business in Edit profile to access this page.</p>
        <button
          onClick={() => navigate("/settings/profile")}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          Edit profile
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-semibold text-foreground">Business details</h1>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <div className="p-4">
        <VerificationCard
          status={verification}
          onSubmit={submitForVerification}
          onWithdraw={withdrawSubmission}
          busy={submitting}
        />

        <Field label="Category">
          <select
            value={form.category_slug ?? ""}
            onChange={(e) => patch("category_slug", e.target.value || null)}
            className="input"
          >
            <option value="">— Select category —</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Associations" hint="e.g. Member of LHW, IATA, ABTA…">
          <textarea
            value={form.associations ?? ""}
            onChange={(e) => patch("associations", e.target.value)}
            rows={2}
            maxLength={500}
            className="input resize-none"
          />
        </Field>

        <Field label="Registration number">
          <input
            value={form.registration_number ?? ""}
            onChange={(e) => patch("registration_number", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Address">
          <input value={form.address ?? ""} onChange={(e) => patch("address", e.target.value)} className="input" />
        </Field>

        <Field label="Country">
          <input value={form.country ?? ""} onChange={(e) => patch("country", e.target.value)} className="input" />
        </Field>

        <Field label="Contact email">
          <input
            type="email"
            value={form.contact_email ?? ""}
            onChange={(e) => patch("contact_email", e.target.value)}
            className="input"
          />
        </Field>

        <Field label="Contact phone">
          <input value={form.contact_phone ?? ""} onChange={(e) => patch("contact_phone", e.target.value)} className="input" />
        </Field>

        <Field label="Website">
          <input
            type="url"
            placeholder="https://"
            value={form.website ?? ""}
            onChange={(e) => patch("website", e.target.value)}
            className="input"
          />
        </Field>

        <p className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Social
        </p>

        {(["instagram", "twitter", "linkedin", "facebook", "tiktok", "youtube"] as const).map((s) => (
          <Field key={s} label={s}>
            <input
              value={(form as any)[s] ?? ""}
              onChange={(e) => patch(s, e.target.value as any)}
              placeholder={`https://${s}.com/yourhandle`}
              className="input"
            />
          </Field>
        ))}
      </div>

      <style>{`.input { width: 100%; border-radius: 12px; border: 1px solid hsl(var(--border)); background: hsl(var(--muted)); padding: 0.75rem 1rem; font-size: 0.875rem; color: hsl(var(--foreground)); outline: none; } .input:focus { box-shadow: 0 0 0 2px hsl(var(--ring)); }`}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function VerificationCard({
  status,
  onSubmit,
  onWithdraw,
  busy,
}: {
  status: "unverified" | "pending" | "verified";
  onSubmit: () => void;
  onWithdraw: () => void;
  busy: boolean;
}) {
  if (status === "verified") {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-verified/30 bg-verified/10 p-3">
        <BadgeCheck className="h-5 w-5 fill-verified text-verified-foreground" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Verified business</p>
          <p className="text-xs text-muted-foreground">Your badge is live across Safiripod.</p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="mb-5 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Pending review</p>
            <p className="text-xs text-muted-foreground">An admin will review your submission shortly.</p>
          </div>
        </div>
        <button
          onClick={onWithdraw}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <ShieldOff className="h-3 w-3" /> Withdraw submission
        </button>
      </div>
    );
  }
  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-semibold text-foreground">Get verified</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Fill in your details, then submit for review. An admin will approve and grant your Verified business badge.
      </p>
      <button
        onClick={onSubmit}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        <Send className="h-3 w-3" /> Submit for verification
      </button>
    </div>
  );
}
