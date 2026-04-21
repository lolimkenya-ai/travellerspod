import type { User } from "./types";

export const USERS: User[] = [
  {
    id: "u1",
    nametag: "nora.wanders",
    displayName: "Nora Iwasaki",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    bio: "Sunrise chaser · 32 countries · Currently in Bali",
    accountType: "normal",
    followers: 24800,
    following: 312,
  },
  {
    id: "u2",
    nametag: "marco.trails",
    displayName: "Marco Diaz",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    bio: "Trail runner & mountain photographer",
    accountType: "normal",
    followers: 9420,
    following: 188,
  },
  {
    id: "u3",
    nametag: "amaya.resort",
    displayName: "Amaya Resort Maldives",
    avatar: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=200&h=200&fit=crop",
    bio: "Overwater villas · Kuda Rah Island · Member of LHW",
    accountType: "business",
    verified: true,
    category: "Hotels & Resorts",
    followers: 184000,
    following: 12,
  },
  {
    id: "u4",
    nametag: "sahara.expeditions",
    displayName: "Sahara Expeditions",
    avatar: "https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=200&h=200&fit=crop",
    bio: "Verified safari operator · Kenya & Tanzania",
    accountType: "business",
    verified: true,
    category: "Safari",
    followers: 56300,
    following: 24,
  },
  {
    id: "u5",
    nametag: "lufthansa",
    displayName: "Lufthansa",
    avatar: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=200&h=200&fit=crop",
    bio: "Official airline account",
    accountType: "organization",
    verified: true,
    category: "Airlines",
    followers: 2400000,
    following: 84,
  },
  {
    id: "u6",
    nametag: "kenji.eats",
    displayName: "Kenji Tanaka",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    bio: "Tokyo-based food writer",
    accountType: "normal",
    followers: 41200,
    following: 502,
  },
  {
    id: "u7",
    nametag: "lena.vagabond",
    displayName: "Lena Brooks",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    accountType: "normal",
    followers: 1840,
    following: 612,
  },
];

export const ME_ID = "me";
export const ME: User = {
  id: ME_ID,
  nametag: "you",
  displayName: "You",
  avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop",
  bio: "Welcome to travelpod",
  accountType: "normal",
  followers: 0,
  following: 0,
};

export const ALL_USERS = [...USERS, ME];

export function getUser(id: string): User {
  return ALL_USERS.find((u) => u.id === id) ?? ME;
}
