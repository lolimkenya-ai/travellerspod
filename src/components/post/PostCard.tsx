import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Megaphone, Repeat2 } from "lucide-react";
import { AuthorChip } from "./AuthorChip";
import { PostActionBar } from "./PostActionBar";
import { VideoPlayer } from "./VideoPlayer";
import { CommentSheet } from "../sheets/CommentSheet";
import { RepostSheet } from "../sheets/RepostSheet";
import { SaveBoardSheet } from "../sheets/SaveBoardSheet";
import { getUser } from "@/data/users";
import type { Post } from "@/data/types";

export function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const author = getUser(post.authorId);
  const [openSheet, setOpenSheet] = useState<null | "comment" | "repost" | "save">(null);
  const [galleryIdx, setGalleryIdx] = useState(0);

  const showInquire = author.accountType === "business" && author.verified;

  const handleInquire = () => {
    // The thread page resolves/creates the real conversation via the start_dm RPC.
    navigate(`/messages/new?to=${post.authorId}&postId=${post.id}&inquiry=1`);
  };

  // Build a unified gallery: cover + extras (only for image posts).
  const images =
    post.media.type === "image"
      ? [{ src: post.media.src }, ...(post.gallery?.filter((g) => g.type === "image") ?? [])]
      : [];

  return (
    <article className="bg-card overflow-hidden border-b border-border">
      <div className="px-4 pt-4 pb-3">
        <AuthorChip post={post} />
        {post.isBroadcast && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            <Megaphone className="h-3 w-3" /> Broadcast
          </div>
        )}
      </div>

      {/* Quote header (WhatsApp-style) */}
      {post.quote && (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl border-l-4 border-primary bg-muted/60">
          <div className="flex items-center gap-2 px-3 pt-2">
            <Repeat2 className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Reposted
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
        </div>
      )}

      {/* Media */}
      {post.media.type === "video" && <VideoPlayer post={post} />}
      {post.media.type === "image" && (
        <div className="relative w-full bg-muted">
          <div className="aspect-[9/14] w-full overflow-hidden">
            <img
              src={images[galleryIdx]?.src ?? post.media.src}
              alt={post.caption}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          {images.length > 1 && (
            <>
              <div className="absolute right-2 top-2 rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-semibold text-background">
                {galleryIdx + 1}/{images.length}
              </div>
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIdx(i)}
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
    </article>
  );
}
