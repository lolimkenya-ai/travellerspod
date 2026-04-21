// Default category list — also seeded into the DB `categories` table.
// We keep this here as a fallback for when the DB hasn't loaded yet.
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

export interface DbCategory {
  slug: string;
  label: string;
  sort_order: number;
}
