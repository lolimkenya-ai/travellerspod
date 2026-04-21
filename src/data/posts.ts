import type { Post } from "./types";

// Public sample MP4s (Google's published test pool)
const SAMPLE_VIDEO_1 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const SAMPLE_VIDEO_2 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";
const SAMPLE_VIDEO_3 = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

export const POSTS: Post[] = [
  {
    id: "p1",
    authorId: "u1",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=900&h=1600&fit=crop",
    },
    caption: "Sunrise at Uluwatu — worth the 4am alarm. Wave watch from the cliff edge before the crowds hit. 🌅",
    location: "Uluwatu, Bali",
    category: "Destinations",
    createdAt: "2026-04-19T22:14:00Z",
    likes: 1248,
    comments: 84,
    reposts: 31,
  },
  {
    id: "p2",
    authorId: "u3",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=900&h=1600&fit=crop",
    },
    caption: "Overwater villa #14 just opened up for May. Private infinity pool + house reef snorkeling at your door.",
    location: "Kuda Rah, Maldives",
    category: "Hotels & Resorts",
    createdAt: "2026-04-20T08:02:00Z",
    likes: 5640,
    comments: 312,
    reposts: 88,
  },
  {
    id: "p3",
    authorId: "u2",
    media: {
      type: "video",
      src: SAMPLE_VIDEO_1,
      poster: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&h=1600&fit=crop",
    },
    caption: "Final push to the summit at 4,200m. The clouds opened up for ten seconds and that was enough.",
    location: "Torres del Paine, Chile",
    category: "Mountains",
    createdAt: "2026-04-18T15:40:00Z",
    likes: 8821,
    comments: 521,
    reposts: 204,
  },
  {
    id: "p4",
    authorId: "u4",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=900&h=1600&fit=crop",
    },
    caption: "Great migration is early this year. Mara crossings happening daily — 3 spots left on our June expedition.",
    location: "Maasai Mara, Kenya",
    category: "Safari",
    createdAt: "2026-04-21T06:11:00Z",
    likes: 3420,
    comments: 188,
    reposts: 67,
  },
  {
    id: "p5",
    authorId: "u6",
    media: {
      type: "text",
      background: "linear-gradient(135deg, hsl(18 96% 58%), hsl(28 100% 64%))",
      foreground: "#0a0a0a",
    },
    caption:
      "Tokyo ramen rules:\n\n1. Tsuta (Sugamo) — truffle shoyu, worth the wait\n2. Nakiryu (Otsuka) — best tantanmen in the city\n3. Afuri (Ebisu) — yuzu shio that ruins all other ramen\n\nSave this for your next trip 🍜",
    location: "Tokyo, Japan",
    category: "Food",
    createdAt: "2026-04-20T11:30:00Z",
    likes: 2104,
    comments: 142,
    reposts: 612,
  },
  {
    id: "p6",
    authorId: "u5",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=900&h=1600&fit=crop",
    },
    caption:
      "✈️ Limited offer: Book Frankfurt → Tokyo in business class with 30% off until April 30. Tap to learn more.",
    location: "Worldwide",
    category: "Destinations",
    createdAt: "2026-04-21T05:00:00Z",
    likes: 9210,
    comments: 482,
    reposts: 1240,
    isBroadcast: true,
    isAd: true,
  },
  {
    id: "p7",
    authorId: "u7",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=900&h=1600&fit=crop",
    },
    caption: "Three days in Paris, no plan, just walking. Best city for getting deliciously lost.",
    location: "Paris, France",
    category: "City",
    createdAt: "2026-04-19T19:22:00Z",
    likes: 712,
    comments: 41,
    reposts: 9,
  },
  {
    id: "p8",
    authorId: "u2",
    media: {
      type: "video",
      src: SAMPLE_VIDEO_3,
      poster: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900&h=1600&fit=crop",
    },
    caption: "Skiing the backcountry of Hokkaido — knee-deep powder, zero people. Audio on for the silence.",
    location: "Niseko, Japan",
    category: "Adventure",
    createdAt: "2026-04-17T09:15:00Z",
    likes: 5310,
    comments: 287,
    reposts: 122,
  },
  {
    id: "p9",
    authorId: "u1",
    media: {
      type: "image",
      src: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?w=900&h=1600&fit=crop",
    },
    caption: "Beach hopping the south coast. This one is unnamed on every map I checked.",
    location: "Lombok, Indonesia",
    category: "Beach",
    createdAt: "2026-04-16T13:08:00Z",
    likes: 3041,
    comments: 124,
    reposts: 42,
  },
  {
    id: "p10",
    authorId: "u6",
    media: {
      type: "video",
      src: SAMPLE_VIDEO_2,
      poster: "https://images.unsplash.com/photo-1542640244-7e672d6cef4e?w=900&h=1600&fit=crop",
    },
    caption: "Kyoto temple at first light. Tap to hear the bells.",
    location: "Kyoto, Japan",
    category: "Culture",
    createdAt: "2026-04-15T22:00:00Z",
    likes: 4120,
    comments: 198,
    reposts: 76,
  },
];

export function getPost(id: string) {
  return POSTS.find((p) => p.id === id);
}
