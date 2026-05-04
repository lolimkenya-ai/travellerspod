import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { LocationPicker } from "@/components/LocationPicker";
import { rateLimit } from "@/lib/rateLimit";

interface EnquiryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toUserId: string;
  postId?: string;
  postCaption?: string | null;
  postLocation?: string | null;
}

const initial = {
  destination: "",
  startDate: "",
  endDate: "",
  travellers: "2",
  budget: "",
  name: "",
  email: "",
  phone: "",
  message: "",
};

export function EnquiryFormSheet({
  open,
  onOpenChange,
  toUserId,
  postId,
  postCaption,
  postLocation,
}: EnquiryFormSheetProps) {
  const { user, profile, promptSignUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    ...initial,
    destination: postLocation ?? "",
    name: profile?.display_name ?? "",
  });
  const [busy, setBusy] = useState(false);

  const patch = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  function buildBody(): string {
    const ref = postCaption
      ? `Hi! I'm enquiring about your post:\n"${postCaption.slice(0, 140)}${postCaption.length > 140 ? "…" : ""}"\n\n`
      : "Hi! I'd like to make a booking enquiry.\n\n";
    return (
      ref +
      `📍 Destination: ${form.destination || "—"}\n` +
      `📅 Dates: ${form.startDate || "?"}${form.endDate ? ` → ${form.endDate}` : ""}\n` +
      `👥 Travellers: ${form.travellers || "—"}\n` +
      `💰 Budget: ${form.budget || "—"}\n\n` +
      `📝 Notes:\n${form.message || "—"}\n\n` +
      `— Contact —\n` +
      `Name: ${form.name || "—"}\n` +
      `Email: ${form.email || "—"}\n` +
      `Phone: ${form.phone || "—"}`
    );
  }

  async function submit() {
    if (!user) {
      promptSignUp();
      return;
    }
    if (!form.destination.trim()) {
      toast.error("Please add a destination");
      return;
    }
    setBusy(true);
    try {
      const ok = await rateLimit("send_message", 30, 60);
      if (!ok) {
        setBusy(false);
        return;
      }
      const { data: convId, error } = await supabase.rpc("start_dm", {
        _other: toUserId,
        _is_inquiry: true,
      });
      if (error) throw error;
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: convId as string,
        author_id: user.id,
        body: buildBody(),
      });
      if (msgErr) throw msgErr;
      toast.success("Enquiry sent");
      onOpenChange(false);
      navigate(`/messages/${convId}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send enquiry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 text-left">
          <SheetTitle>Send an enquiry</SheetTitle>
          <SheetDescription>The business will reply in your inbox.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-5">
          <Field label="Destination">
            <LocationPicker
              value={form.destination}
              onChange={(v) => patch("destination", v)}
              placeholder="Where do you want to go?"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => patch("startDate", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => patch("endDate", e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Travellers">
              <input
                type="number"
                min={1}
                max={50}
                value={form.travellers}
                onChange={(e) => patch("travellers", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Budget (optional)">
              <input
                value={form.budget}
                onChange={(e) => patch("budget", e.target.value.slice(0, 60))}
                placeholder="USD 1500"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Notes / questions">
            <textarea
              value={form.message}
              onChange={(e) => patch("message", e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Anything special? Dietary, accessibility, room setup, must-sees..."
              className={`${inputCls} resize-none`}
            />
          </Field>

          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your contact
            </p>
            <div className="space-y-2">
              <input
                value={form.name}
                onChange={(e) => patch("name", e.target.value.slice(0, 80))}
                placeholder="Full name"
                className={inputCls}
              />
              <input
                type="email"
                value={form.email}
                onChange={(e) => patch("email", e.target.value.slice(0, 120))}
                placeholder="Email"
                className={inputCls}
              />
              <input
                value={form.phone}
                onChange={(e) => patch("phone", e.target.value.slice(0, 40))}
                placeholder="Phone (optional)"
                className={inputCls}
              />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send enquiry
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
