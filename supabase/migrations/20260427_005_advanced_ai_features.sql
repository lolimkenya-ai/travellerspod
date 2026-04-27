-- Advanced AI Features Tables and Functions

-- 1. User Search Preferences Table
CREATE TABLE IF NOT EXISTS public.user_search_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  engagement_style TEXT DEFAULT 'mixed' CHECK (engagement_style IN ('likes', 'comments', 'shares', 'saves', 'mixed')),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_search_prefs_user ON public.user_search_preferences(user_id);

ALTER TABLE public.user_search_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own preferences"
ON public.user_search_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "users update own preferences"
ON public.user_search_preferences FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. User Behavior Logs Table
CREATE TABLE IF NOT EXISTS public.user_behavior_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('view', 'like', 'share', 'scroll_past', 'comment', 'save')),
  duration INT DEFAULT 0, -- milliseconds
  scroll_depth NUMERIC(3, 1) DEFAULT 0, -- 0-100 percentage
  post_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_behavior_user ON public.user_behavior_logs(user_id, created_at DESC);
CREATE INDEX idx_behavior_post ON public.user_behavior_logs(post_id);
CREATE INDEX idx_behavior_action ON public.user_behavior_logs(action);
CREATE INDEX idx_behavior_created ON public.user_behavior_logs(created_at DESC);

ALTER TABLE public.user_behavior_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own behavior"
ON public.user_behavior_logs FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "system insert behavior logs"
ON public.user_behavior_logs FOR INSERT
WITH CHECK (true);

-- 3. Post Views Table (for Fair-View algorithm)
CREATE TABLE IF NOT EXISTS public.post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  view_count INT DEFAULT 1,
  last_viewed TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_post_views_user ON public.post_views(user_id);
CREATE INDEX idx_post_views_post ON public.post_views(post_id);
CREATE INDEX idx_post_views_created ON public.post_views(created_at DESC);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system manage post views"
ON public.post_views FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Search Analytics Logs Table
CREATE TABLE IF NOT EXISTS public.search_analytics_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INT DEFAULT 0,
  execution_time_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_search_analytics_user ON public.search_analytics_logs(user_id, created_at DESC);
CREATE INDEX idx_search_analytics_query ON public.search_analytics_logs(query);
CREATE INDEX idx_search_analytics_created ON public.search_analytics_logs(created_at DESC);

ALTER TABLE public.search_analytics_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own search history"
ON public.search_analytics_logs FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "system insert search logs"
ON public.search_analytics_logs FOR INSERT
WITH CHECK (true);

-- 5. Feed Impressions Table (for algorithm analytics)
CREATE TABLE IF NOT EXISTS public.feed_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  posts_count INT DEFAULT 0,
  algorithm_version TEXT DEFAULT 'fair-view-v1',
  distribution_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_impressions_user ON public.feed_impressions(user_id, created_at DESC);
CREATE INDEX idx_feed_impressions_created ON public.feed_impressions(created_at DESC);

ALTER TABLE public.feed_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system manage feed impressions"
ON public.feed_impressions FOR ALL
USING (true)
WITH CHECK (true);

-- 6. Promoted Content Views Table
CREATE TABLE IF NOT EXISTS public.promoted_content_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promoted_views_user ON public.promoted_content_views(user_id, created_at DESC);
CREATE INDEX idx_promoted_views_post ON public.promoted_content_views(post_id);
CREATE INDEX idx_promoted_views_created ON public.promoted_content_views(created_at DESC);

ALTER TABLE public.promoted_content_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system manage promoted views"
ON public.promoted_content_views FOR ALL
USING (true)
WITH CHECK (true);

-- 7. Add AI-related columns to posts table (if not exists)
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS human_caption_score NUMERIC(3, 2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_ai_generated ON public.posts(is_ai_generated);
CREATE INDEX IF NOT EXISTS idx_posts_promoted ON public.posts(is_promoted);
CREATE INDEX IF NOT EXISTS idx_posts_views ON public.posts(views_count DESC);

-- 8. RPC Function: Record Post View
CREATE OR REPLACE FUNCTION public.record_post_view(_user_id UUID, _post_id UUID)
RETURNS TABLE (
  view_count INT,
  is_first_view BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_view_count INT;
  v_is_first_view BOOLEAN;
BEGIN
  -- Upsert post view
  INSERT INTO post_views (user_id, post_id, view_count, last_viewed)
  VALUES (_user_id, _post_id, 1, now())
  ON CONFLICT (user_id, post_id) DO UPDATE
  SET view_count = post_views.view_count + 1,
      last_viewed = now();

  -- Get updated view count
  SELECT pv.view_count INTO v_view_count
  FROM post_views pv
  WHERE pv.user_id = _user_id AND pv.post_id = _post_id;

  v_is_first_view := v_view_count = 1;

  -- Increment post views counter
  UPDATE posts SET views_count = views_count + 1 WHERE id = _post_id;

  RETURN QUERY SELECT v_view_count, v_is_first_view;
END;
$$;

-- 9. RPC Function: Get User Preference Insights
CREATE OR REPLACE FUNCTION public.get_user_preference_insights(_user_id UUID)
RETURNS TABLE (
  top_categories TEXT[],
  top_locations TEXT[],
  top_business_types TEXT[],
  engagement_style TEXT,
  preference_strength NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (array_agg(DISTINCT (jsonb_object_keys(preferences) ->> 'category') ORDER BY (jsonb_object_keys(preferences) ->> 'category')))[1:5]::TEXT[],
    (array_agg(DISTINCT (jsonb_object_keys(preferences) ->> 'location') ORDER BY (jsonb_object_keys(preferences) ->> 'location')))[1:5]::TEXT[],
    (array_agg(DISTINCT (jsonb_object_keys(preferences) ->> 'business') ORDER BY (jsonb_object_keys(preferences) ->> 'business')))[1:5]::TEXT[],
    engagement_style,
    ROUND(CAST(COUNT(DISTINCT jsonb_object_keys(preferences)) AS NUMERIC) / 10, 2)
  FROM user_search_preferences
  WHERE user_id = _user_id
  GROUP BY engagement_style;
END;
$$;

-- 10. RPC Function: Get Search Trending Topics
CREATE OR REPLACE FUNCTION public.get_trending_search_topics(_days INT DEFAULT 7)
RETURNS TABLE (
  query TEXT,
  search_count BIGINT,
  avg_results INT,
  trend_direction TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sal.query,
    COUNT(*)::BIGINT,
    ROUND(AVG(sal.results_count))::INT,
    CASE
      WHEN COUNT(*) > 10 THEN 'trending_up'
      WHEN COUNT(*) > 5 THEN 'stable'
      ELSE 'trending_down'
    END
  FROM search_analytics_logs sal
  WHERE sal.created_at > now() - (_days || ' days')::INTERVAL
  GROUP BY sal.query
  ORDER BY COUNT(*) DESC
  LIMIT 20;
END;
$$;

-- 11. RPC Function: Get Algorithm Performance Metrics
CREATE OR REPLACE FUNCTION public.get_algorithm_performance_metrics(_days INT DEFAULT 7)
RETURNS TABLE (
  algorithm_version TEXT,
  total_impressions BIGINT,
  avg_posts_per_feed INT,
  unviewed_percentage NUMERIC,
  human_content_percentage NUMERIC,
  promoted_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    fi.algorithm_version,
    COUNT(*)::BIGINT,
    ROUND(AVG(fi.posts_count))::INT,
    ROUND(CAST(SUM(CAST(fi.distribution_breakdown->>'unviewed' AS INT)) AS NUMERIC) / SUM(fi.posts_count), 2),
    ROUND(CAST(SUM(CAST(fi.distribution_breakdown->>'human' AS INT)) AS NUMERIC) / SUM(fi.posts_count), 2),
    ROUND(CAST(SUM(CAST(fi.distribution_breakdown->>'promoted' AS INT)) AS NUMERIC) / SUM(fi.posts_count), 2)
  FROM feed_impressions fi
  WHERE fi.created_at > now() - (_days || ' days')::INTERVAL
  GROUP BY fi.algorithm_version;
END;
$$;

-- 12. RPC Function: Detect AI-Generated Captions
CREATE OR REPLACE FUNCTION public.detect_ai_generated_caption(_caption TEXT)
RETURNS TABLE (
  is_ai_generated BOOLEAN,
  confidence NUMERIC,
  indicators TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ai_indicators TEXT[] := ARRAY[
    'as an ai',
    'as a language model',
    'i cannot',
    'i am unable',
    'please note',
    'it is important to note',
    'furthermore',
    'in conclusion',
    'to summarize'
  ];
  v_found_indicators TEXT[] := '{}';
  v_indicator_count INT := 0;
BEGIN
  -- Check for AI indicators
  FOREACH v_indicator IN ARRAY v_ai_indicators LOOP
    IF LOWER(_caption) LIKE '%' || v_indicator || '%' THEN
      v_found_indicators := array_append(v_found_indicators, v_indicator);
      v_indicator_count := v_indicator_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    (v_indicator_count > 2)::BOOLEAN,
    ROUND(CAST(v_indicator_count AS NUMERIC) / array_length(v_ai_indicators, 1), 2),
    v_found_indicators;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_post_view(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_preference_insights(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_search_topics(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_algorithm_performance_metrics(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_ai_generated_caption(TEXT) TO authenticated;
