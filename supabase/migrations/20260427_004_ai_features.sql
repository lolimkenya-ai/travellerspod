-- AI Features Tables and Functions

-- 1. Content Moderation Logs Table
CREATE TABLE IF NOT EXISTS public.content_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  moderation_result JSONB NOT NULL,
  recommended_action TEXT NOT NULL CHECK (recommended_action IN ('approve', 'flag', 'remove')),
  reasons TEXT[] DEFAULT '{}',
  confidence NUMERIC(3, 2) DEFAULT 0.5,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  final_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_moderation_post ON public.content_moderation_logs(post_id);
CREATE INDEX idx_content_moderation_action ON public.content_moderation_logs(recommended_action);
CREATE INDEX idx_content_moderation_created ON public.content_moderation_logs(created_at DESC);

ALTER TABLE public.content_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read moderation logs"
ON public.content_moderation_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "system insert moderation logs"
ON public.content_moderation_logs FOR INSERT
WITH CHECK (true);

-- 2. AI Verification Reviews Table (Enhanced)
CREATE TABLE IF NOT EXISTS public.verification_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'unknown')),
  findings TEXT[] DEFAULT '{}',
  sources JSONB DEFAULT '[]',
  credibility_score NUMERIC(3, 1) DEFAULT 0,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  final_decision TEXT CHECK (final_decision IN ('approved', 'rejected', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_profile ON public.verification_ai_reviews(profile_id);
CREATE INDEX idx_verification_risk ON public.verification_ai_reviews(risk_level);
CREATE INDEX idx_verification_created ON public.verification_ai_reviews(created_at DESC);

ALTER TABLE public.verification_ai_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read verification reviews"
ON public.verification_ai_reviews FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "system insert verification reviews"
ON public.verification_ai_reviews FOR INSERT
WITH CHECK (true);

-- 3. AI Usage Logs Table (for tracking and analytics)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('caption', 'tips', 'hashtags', 'description', 'moderation', 'verification')),
  tokens_used INT DEFAULT 0,
  cost_usd NUMERIC(10, 4) DEFAULT 0,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'rate_limited')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_usage_user ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs(feature_type);
CREATE INDEX idx_ai_usage_created ON public.ai_usage_logs(created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own usage"
ON public.ai_usage_logs FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "system insert usage logs"
ON public.ai_usage_logs FOR INSERT
WITH CHECK (true);

-- 4. AI Feature Settings Table
CREATE TABLE IF NOT EXISTS public.ai_feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  model TEXT DEFAULT 'gpt-4-mini',
  temperature NUMERIC(3, 2) DEFAULT 0.7,
  max_tokens INT DEFAULT 500,
  rate_limit_per_user INT DEFAULT 100,
  rate_limit_window_hours INT DEFAULT 24,
  cost_per_1k_tokens NUMERIC(10, 6) DEFAULT 0.0005,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_feature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins manage settings"
ON public.ai_feature_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "users read settings"
ON public.ai_feature_settings FOR SELECT
USING (true);

-- 5. Insert default AI feature settings
INSERT INTO public.ai_feature_settings (feature_name, enabled, model, description)
VALUES
  ('content_moderation', TRUE, 'gpt-4-mini', 'AI-powered content moderation'),
  ('business_verification', TRUE, 'gpt-4-mini', 'Enhanced business verification'),
  ('caption_generation', TRUE, 'gpt-4-mini', 'AI caption suggestions'),
  ('travel_tips', TRUE, 'gpt-4-mini', 'AI travel tips generation'),
  ('hashtag_generation', TRUE, 'gpt-4-mini', 'AI hashtag suggestions'),
  ('description_generation', TRUE, 'gpt-4-mini', 'AI business description generation')
ON CONFLICT (feature_name) DO NOTHING;

-- 6. RPC Function: Get AI Usage Statistics
CREATE OR REPLACE FUNCTION public.get_ai_usage_stats(_user_id UUID, _days INT DEFAULT 30)
RETURNS TABLE (
  feature_type TEXT,
  usage_count BIGINT,
  total_tokens BIGINT,
  estimated_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    aul.feature_type,
    COUNT(*)::BIGINT,
    SUM(aul.tokens_used)::BIGINT,
    SUM(aul.tokens_used * afs.cost_per_1k_tokens / 1000)::NUMERIC
  FROM ai_usage_logs aul
  LEFT JOIN ai_feature_settings afs ON aul.feature_type = afs.feature_name
  WHERE aul.user_id = _user_id
    AND aul.created_at > now() - (_days || ' days')::INTERVAL
  GROUP BY aul.feature_type;
END;
$$;

-- 7. RPC Function: Check AI Feature Rate Limit
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(_user_id UUID, _feature TEXT)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining_calls INT,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT;
  v_window INT;
  v_usage INT;
  v_reset_at TIMESTAMPTZ;
BEGIN
  SELECT rate_limit_per_user, rate_limit_window_hours
  INTO v_limit, v_window
  FROM ai_feature_settings
  WHERE feature_name = _feature;

  IF v_limit IS NULL THEN
    v_limit := 100;
    v_window := 24;
  END IF;

  SELECT COUNT(*)
  INTO v_usage
  FROM ai_usage_logs
  WHERE user_id = _user_id
    AND feature_type = _feature
    AND created_at > now() - (v_window || ' hours')::INTERVAL;

  v_reset_at := now() + (v_window || ' hours')::INTERVAL;

  RETURN QUERY SELECT
    (v_usage < v_limit)::BOOLEAN,
    (v_limit - v_usage)::INT,
    v_reset_at;
END;
$$;

-- 8. RPC Function: Get Moderation Statistics
CREATE OR REPLACE FUNCTION public.get_moderation_stats(_days INT DEFAULT 30)
RETURNS TABLE (
  total_reviewed BIGINT,
  flagged_count BIGINT,
  removed_count BIGINT,
  flag_rate NUMERIC,
  top_reason TEXT
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
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE recommended_action = 'flag')::BIGINT,
    COUNT(*) FILTER (WHERE recommended_action = 'remove')::BIGINT,
    ROUND(COUNT(*) FILTER (WHERE recommended_action IN ('flag', 'remove'))::NUMERIC / COUNT(*), 3),
    (array_agg(reasons ORDER BY reasons DESC))[1]
  FROM content_moderation_logs
  WHERE created_at > now() - (_days || ' days')::INTERVAL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_usage_stats(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_moderation_stats(INT) TO authenticated;
