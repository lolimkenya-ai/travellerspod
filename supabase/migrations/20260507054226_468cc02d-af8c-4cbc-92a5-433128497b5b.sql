
-- 1. Boards: owner-only reads
DROP POLICY IF EXISTS "boards public read" ON public.boards;
CREATE POLICY "owner reads own boards"
ON public.boards FOR SELECT
USING (auth.uid() = owner_id);

-- board_posts: only the owning board's owner can read membership
DROP POLICY IF EXISTS "board_posts public read" ON public.board_posts;
CREATE POLICY "owner reads own board_posts"
ON public.board_posts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.boards b
  WHERE b.id = board_posts.board_id AND b.owner_id = auth.uid()
));

-- 2. post_likes: users see only their own likes (counts still come from posts.likes_count)
DROP POLICY IF EXISTS "likes public read" ON public.post_likes;
CREATE POLICY "users read own likes"
ON public.post_likes FOR SELECT
USING (auth.uid() = user_id);

-- 3. Profiles: hide internal moderation columns from public/authenticated reads.
-- Keep row-level public read but revoke column privileges on sensitive columns.
REVOKE SELECT (flagged_danger, danger_reason) ON public.profiles FROM anon, authenticated;
-- Admin-only access continues via the existing public.get_profile_moderation() SECURITY DEFINER function.
