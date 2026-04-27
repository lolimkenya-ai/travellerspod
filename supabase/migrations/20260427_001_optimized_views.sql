-- Optimized Views for Performance

-- 1. Conversation Inbox View: Pre-joins conversations with participant and profile data
CREATE OR REPLACE VIEW public.conversation_inbox_view AS
SELECT
  c.id,
  c.is_inquiry,
  c.last_message,
  c.last_message_at,
  cp.user_id,
  cp.last_read_at,
  p.id as other_user_id,
  p.nametag,
  p.display_name,
  p.avatar_url,
  p.verified
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversation_id
JOIN conversation_participants cp_other ON c.id = cp_other.conversation_id AND cp_other.user_id != cp.user_id
JOIN profiles p ON cp_other.user_id = p.id
ORDER BY c.last_message_at DESC;

-- 2. User Roles View: Aggregates all roles for a user with role hierarchy
CREATE OR REPLACE VIEW public.user_roles_view AS
SELECT
  ur.user_id,
  ARRAY_AGG(DISTINCT ur.role) as roles,
  MAX(CASE WHEN ur.role = 'super_admin' THEN 1 ELSE 0 END) as is_super_admin,
  MAX(CASE WHEN ur.role IN ('super_admin', 'admin') THEN 1 ELSE 0 END) as is_admin,
  MAX(CASE WHEN ur.role IN ('super_admin', 'admin', 'moderator') THEN 1 ELSE 0 END) as is_moderator
FROM user_roles ur
GROUP BY ur.user_id;

-- 3. Content Reports with Post Details View
CREATE OR REPLACE VIEW public.content_reports_with_details AS
SELECT
  cr.id,
  cr.reporter_id,
  cr.post_id,
  cr.comment_id,
  cr.reason,
  cr.details,
  cr.status,
  cr.resolved_by,
  cr.resolved_at,
  cr.resolution_note,
  cr.created_at,
  p.id as post_author_id,
  p.caption as post_caption,
  p.media_type as post_media_type,
  p.created_at as post_created_at,
  prof.nametag as post_author_nametag,
  prof.display_name as post_author_display_name,
  prof.avatar_url as post_author_avatar,
  prof.verified as post_author_verified,
  reporter.nametag as reporter_nametag,
  reporter.display_name as reporter_display_name
FROM content_reports cr
LEFT JOIN posts p ON cr.post_id = p.id
LEFT JOIN profiles prof ON p.author_id = prof.id
LEFT JOIN profiles reporter ON cr.reporter_id = reporter.id;

-- 4. Pending Verifications View: Shows profiles awaiting verification with business details
CREATE OR REPLACE VIEW public.pending_verifications_view AS
SELECT
  prof.id,
  prof.nametag,
  prof.display_name,
  prof.avatar_url,
  prof.verified,
  prof.verification_status,
  prof.account_type,
  bd.business_name,
  bd.website,
  bd.tra_listing_url,
  bd.kata_listing_url,
  bd.kato_listing_url,
  prof.created_at,
  prof.updated_at,
  COUNT(DISTINCT vr.id) as verification_reviews_count
FROM profiles prof
LEFT JOIN business_details bd ON prof.id = bd.profile_id
LEFT JOIN verification_ai_reviews vr ON prof.id = vr.profile_id
WHERE prof.account_type IN ('business', 'organization')
  AND prof.verification_status IN ('pending', 'under_review')
GROUP BY prof.id, prof.nametag, prof.display_name, prof.avatar_url, prof.verified, 
         prof.verification_status, prof.account_type, bd.business_name, bd.website,
         bd.tra_listing_url, bd.kata_listing_url, bd.kato_listing_url, prof.created_at, prof.updated_at;

-- 5. User Activity Summary View: Aggregates user engagement metrics
CREATE OR REPLACE VIEW public.user_activity_summary AS
SELECT
  p.id as user_id,
  p.nametag,
  p.display_name,
  COUNT(DISTINCT posts.id) as total_posts,
  COUNT(DISTINCT pl.id) as total_likes_given,
  SUM(CASE WHEN posts.id IS NOT NULL THEN posts.likes_count ELSE 0 END) as total_likes_received,
  COUNT(DISTINCT f1.followee_id) as following_count,
  COUNT(DISTINCT f2.follower_id) as followers_count,
  MAX(posts.created_at) as last_post_date,
  p.created_at as account_created_at
FROM profiles p
LEFT JOIN posts ON p.id = posts.author_id AND posts.removed_at IS NULL
LEFT JOIN post_likes pl ON p.id = pl.user_id
LEFT JOIN follows f1 ON p.id = f1.follower_id
LEFT JOIN follows f2 ON p.id = f2.followee_id
GROUP BY p.id, p.nametag, p.display_name, p.created_at;

-- 6. Moderation Queue View: Shows flagged content with context
CREATE OR REPLACE VIEW public.moderation_queue_view AS
SELECT
  cr.id as report_id,
  cr.status,
  cr.reason,
  cr.created_at,
  p.id as post_id,
  p.caption,
  p.media_type,
  p.created_at as post_created_at,
  p.removed_at,
  prof.id as author_id,
  prof.nametag as author_nametag,
  prof.display_name as author_display_name,
  prof.avatar_url as author_avatar,
  prof.verified as author_verified,
  COUNT(*) OVER (PARTITION BY cr.post_id) as total_reports_for_post,
  reporter.nametag as reporter_nametag
FROM content_reports cr
LEFT JOIN posts p ON cr.post_id = p.id
LEFT JOIN profiles prof ON p.author_id = prof.id
LEFT JOIN profiles reporter ON cr.reporter_id = reporter.id
ORDER BY cr.created_at DESC;

-- Enable RLS on views (views inherit parent table RLS)
-- Views are read-only by nature, so no additional policies needed beyond parent tables
