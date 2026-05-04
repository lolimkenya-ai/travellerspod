import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Send, BadgeCheck, Clock, ShieldOff, Upload, FileText, Trash2, Flag } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { toast } from "sonner";
import { z } from "zod";
import { LocationPicker } from "@/components/LocationPicker";

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

        <DocumentsSection />
        <MessagesSection />

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
          <LocationPicker
            value={form.address ?? ""}
            onChange={(v) => patch("address", v)}
            placeholder="Search business address"
          />
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

/* ----------------------- Verification documents ----------------------- */

interface VDoc {
  id: string;
  label: string;
  file_url: string;
  content_type: string | null;
  size_bytes: number | null;
  status: string;
  flag_reason: string | null;
  review_message: string | null;
  created_at: string;
}

function DocumentsSection() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<VDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [label, setLabel] = useState("");

  async function refresh() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("verification_documents")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false });
    setDocs((data ?? []) as VDoc[]);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [user?.id]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !user) return;
    if (!label.trim()) {
      toast.error("Add a label first (e.g. 'Business registration', 'License').");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error("Max 15 MB per file.");
      return;
    }
    setUploading(true);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("verification-docs").upload(path, f, {
      upsert: false,
      contentType: f.type || undefined,
      cacheControl: "0",
    });
    if (up.error) {
      setUploading(false);
      toast.error(up.error.message);
      return;
    }
    // private bucket — store the storage path; admins/users get signed URLs on view.
    const { data: signed } = await supabase.storage.from("verification-docs").createSignedUrl(path, 60 * 60 * 24 * 7);
    const file_url = signed?.signedUrl ?? path;
    const { error } = await supabase.from("verification_documents").insert({
      profile_id: user.id,
      label: label.trim().slice(0, 80),
      file_url,
      content_type: f.type || null,
      size_bytes: f.size,
      status: "pending",
    });
    setUploading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Document uploaded");
      setLabel("");
      refresh();
    }
  }

  async function remove(d: VDoc) {
    if (d.status !== "pending") {
      toast.error("Only pending documents can be removed.");
      return;
    }
    if (!confirm("Remove this document?")) return;
    const { error } = await supabase.from("verification_documents").delete().eq("id", d.id);
    if (error) toast.error(error.message);
    else refresh();
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Verification documents</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Upload registration certificates, licenses, association IDs. Visible only to you and Safiripod admins.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Document label"
          className="input flex-1"
        />
        <input ref={fileRef} type="file" hidden onChange={onPick} accept="image/*,application/pdf" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !label.trim()}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">No documents yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2 text-xs">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{d.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {d.content_type ?? "file"} · <StatusPill status={d.status} />
                </p>
                {d.flag_reason && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-destructive">
                    <Flag className="h-3 w-3" /> {d.flag_reason}
                  </p>
                )}
              </div>
              <a
                href={d.file_url}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground hover:bg-accent"
              >
                Open
              </a>
              {d.status === "pending" && (
                <button
                  onClick={() => remove(d)}
                  className="rounded-full bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20"
                  aria-label="Delete document"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    flagged: "bg-destructive/15 text-destructive",
    approved: "bg-verified/15 text-verified-foreground",
  };
  return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${map[status] ?? map.pending}`}>{status}</span>;
}

function MessagesSection() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Array<{ id: string; body: string; author_id: string; created_at: string }>>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!user) return;
    const { data } = await supabase
      .from("verification_messages")
      .select("id, body, author_id, created_at")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: true });
    setMsgs(data ?? []);
  }

  useEffect(() => {
    refresh();
    if (!user) return;
    const ch = supabase
      .channel(`vm-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "verification_messages", filter: `profile_id=eq.${user.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  async function send() {
    if (!user || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("verification_messages")
      .insert({ profile_id: user.id, author_id: user.id, body: body.trim().slice(0, 1000) });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      setBody("");
      refresh();
    }
  }

  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Messages with admins</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use this thread to ask questions or read why your verification was approved or rejected.
      </p>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg bg-muted/30 p-2">
        {msgs.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">No messages yet.</p>}
        {msgs.map((m) => {
          const mine = m.author_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${mine ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-[9px] opacity-60">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask an admin…"
          className="input flex-1"
          maxLength={1000}
        />
        <button
          onClick={send}
          disabled={busy || !body.trim()}
          className="rounded-full bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
