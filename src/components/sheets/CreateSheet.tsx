import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Video, Image as ImageIcon, Type, Loader2, X, Megaphone, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

type Kind = "video" | "image" | "text";
type Step = "choose" | "compose";

const TEXT_THEMES: { bg: string; fg: string }[] = [
  { bg: "linear-gradient(135deg,#0F172A,#1E293B)", fg: "#F8FAFC" },
  { bg: "linear-gradient(135deg,#F97316,#EA580C)", fg: "#FFF7ED" },
  { bg: "linear-gradient(135deg,#0EA5E9,#0369A1)", fg: "#F0F9FF" },
  { bg: "linear-gradient(135deg,#16A34A,#065F46)", fg: "#F0FDF4" },
  { bg: "linear-gradient(135deg,#DB2777,#7C2D12)", fg: "#FDF2F8" },
];

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export function CreateSheet({ open, onOpenChange, onCreated }: Props) {
  const { user, profile } = useAuth();
  const { categories } = useCategories();
  const isOrg = profile?.account_type === "organization";

  const [step, setStep] = useState<Step>("choose");
  const [kind, setKind] = useState<Kind>("image");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [theme, setTheme] = useState(0);
  const [broadcast, setBroadcast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Reset state when the sheet closes
  useEffect(() => {
    if (!open) {
      setStep("choose");
      setFile(null);
      setPreview(null);
      setCaption("");
      setLocation("");
      setCategorySlug("");
      setTheme(0);
      setBroadcast(false);
      setBusy(false);
      setProgress(null);
    }
  }, [open]);

  // Manage the local preview URL lifecycle
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(k: Kind) {
    setKind(k);
    setStep("compose");
    if (k !== "text") {
      // Trigger native picker on next tick after the input mounts
      setTimeout(() => fileRef.current?.click(), 50);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (kind === "video" && !isVideo) {
      toast.error("Please pick a video file");
      return;
    }
    if (kind === "image" && !isImage) {
      toast.error("Please pick an image file");
      return;
    }
    const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (f.size > max) {
      toast.error(`File too large — max ${isVideo ? "100 MB" : "10 MB"}`);
      return;
    }
    setFile(f);
  }

  /** Capture a single video poster frame at ~1s and return as a Blob. */
  async function captureVideoPoster(videoFile: File): Promise<Blob | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(videoFile);
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.preload = "metadata";
      v.crossOrigin = "anonymous";
      const cleanup = () => URL.revokeObjectURL(url);
      v.onloadedmetadata = () => {
        const target = Math.min(1, v.duration / 4);
        const onSeeked = () => {
          const c = document.createElement("canvas");
          const w = v.videoWidth || 720;
          const h = v.videoHeight || 1280;
          // Cap poster size so it stays small
          const scale = Math.min(720 / w, 1);
          c.width = Math.round(w * scale);
          c.height = Math.round(h * scale);
          const ctx = c.getContext("2d");
          if (!ctx) {
            cleanup();
            resolve(null);
            return;
          }
          ctx.drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(
            (b) => {
              cleanup();
              resolve(b);
            },
            "image/jpeg",
            0.78,
          );
        };
        v.currentTime = target;
        v.onseeked = onSeeked;
      };
      v.onerror = () => {
        cleanup();
        resolve(null);
      };
    });
  }

  async function uploadFile(bucket: "posts", file: Blob, ext: string): Promise<string> {
    if (!user) throw new Error("Not signed in");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function publish() {
    if (!user) {
      toast.error("Sign in to post");
      return;
    }
    if (caption.trim().length < 1) {
      toast.error("Add a caption");
      return;
    }
    if (kind !== "text" && !file) {
      toast.error(kind === "video" ? "Pick a video" : "Pick an image");
      return;
    }
    if (broadcast && !isOrg) {
      toast.error("Only organization accounts can broadcast");
      return;
    }

    setBusy(true);
    try {
      let media_url: string | null = null;
      let poster_url: string | null = null;
      let text_background: string | null = null;
      let text_foreground: string | null = null;

      if (kind === "image" && file) {
        setProgress("Uploading image…");
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        media_url = await uploadFile("posts", file, ext);
      } else if (kind === "video" && file) {
        setProgress("Generating poster…");
        const poster = await captureVideoPoster(file);
        if (poster) {
          poster_url = await uploadFile("posts", poster, "jpg");
        }
        setProgress("Uploading video…");
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
        media_url = await uploadFile("posts", file, ext);
      } else if (kind === "text") {
        const t = TEXT_THEMES[theme];
        text_background = t.bg;
        text_foreground = t.fg;
      }

      setProgress("Publishing…");
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        media_type: kind,
        media_url,
        poster_url,
        text_background,
        text_foreground,
        caption: caption.trim(),
        location: location.trim() || null,
        category_slug: categorySlug || null,
        is_broadcast: broadcast && isOrg,
      });
      if (error) throw error;

      toast.success("Posted ✈️");
      window.dispatchEvent(new CustomEvent("posts:changed"));
      onOpenChange(false);
      onCreated?.();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-2xl border-border bg-card p-0 sm:h-[88dvh]"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-3 py-3 text-left">
          {step === "compose" ? (
            <button
              onClick={() => !busy && setStep("choose")}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent disabled:opacity-50"
              disabled={busy}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="h-9 w-9" />
          )}
          <SheetTitle className="text-base">
            {step === "choose" ? "Create" : kind === "text" ? "New text card" : kind === "video" ? "New video" : "New image"}
          </SheetTitle>
          <button
            onClick={() => !busy && onOpenChange(false)}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent disabled:opacity-50"
            disabled={busy}
          >
            <X className="h-5 w-5" />
          </button>
        </SheetHeader>

        {step === "choose" && (
          <div className="grid grid-cols-3 gap-3 p-4">
            <Tile icon={<Video className="h-6 w-6" />} label="Video" onClick={() => pick("video")} />
            <Tile icon={<ImageIcon className="h-6 w-6" />} label="Image" onClick={() => pick("image")} />
            <Tile icon={<Type className="h-6 w-6" />} label="Text card" onClick={() => pick("text")} />
          </div>
        )}

        {step === "compose" && (
          <div className="flex h-[calc(100%-56px)] flex-col">
            <input
              ref={fileRef}
              type="file"
              accept={kind === "video" ? "video/*" : "image/*"}
              onChange={onFileChange}
              className="hidden"
            />

            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
              {/* Media preview */}
              {kind === "image" && (
                <div
                  onClick={() => !busy && fileRef.current?.click()}
                  className="relative mb-4 flex aspect-[9/14] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted text-muted-foreground hover:bg-accent"
                >
                  {preview ? (
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-sm">
                      <ImageIcon className="h-7 w-7" />
                      Tap to choose an image
                    </div>
                  )}
                </div>
              )}

              {kind === "video" && (
                <div
                  onClick={() => !busy && fileRef.current?.click()}
                  className="relative mb-4 flex aspect-[9/14] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-black text-muted-foreground hover:bg-accent/30"
                >
                  {preview ? (
                    <video src={preview} muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-sm text-foreground/70">
                      <Video className="h-7 w-7" />
                      Tap to choose a video
                    </div>
                  )}
                </div>
              )}

              {kind === "text" && (
                <>
                  <div
                    className="mb-3 flex aspect-[9/14] w-full items-center justify-center rounded-xl p-6"
                    style={{ background: TEXT_THEMES[theme].bg }}
                  >
                    <p
                      className="whitespace-pre-line text-balance text-center text-xl font-bold leading-snug"
                      style={{ color: TEXT_THEMES[theme].fg }}
                    >
                      {caption || "Your text card preview…"}
                    </p>
                  </div>
                  <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                    {TEXT_THEMES.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => setTheme(i)}
                        aria-label={`Theme ${i + 1}`}
                        className={cn(
                          "h-9 w-9 shrink-0 rounded-full ring-2 transition-all",
                          theme === i ? "ring-foreground" : "ring-transparent",
                        )}
                        style={{ background: t.bg }}
                      />
                    ))}
                  </div>
                </>
              )}

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                placeholder="Write a caption…"
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>Required</span>
                <span>{caption.length}/2200</span>
              </div>

              <input
                value={location}
                onChange={(e) => setLocation(e.target.value.slice(0, 120))}
                placeholder="Location (e.g. Uluwatu, Bali)"
                className="mt-3 w-full rounded-full border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />

              {/* Category */}
              {categories.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Category
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <button
                        key={c.slug}
                        onClick={() => setCategorySlug((s) => (s === c.slug ? "" : c.slug))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                          categorySlug === c.slug
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isOrg && (
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <input
                    type="checkbox"
                    checked={broadcast}
                    onChange={(e) => setBroadcast(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Megaphone className="h-3.5 w-3.5 text-primary" /> Broadcast this post
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Pinned in the Broadcasts feed and sprinkled into Discover.
                    </span>
                  </span>
                </label>
              )}
            </div>

            <div className="border-t border-border bg-card p-3">
              <button
                onClick={publish}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? progress ?? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Tile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted p-5 text-foreground transition-colors hover:bg-accent"
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
