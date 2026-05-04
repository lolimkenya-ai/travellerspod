import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flag, Megaphone, MoreHorizontal, Repeat2 } from "lucide-react";
import { AuthorChip } from "./AuthorChip";
import { PostActionBar } from "./PostActionBar";
import { VideoPlayer } from "./VideoPlayer";
import { CommentSheet } from "../sheets/CommentSheet";
import { RepostSheet } from "../sheets/RepostSheet";
import { SaveBoardSheet } from "../sheets/SaveBoardSheet";
import { ReportSheet } from "../sheets/ReportSheet";
import { EnquiryFormSheet } from "../sheets/EnquiryFormSheet";
import { getUser } from "@/data/users";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Post } from "@/data/types";

export function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const author = getUser(post.authorId);
  const [openSheet, setOpenSheet] = useState<null | "comment" | "repost" | "save" | "report" | "enquire">(null);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const showInquire = author.accountType === "business" && author.verified;

  const handleInquire = () => {
    setOpenSheet("enquire");
  };

  // Build a unified gallery: cover + extras (only for image posts).
  const images =
    post.media.type === "image"
      ? [{ src: post.media.src }, ...(post.gallery?.filter((g) => g.type === "image") ?? [])]
      : [];

  // ── Swipe support for multi-image posts ──────────────────────────────
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  const dx = useRef(0);

  const goTo = (i: number) => {
    if (images.length === 0) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    setGalleryIdx(next);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    dx.current = 0;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    dx.current = e.touches[0].clientX - startX.current;
  };
  const onTouchEnd = () => {
    const threshold = 40;
    if (dx.current > threshold) goTo(galleryIdx - 1);
    else if (dx.current < -threshold) goTo(galleryIdx + 1);
    startX.current = null;
    dx.current = 0;
  };

  // Keyboard support when focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!trackRef.current) return;
      if (document.activeElement !== trackRef.current) return;
      if (e.key === "ArrowRight") goTo(galleryIdx + 1);
      if (e.key === "ArrowLeft") goTo(galleryIdx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryIdx, images.length]);

  return (
    <article className="bg-card overflow-hidden border-b border-border">
      <div className="flex items-start gap-2 px-4 pt-4 pb-3">
        <div className="min-w-0 flex-1">
          <AuthorChip post={post} />
          {post.isBroadcast && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
              <Megaphone className="h-3 w-3" /> Broadcast
            </div>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More options"
            className="-mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setOpenSheet("report")} className="text-destructive">
              <Flag className="mr-2 h-4 w-4" /> Report post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Quote header — clickable to open the original */}
      {post.quote && (
        <button
          type="button"
          onClick={() => navigate(`/post/${post.quote!.id}`)}
          className="mx-4 mb-3 block w-[calc(100%-2rem)] overflow-hidden rounded-2xl border-l-4 border-primary bg-muted/60 text-left transition-colors hover:bg-muted"
          aria-label="Open referenced post"
        >
          <div className="flex items-center gap-2 px-3 pt-2">
            <Repeat2 className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Reposted — tap to open
            </span>
          </div>
          <div className="flex gap-3 px-3 py-2">
            {post.quote.cover && (
              <img
                src={post.quote.cover}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                @{post.quote.authorNametag}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {post.quote.caption}
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Media */}
      {post.media.type === "video" && <VideoPlayer post={post} />}
      {post.media.type === "image" && (
        <div
          ref={trackRef}
          tabIndex={0}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="relative w-full select-none bg-muted outline-none"
        >
          <div className="aspect-[9/14] w-full overflow-hidden">
            <img
              src={images[galleryIdx]?.src ?? post.media.src}
              alt={post.caption}
              className="h-full w-full object-cover"
              loading="lazy"
              draggable={false}
            />
          </div>
          {images.length > 1 && (
            <>
              <div className="absolute right-2 top-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-semibold text-background">
                {galleryIdx + 1}/{images.length}
              </div>
              {/* Desktop chevrons */}
              {galleryIdx > 0 && (
                <button
                  onClick={() => goTo(galleryIdx - 1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm md:flex"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {galleryIdx < images.length - 1 && (
                <button
                  onClick={() => goTo(galleryIdx + 1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur-sm md:flex"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Image ${i + 1}`}
                    className={
                      "h-1.5 rounded-full transition-all " +
                      (i === galleryIdx ? "w-4 bg-background" : "w-1.5 bg-background/60")
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {post.media.type === "text" && (
        <div
          className="flex aspect-[9/14] w-full items-center justify-center p-8"
          style={{ background: post.media.background }}
        >
          <p
            className="whitespace-pre-line text-balance text-center text-xl font-bold leading-snug"
            style={{ color: post.media.foreground }}
          >
            {post.caption}
          </p>
        </div>
      )}

      {/* Caption (only for video/image) */}
      {post.media.type !== "text" && post.caption && (
        <div className="px-4 py-3 text-sm leading-relaxed text-foreground">
          <p className="whitespace-pre-line">{post.caption}</p>
        </div>
      )}

      <PostActionBar
        post={post}
        onComment={() => setOpenSheet("comment")}
        onRepost={() => setOpenSheet("repost")}
        onSave={() => setOpenSheet("save")}
        onInquire={handleInquire}
        showInquire={showInquire}
      />

      <CommentSheet open={openSheet === "comment"} onOpenChange={(o) => setOpenSheet(o ? "comment" : null)} post={post} />
      <RepostSheet open={openSheet === "repost"} onOpenChange={(o) => setOpenSheet(o ? "repost" : null)} post={post} />
      <SaveBoardSheet open={openSheet === "save"} onOpenChange={(o) => setOpenSheet(o ? "save" : null)} post={post} />
      <ReportSheet open={openSheet === "report"} onOpenChange={(o) => setOpenSheet(o ? "report" : null)} postId={post.id} />
    </article>
  );
}
