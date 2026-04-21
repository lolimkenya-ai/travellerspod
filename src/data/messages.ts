import type { Conversation, Message } from "./types";

export const CONVERSATIONS: Conversation[] = [
  {
    id: "conv1",
    participantIds: ["me", "u3"],
    lastMessage: "Villa #14 is reserved for you May 12–18. Want me to send the booking link?",
    lastAt: "2026-04-21T07:30:00Z",
    unread: 2,
    isInquiry: true,
  },
  {
    id: "conv2",
    participantIds: ["me", "u1"],
    lastMessage: "let's meet in Ubud next week!",
    lastAt: "2026-04-20T18:14:00Z",
    unread: 0,
  },
  {
    id: "conv3",
    participantIds: ["me", "u4"],
    lastMessage: "Yes — June 8 expedition has 3 spots. Group of 2?",
    lastAt: "2026-04-19T11:00:00Z",
    unread: 1,
    isInquiry: true,
  },
  {
    id: "conv4",
    participantIds: ["me", "u2"],
    lastMessage: "haha you should try Hokkaido in Feb",
    lastAt: "2026-04-15T09:00:00Z",
    unread: 0,
  },
];

export const MESSAGES: Record<string, Message[]> = {
  conv1: [
    { id: "m1", conversationId: "conv1", authorId: "me", body: "Hi! Inquiring about overwater villa #14 for mid-May.", createdAt: "2026-04-21T07:00:00Z" },
    { id: "m2", conversationId: "conv1", authorId: "u3", body: "Hello! Yes, available. How many guests?", createdAt: "2026-04-21T07:10:00Z" },
    { id: "m3", conversationId: "conv1", authorId: "me", body: "Two adults, May 12–18.", createdAt: "2026-04-21T07:25:00Z" },
    { id: "m4", conversationId: "conv1", authorId: "u3", body: "Villa #14 is reserved for you May 12–18. Want me to send the booking link?", createdAt: "2026-04-21T07:30:00Z" },
  ],
  conv2: [
    { id: "m5", conversationId: "conv2", authorId: "u1", body: "let's meet in Ubud next week!", createdAt: "2026-04-20T18:14:00Z" },
  ],
  conv3: [
    { id: "m6", conversationId: "conv3", authorId: "me", body: "Inquiring about the June safari — any spots?", createdAt: "2026-04-19T10:30:00Z" },
    { id: "m7", conversationId: "conv3", authorId: "u4", body: "Yes — June 8 expedition has 3 spots. Group of 2?", createdAt: "2026-04-19T11:00:00Z" },
  ],
  conv4: [
    { id: "m8", conversationId: "conv4", authorId: "u2", body: "haha you should try Hokkaido in Feb", createdAt: "2026-04-15T09:00:00Z" },
  ],
};
