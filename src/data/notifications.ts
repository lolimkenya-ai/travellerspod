import type { Notification } from "./types";

export const NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "like", actorId: "u1", postId: "p1", createdAt: "2026-04-21T07:42:00Z" },
  { id: "n2", type: "follow", actorId: "u4", createdAt: "2026-04-21T06:10:00Z" },
  { id: "n3", type: "comment", actorId: "u2", postId: "p3", body: "Patagonia in autumn is a different planet.", createdAt: "2026-04-20T22:00:00Z" },
  { id: "n4", type: "repost", actorId: "u7", postId: "p1", createdAt: "2026-04-20T15:00:00Z" },
  { id: "n5", type: "inquiry", actorId: "u3", body: "New inquiry about overwater villa #14", createdAt: "2026-04-21T07:00:00Z" },
  { id: "n6", type: "like", actorId: "u6", postId: "p5", createdAt: "2026-04-20T11:31:00Z" },
];
