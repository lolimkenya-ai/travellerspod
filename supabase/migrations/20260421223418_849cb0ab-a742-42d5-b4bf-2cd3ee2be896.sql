-- Replace broad public-read policies with ones that allow individual file
-- access but disallow bucket listing (which is what the linter flagged).
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "posts public read" on storage.objects;

-- For public buckets, the storage HTTP endpoint serves files directly without
-- consulting RLS, so listing was the only real exposure. We keep no SELECT
-- policy for these buckets — direct URL access still works because the
-- buckets are marked public.