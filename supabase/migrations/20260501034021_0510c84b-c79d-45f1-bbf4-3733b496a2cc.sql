-- 1) Mirror `verified` as `is_verified` so the many client queries that select
--    is_verified stop silently failing. Generated, so it's always in sync.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean
  GENERATED ALWAYS AS (verification_status = 'verified') STORED;

CREATE INDEX IF NOT EXISTS profiles_is_verified_idx ON public.profiles(is_verified);

-- 2) Full-text search column on posts so unified search returns post results.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(caption, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(location, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category_slug, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS posts_search_vector_idx
  ON public.posts USING GIN (search_vector);

-- Trigram index to speed up the ilike fallback on captions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS posts_caption_trgm_idx
  ON public.posts USING GIN (caption gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx
  ON public.profiles USING GIN (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_nametag_trgm_idx
  ON public.profiles USING GIN (nametag gin_trgm_ops);

-- 3) Replace the generic taxonomy with the travel-business taxonomy the user requested.
--    We keep the old slugs around (so existing posts don't lose their category) by
--    simply inserting the new ones; admins can remove old ones from /access later.
INSERT INTO public.categories (slug, label, sort_order) VALUES
  ('bnb',         'BnB',           10),
  ('camping',     'Camping',       11),
  ('dinner-spot', 'Dinner Spot',   12),
  ('experience',  'Experience',    13),
  ('event',       'Event',         14),
  ('wellness',    'Wellness',      15),
  ('travel',      'Travel',        16)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;