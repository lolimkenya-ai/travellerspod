import type { Board } from "./types";
import { ME_ID } from "./users";

export const BOARDS: Board[] = [
  {
    id: "b1",
    ownerId: ME_ID,
    name: "Bali 2026",
    location: "Bali, Indonesia",
    cover: [
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1604999333679-b86d54738315?w=400&h=400&fit=crop",
    ],
    postIds: ["p1", "p9"],
  },
  {
    id: "b2",
    ownerId: ME_ID,
    name: "Tokyo Eats",
    location: "Tokyo, Japan",
    cover: [
      "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=400&h=400&fit=crop",
      "https://images.unsplash.com/photo-1554502078-ef0fc409efce?w=400&h=400&fit=crop",
    ],
    postIds: ["p5", "p10"],
  },
  {
    id: "b3",
    ownerId: ME_ID,
    name: "Patagonia dreams",
    location: "Patagonia, Chile",
    cover: ["https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&h=400&fit=crop"],
    postIds: ["p3"],
  },
  {
    id: "b4",
    ownerId: ME_ID,
    name: "Honeymoon shortlist",
    location: "Maldives",
    cover: ["https://images.unsplash.com/photo-1540541338287-41700207dee6?w=400&h=400&fit=crop"],
    postIds: ["p2"],
  },
];
