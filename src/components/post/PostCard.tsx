import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Megaphone } from "lucide-react";
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

  const showInquire = author.accountType === "business" && author.verified;

  const handleInquire = () => {
    // navigate to message thread with that business
    const conv = `conv-${author.id}`;
    navigate(`/messages/${conv}?to=${author.id}&postId=${post.id}`);
  };

  return (
    <article className="bg-card overflow-hidden border-b border-border">
      {/* Author */}
      <div className="px-4 pt-4 pb-3">
        <AuthorChip post={post} />
        {post.isBroadcast && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
            <Megaphone className="h-3 w-3" /> Broadcast
          </div>
        )}
      </div>

      {/* Media */}
      {post.media.type === "video" && <VideoPlayer post={post} />}
      {post.media.type === "image" && (
        <div className="aspect-[9/14] w-full overflow-hidden bg-muted">
          <img src={post.media.src} alt={post.caption} className="h-full w-full object-cover" loading="lazy" />
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
      {post.media.type !== "text" && (
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
