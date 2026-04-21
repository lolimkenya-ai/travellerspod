import type { Comment } from "./types";

export const COMMENTS: Record<string, Comment[]> = {
  p1: [
    {
      id: "c1",
      postId: "p1",
      authorId: "u2",
      body: "That cliff is unreal. What time did you start the hike?",
      createdAt: "2026-04-20T01:00:00Z",
      likes: 24,
      replies: [
        {
          id: "c1r1",
          postId: "p1",
          authorId: "u1",
          body: "Left the villa around 4:15am — surf was glassy by 5:30",
          createdAt: "2026-04-20T01:15:00Z",
          likes: 8,
        },
      ],
    },
    {
      id: "c2",
      postId: "p1",
      authorId: "u7",
      body: "Reposting this to my Bali board — bookmarked!",
      createdAt: "2026-04-20T03:42:00Z",
      likes: 12,
      inlineRepost: {
        authorId: "u7",
        body: "Adding this to my Bali 2026 trip plan. Sunrise at Uluwatu = non-negotiable.",
      },
    },
  ],
  p2: [
    {
      id: "c3",
      postId: "p2",
      authorId: "u1",
      body: "Booked! Inquiring about transfer from MLE 🙌",
      createdAt: "2026-04-20T09:00:00Z",
      likes: 6,
    },
  ],
  p3: [
    {
      id: "c4",
      postId: "p3",
      authorId: "u4",
      body: "Patagonia in autumn is a different planet.",
      createdAt: "2026-04-18T16:00:00Z",
      likes: 31,
    },
  ],
};

export function getComments(postId: string): Comment[] {
  return COMMENTS[postId] ?? [];
}
