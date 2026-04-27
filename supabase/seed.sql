-- Seed Data for Travellerspod

-- 1. Sample Categories
-- (Assuming categories table exists or is part of profiles/posts)

-- 2. Sample Businesses (Profiles)
-- Note: In a real Supabase environment, these would need to be in auth.users first.
-- This seed script is for structural reference and local development.

-- 3. Sample Posts with realistic travel content
INSERT INTO public.posts (id, author_id, caption, media_type, category, is_ai_generated, views_count, likes_count, created_at)
VALUES 
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Exploring the hidden gems of Zanzibar! The spice markets are incredible. #Zanzibar #TravelKenya', 'image', 'Travel', FALSE, 120, 45, now() - interval '2 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Sunrise at Mount Kilimanjaro. A truly spiritual experience. #Kilimanjaro #Hiking', 'image', 'Adventure', FALSE, 350, 150, now() - interval '1 day'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Check out this amazing budget hotel in Nairobi. Only $40/night with breakfast! #Nairobi #BudgetTravel', 'image', 'Accommodation', FALSE, 45, 12, now() - interval '5 hours'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'Top 5 tips for your first Safari in Serengeti. 1. Bring binoculars... #Serengeti #SafariTips', 'video', 'Tips', FALSE, 800, 230, now() - interval '3 days');

-- 4. Initial System Settings
INSERT INTO public.ai_feature_settings (feature_name, enabled, model, description)
VALUES 
  ('search_relevance', TRUE, 'gpt-4-mini', 'AI-powered search ranking'),
  ('preference_learning', TRUE, 'gpt-4-mini', 'User behavior analysis'),
  ('fair_view_algo', TRUE, 'gpt-4-mini', 'Equitable content distribution')
ON CONFLICT (feature_name) DO UPDATE SET enabled = TRUE;

-- 5. Set up the official account if the user exists
-- This is handled by the migration 006, but we can add more official data here.
