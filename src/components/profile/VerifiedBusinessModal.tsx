import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BadgeCheck, MapPin, Mail, Phone, Globe, Building2, Hash, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BusinessDetails = Database["public"]["Tables"]["business_details"]["Row"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profileId: string;
  displayName: string;
}

const SOCIAL_KEYS: Array<{ key: keyof BusinessDetails; label: string }> = [
  { key: "instagram", label: "Instagram" },
  { key: "twitter", label: "X / Twitter" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
];

export function VerifiedBusinessModal({ open, onOpenChange, profileId, displayName }: Props) {
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<BusinessDetails | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("business_details")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle()
      .then(({ data }) => {
        setDetails(data ?? null);
        setLoading(false);
      });
  }, [open, profileId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BadgeCheck className="h-5 w-5 fill-verified text-verified-foreground" />
            Verified business
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <p className="text-lg font-bold text-foreground">{displayName}</p>
          {details?.category && (
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{details.category}</p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !details ? (
          <p className="py-4 text-sm text-muted-foreground">
            This business hasn’t added public details yet.
          </p>
        ) : (
          <div className="space-y-3 pt-2 text-sm">
            <Row icon={Building2} label="Associations" value={details.associations} />
            <Row icon={Hash} label="Registration №" value={details.registration_number} />
            <Row
              icon={MapPin}
              label="Location"
              value={[details.address, details.country].filter(Boolean).join(", ") || null}
            />
            <Row
              icon={Mail}
              label="Email"
              value={details.contact_email}
              href={details.contact_email ? `mailto:${details.contact_email}` : null}
            />
            <Row
              icon={Phone}
              label="Phone"
              value={details.contact_phone}
              href={details.contact_phone ? `tel:${details.contact_phone}` : null}
            />
            <Row
              icon={Globe}
              label="Website"
              value={details.website}
              href={details.website}
              external
            />

            {SOCIAL_KEYS.some((s) => details[s.key]) && (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Social
                </p>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_KEYS.map((s) => {
                    const v = details[s.key] as string | null;
                    if (!v) return null;
                    return (
                      <a
                        key={s.key}
                        href={v.startsWith("http") ? v : `https://${v}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        {s.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  href,
  external,
}: {
  icon: typeof Building2;
  label: string;
  value: string | null | undefined;
  href?: string | null;
  external?: boolean;
}) {
  if (!value) return null;
  const content = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-foreground">{value}</p>
      </div>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer noopener" : undefined}
        className="flex items-start gap-3 rounded-lg p-1 -mx-1 hover:bg-accent"
      >
        {content}
      </a>
    );
  }
  return <div className="flex items-start gap-3">{content}</div>;
}
