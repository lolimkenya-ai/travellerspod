-- 1) AI verification reviews
CREATE TABLE IF NOT EXISTS public.verification_ai_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  summary TEXT,
  risk_level TEXT NOT NULL DEFAULT 'unknown' CHECK (risk_level IN ('low','medium','high','unknown')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  scraped_at TIMESTAMPTZ,
  triggered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_ai_reviews_profile ON public.verification_ai_reviews(profile_id, created_at DESC);

ALTER TABLE public.verification_ai_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read ai reviews"
ON public.verification_ai_reviews FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admins manage ai reviews"
ON public.verification_ai_reviews FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2) Verified weblinks on business_details
ALTER TABLE public.business_details
  ADD COLUMN IF NOT EXISTS tra_listing_url TEXT,
  ADD COLUMN IF NOT EXISTS kata_listing_url TEXT,
  ADD COLUMN IF NOT EXISTS kato_listing_url TEXT,
  ADD COLUMN IF NOT EXISTS other_listing_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Allow admins to update verified weblinks
DROP POLICY IF EXISTS "admins update business details" ON public.business_details;
CREATE POLICY "admins update business details"
ON public.business_details FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3) Content reports
DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'spam','scam_fraud','harassment','hate','nudity_sexual','violence',
    'misinformation','impersonation','other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('open','reviewing','dismissed','actioned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  post_id UUID,
  comment_id UUID,
  reason public.report_reason NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'open',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((post_id IS NOT NULL) OR (comment_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_content_reports_one_per_user_post_reason
  ON public.content_reports(reporter_id, post_id, reason)
  WHERE post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_post ON public.content_reports(post_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users create own reports"
ON public.content_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "users read own reports"
ON public.content_reports FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "mods read all reports"
ON public.content_reports FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "mods update reports"
ON public.content_reports FOR UPDATE
USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4) Soft takedowns on posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_by UUID,
  ADD COLUMN IF NOT EXISTS removal_reason TEXT;

-- Allow moderators to soft-remove posts (update only). Existing admin policy already covers admins.
DROP POLICY IF EXISTS "mods soft remove posts" ON public.posts;
CREATE POLICY "mods soft remove posts"
ON public.posts FOR UPDATE
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- 5) Storage bucket for verification documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "users upload own verification docs" ON storage.objects;
CREATE POLICY "users upload own verification docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'verification-docs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "users read own verification docs" ON storage.objects;
CREATE POLICY "users read own verification docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'verification-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "users delete own verification docs" ON storage.objects;
CREATE POLICY "users delete own verification docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'verification-docs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- 6) Notifications: extend type for report_action
DO $$ BEGIN
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'report_action';
EXCEPTION WHEN others THEN null; END $$;

-- 7) RPC: take down a post (soft) and notify the author
CREATE OR REPLACE FUNCTION public.takedown_post(_post_id UUID, _reason TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_author UUID;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF NOT (has_role(v_caller,'moderator'::app_role) OR has_role(v_caller,'admin'::app_role) OR has_role(v_caller,'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT author_id INTO v_author FROM public.posts WHERE id = _post_id;
  IF v_author IS NULL THEN
    RAISE EXCEPTION 'post not found';
  END IF;

  UPDATE public.posts
     SET removed_at = now(),
         removed_by = v_caller,
         removal_reason = _reason
   WHERE id = _post_id;

  -- Notify author
  INSERT INTO public.notifications(user_id, actor_id, type, post_id, body)
  VALUES (v_author, v_caller, 'report_action'::public.notification_type, _post_id,
          'Your post was removed: ' || COALESCE(_reason,'policy violation'));

  -- Resolve any open reports for this post
  UPDATE public.content_reports
     SET status = 'actioned', resolved_by = v_caller, resolved_at = now(), resolution_note = _reason
   WHERE post_id = _post_id AND status IN ('open','reviewing');
END;
$$;

REVOKE ALL ON FUNCTION public.takedown_post(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.takedown_post(UUID, TEXT) TO authenticated;

-- 8) RPC: restore a removed post (admin/super only)
CREATE OR REPLACE FUNCTION public.restore_post(_post_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (has_role(v_caller,'admin'::app_role) OR has_role(v_caller,'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.posts SET removed_at = NULL, removed_by = NULL, removal_reason = NULL WHERE id = _post_id;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_post(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.restore_post(UUID) TO authenticated;

-- 9) RPC: store an AI verification review (server-side use via service role)
CREATE OR REPLACE FUNCTION public.save_ai_verification_review(
  _profile_id UUID,
  _summary TEXT,
  _risk_level TEXT,
  _findings JSONB,
  _sources JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (has_role(v_caller,'admin'::app_role) OR has_role(v_caller,'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  INSERT INTO public.verification_ai_reviews(profile_id, summary, risk_level, findings, sources, scraped_at, triggered_by)
  VALUES (_profile_id, _summary, COALESCE(_risk_level,'unknown'), COALESCE(_findings,'[]'::jsonb), COALESCE(_sources,'[]'::jsonb), now(), v_caller)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_ai_verification_review(UUID, TEXT, TEXT, JSONB, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_ai_verification_review(UUID, TEXT, TEXT, JSONB, JSONB) TO authenticated;