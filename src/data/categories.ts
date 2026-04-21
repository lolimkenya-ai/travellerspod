export const CATEGORIES = [
  "All",
  "Destinations",
  "Hotels & Resorts",
  "Safari",
  "Beach",
  "Mountains",
  "Food",
  "Adventure",
  "City",
  "Culture",
] as const;

export type Category = (typeof CATEGORIES)[number];
