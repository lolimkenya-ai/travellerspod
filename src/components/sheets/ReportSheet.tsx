import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
}

const REASONS: { value: string; label: string; description?: string }[] = [
  { value: "spam", label: "Spam", description: "Unwanted commercial or repetitive content" },
  { value: "scam_fraud", label: "Scam or fraud", description: "Misleading offers, fake businesses" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "nudity_sexual", label: "Nudity or sexual content" },
  { value: "violence", label: "Violence or graphic content" },
  { value: "misinformation", label: "False information" },
  { value: "impersonation", label: "Impersonation" },
  { value: "other", label: "Something else" },
];

export function ReportSheet({ open, onOpenChange, postId }: Props) {
  const { user, promptSignUp } = useAuth();
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setReason("");
    setDetails("");
    onOpenChange(false);
  };

  const submit = async () => {
    if (!user) {
      promptSignUp();
      return;
    }
    if (!reason) {
      toast.error("Pick a reason first");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("report_content", {
      _content_id: postId,
      _content_type: "post",
      _reason: reason,
    });
    setSubmitting(false);
    if (error) {
      // Friendly message for the unique-constraint case
      if (error.code === "23505") {
        toast.message("You've already reported this post for that reason.");
        close();
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Thanks — our moderators will review it.");
    close();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>Report post</SheetTitle>
          <SheetDescription>
            Reports are anonymous to the post's author. We review every report.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 max-h-[55vh] space-y-1 overflow-y-auto pr-1">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors " +
                (reason === r.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-accent")
              }
            >
              <span
                className={
                  "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                  (reason === r.value ? "border-primary bg-primary" : "border-border")
                }
              >
                {reason === r.value && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{r.label}</span>
                {r.description && (
                  <span className="block text-xs text-muted-foreground">{r.description}</span>
                )}
              </span>
            </button>
          ))}
        </div>

        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          placeholder="Add a note for our moderators (optional)"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background p-3 text-sm text-foreground"
          rows={3}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={close}
            className="rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || !reason}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Submit report
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
