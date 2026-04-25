export type AccountType = "normal" | "business" | "organization";

export interface User {
  id: string;
  nametag: string; // unique handle
  displayName: string;
  avatar: string;
  bio?: string;
  accountType: AccountType;
  verified?: boolean; // verified business
  category?: string; // business category
  followers: number;
  following: number;
}

export type PostMedia =
  | { type: "video"; src: string; poster: string }
  | { type: "image"; src: string }
  | { type: "text"; background: string; foreground: string };

export interface Post {
  id: string;
  authorId: string;
  media: PostMedia;
  caption: string;
  location: string;
  category: string;
  createdAt: string;
  likes: number;
  comments: number;
  reposts: number;
  isBroadcast?: boolean;
  isAd?: boolean;
  /** Extra images/videos beyond the cover `media`. */
  gallery?: { type: "image" | "video"; src: string; poster?: string }[];
  /** Snapshot of a quoted/reposted post. */
  quote?: {
    id: string;
    caption: string;
    authorNametag: string;
    authorDisplayName: string;
    authorAvatar: string | null;
    cover: string | null;
    mediaType: "image" | "video" | "text";
  } | null;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  likes: number;
  replies?: Comment[];
  inlineRepost?: { authorId: string; body: string };
}

export interface Board {
  id: string;
  ownerId: string;
  name: string;
  location: string;
  cover: string[]; // up to 4 image urls
  postIds: string[];
}

export interface Conversation {
  id: string;
  participantIds: string[]; // [me, other]
  lastMessage: string;
  lastAt: string;
  unread: number;
  isInquiry?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "repost" | "inquiry";
  actorId: string;
  postId?: string;
  body?: string;
  createdAt: string;
  read?: boolean;
}
