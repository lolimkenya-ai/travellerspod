-- Optimized RPC Functions for Performance

-- 1. Get Conversation Inbox with single query
CREATE OR REPLACE FUNCTION public.get_conversation_inbox(_user_id UUID, _limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  is_inquiry BOOLEAN,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  my_last_read TIMESTAMPTZ,
  other_user_id UUID,
  other_nametag TEXT,
  other_display_name TEXT,
  other_avatar_url TEXT,
  other_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.is_inquiry,
    c.last_message,
    c.last_message_at,
    cp.last_read_at,
    p.id,
    p.nametag,
    p.display_name,
    p.avatar_url,
    p.verified
  FROM conversations c
  JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = _user_id
  JOIN conversation_participants cp_other ON c.id = cp_other.conversation_id AND cp_other.user_id != _user_id
  JOIN profiles p ON cp_other.user_id = p.id
  ORDER BY c.last_message_at DESC
  LIMIT _limit;
END;
$$;

-- 2. Get Messages for Thread with Pagination
CREATE OR REPLACE FUNCTION public.get_thread_messages(
  _conversation_id UUID,
  _limit INT DEFAULT 50,
  _offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  body TEXT,
  created_at TIMESTAMPTZ,
  sender_nametag TEXT,
  sender_display_name TEXT,
  sender_avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.body,
    m.created_at,
    p.nametag,
    p.display_name,
    p.avatar_url
  FROM messages m
  JOIN profiles p ON m.sender_id = p.id
  WHERE m.conversation_id = _conversation_id
  ORDER BY m.created_at DESC
  LIMIT _limit
  OFFSET _offset;
END;
$$;

-- 3. Get Moderation Queue with Filters
CREATE OR REPLACE FUNCTION public.get_moderation_queue(
  _status TEXT DEFAULT 'open',
  _limit INT DEFAULT 50,
  _offset INT DEFAULT 0
)
RETURNS TABLE (
  report_id UUID,
  status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ,
  post_id UUID,
  caption TEXT,
  media_type TEXT,
  post_created_at TIMESTAMPTZ,
  post_removed_at TIMESTAMPTZ,
  author_id UUID,
  author_nametag TEXT,
  author_display_name TEXT,
  author_avatar TEXT,
  author_verified BOOLEAN,
  total_reports_for_post INT,
  reporter_nametag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (has_role(v_caller, 'moderator'::app_role) OR has_role(v_caller, 'admin'::app_role) OR has_role(v_caller, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    cr.id,
    cr.status::TEXT,
    cr.reason::TEXT,
    cr.created_at,
    p.id,
    p.caption,
    p.media_type::TEXT,
    p.created_at,
    p.removed_at,
    prof.id,
    prof.nametag,
    prof.display_name,
    prof.avatar_url,
    prof.verified,
    COUNT(*) OVER (PARTITION BY cr.post_id)::INT,
    reporter.nametag
  FROM content_reports cr
  LEFT JOIN posts p ON cr.post_id = p.id
  LEFT JOIN profiles prof ON p.author_id = prof.id
  LEFT JOIN profiles reporter ON cr.reporter_id = reporter.id
  WHERE (_status IS NULL OR cr.status::TEXT = _status)
  ORDER BY cr.created_at DESC
  LIMIT _limit
  OFFSET _offset;
END;
$$;

-- 4. Get User Statistics for Admin Dashboard
CREATE OR REPLACE FUNCTION public.get_user_statistics(_user_id UUID)
RETURNS TABLE (
  total_posts BIGINT,
  total_likes_given BIGINT,
  total_likes_received BIGINT,
  following_count BIGINT,
  followers_count BIGINT,
  last_post_date TIMESTAMPTZ,
  account_created_at TIMESTAMPTZ,
  is_verified BOOLEAN,
  verification_status TEXT,
  account_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT posts.id),
    COUNT(DISTINCT pl.id),
    COALESCE(SUM(CASE WHEN posts.id IS NOT NULL THEN posts.likes_count ELSE 0 END), 0),
    COUNT(DISTINCT f1.followee_id),
    COUNT(DISTINCT f2.follower_id),
    MAX(posts.created_at),
    p.created_at,
    p.verified,
    p.verification_status::TEXT,
    p.account_type::TEXT
  FROM profiles p
  LEFT JOIN posts ON p.id = posts.author_id AND posts.removed_at IS NULL
  LEFT JOIN post_likes pl ON p.id = pl.user_id
  LEFT JOIN follows f1 ON p.id = f1.follower_id
  LEFT JOIN follows f2 ON p.id = f2.followee_id
  WHERE p.id = _user_id
  GROUP BY p.id, p.created_at, p.verified, p.verification_status, p.account_type;
END;
$$;

-- 5. Get Pending Verifications with Details
CREATE OR REPLACE FUNCTION public.get_pending_verifications(_limit INT DEFAULT 50, _offset INT DEFAULT 0)
RETURNS TABLE (
  profile_id UUID,
  nametag TEXT,
  display_name TEXT,
  avatar_url TEXT,
  verified BOOLEAN,
  verification_status TEXT,
  account_type TEXT,
  business_name TEXT,
  website TEXT,
  tra_listing_url TEXT,
  kata_listing_url TEXT,
  kato_listing_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  verification_reviews_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (has_role(v_caller, 'admin'::app_role) OR has_role(v_caller, 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    prof.id,
    prof.nametag,
    prof.display_name,
    prof.avatar_url,
    prof.verified,
    prof.verification_status::TEXT,
    prof.account_type::TEXT,
    bd.business_name,
    bd.website,
    bd.tra_listing_url,
    bd.kata_listing_url,
    bd.kato_listing_url,
    prof.created_at,
    prof.updated_at,
    COUNT(DISTINCT vr.id)
  FROM profiles prof
  LEFT JOIN business_details bd ON prof.id = bd.profile_id
  LEFT JOIN verification_ai_reviews vr ON prof.id = vr.profile_id
  WHERE prof.account_type IN ('business', 'organization')
    AND prof.verification_status IN ('pending', 'under_review')
  GROUP BY prof.id, prof.nametag, prof.display_name, prof.avatar_url, prof.verified,
           prof.verification_status, prof.account_type, bd.business_name, bd.website,
           bd.tra_listing_url, bd.kata_listing_url, bd.kato_listing_url, prof.created_at, prof.updated_at
  ORDER BY prof.created_at ASC
  LIMIT _limit
  OFFSET _offset;
END;
$$;

-- 6. Bulk Flag Users (for Superadmin)
CREATE OR REPLACE FUNCTION public.bulk_flag_users(_user_ids UUID[], _reason TEXT, _flag_type TEXT)
RETURNS TABLE (
  user_id UUID,
  flagged_at TIMESTAMPTZ,
  success BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_user_id UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT has_role(v_caller, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOREACH v_user_id IN ARRAY _user_ids
  LOOP
    INSERT INTO user_flags (user_id, reason, flag_type, flagged_by, created_at)
    VALUES (v_user_id, _reason, _flag_type, v_caller, now())
    ON CONFLICT (user_id, flag_type) DO UPDATE SET
      reason = EXCLUDED.reason,
      flagged_by = EXCLUDED.flagged_by,
      created_at = now();

    RETURN QUERY SELECT v_user_id, now(), true;
  END LOOP;
END;
$$;

-- 7. Get System Statistics for Superadmin Dashboard
CREATE OR REPLACE FUNCTION public.get_system_statistics()
RETURNS TABLE (
  total_users BIGINT,
  total_posts BIGINT,
  total_reports BIGINT,
  open_reports BIGINT,
  removed_posts BIGINT,
  verified_businesses BIGINT,
  pending_verifications BIGINT,
  total_messages BIGINT,
  active_conversations BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT has_role(v_caller, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT p.id),
    COUNT(DISTINCT posts.id),
    COUNT(DISTINCT cr.id),
    COUNT(DISTINCT CASE WHEN cr.status = 'open' THEN cr.id END),
    COUNT(DISTINCT CASE WHEN posts.removed_at IS NOT NULL THEN posts.id END),
    COUNT(DISTINCT CASE WHEN prof.verified = true AND prof.account_type IN ('business', 'organization') THEN prof.id END),
    COUNT(DISTINCT CASE WHEN prof.verification_status IN ('pending', 'under_review') THEN prof.id END),
    COUNT(DISTINCT m.id),
    COUNT(DISTINCT c.id)
  FROM profiles p
  LEFT JOIN posts ON p.id = posts.author_id
  LEFT JOIN content_reports cr ON posts.id = cr.post_id
  LEFT JOIN profiles prof ON prof.account_type IN ('business', 'organization')
  LEFT JOIN messages m ON true
  LEFT JOIN conversations c ON true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_inbox(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_messages(UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderation_queue(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_statistics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_verifications(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_flag_users(UUID[], TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_statistics() TO authenticated;
