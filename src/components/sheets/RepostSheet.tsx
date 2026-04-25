import { CreateSheet } from "./CreateSheet";
import { getUser } from "@/data/users";
import type { Post } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: Post;
}

/**
 * RepostSheet is a thin wrapper around CreateSheet in "quote" mode.
 * It pre-fills the original post header (like the WhatsApp-style quote in the
 * user's reference screenshot) and lets the reposter add their own caption +
 * optional new images / video / text.
 */
export function RepostSheet({ open, onOpenChange, post }: Props) {
  const author = getUser(post.authorId);
  return (
    <CreateSheet
      open={open}
      onOpenChange={onOpenChange}
      quotePostId={post.id}
      quoteSummary={{ author: author.nametag, caption: post.caption }}
    />
  );
}
