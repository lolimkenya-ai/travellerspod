-- Admin Management Tables

-- 1. User Flags Table: For tracking flagged/suspicious users
CREATE TABLE IF NOT EXISTS public.user_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN ('spam', 'suspicious_activity', 'policy_violation', 'fraud', 'other')),
  flagged_by UUID NOT NULL REFERENCES profiles(id),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, flag_type)
);

CREATE INDEX idx_user_flags_user ON public.user_flags(user_id);
CREATE INDEX idx_user_flags_status ON public.user_flags(resolved, created_at DESC);
CREATE INDEX idx_user_flags_type ON public.user_flags(flag_type);

ALTER TABLE public.user_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read user flags"
ON public.user_flags FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admins manage user flags"
ON public.user_flags FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2. System Settings Table: For superadmin to control platform behavior
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_settings_key ON public.system_settings(setting_key);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "superadmins read settings"
ON public.system_settings FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "superadmins update settings"
ON public.system_settings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Audit Log Table: For tracking admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  changes JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action_type, created_at DESC);
CREATE INDEX idx_audit_logs_target ON public.audit_logs(target_type, target_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit logs"
ON public.audit_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "system insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- 4. Moderation Actions Log: For tracking moderation decisions
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('takedown', 'restore', 'flag_user', 'unflag_user', 'suspend', 'unsuspend', 'warn')),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'user', 'comment')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,
  appeal_status TEXT DEFAULT 'none' CHECK (appeal_status IN ('none', 'pending', 'approved', 'rejected')),
  appeal_reason TEXT,
  appealed_at TIMESTAMPTZ,
  appeal_reviewed_at TIMESTAMPTZ,
  appeal_reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_actions_moderator ON public.moderation_actions(moderator_id, created_at DESC);
CREATE INDEX idx_moderation_actions_target ON public.moderation_actions(target_type, target_id);
CREATE INDEX idx_moderation_actions_appeal ON public.moderation_actions(appeal_status);

ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mods read moderation actions"
ON public.moderation_actions FOR SELECT
USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "mods create moderation actions"
ON public.moderation_actions FOR INSERT
USING (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admins update moderation actions"
ON public.moderation_actions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 5. Banned Users Table: For tracking suspended/banned users
CREATE TABLE IF NOT EXISTS public.banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
  reason TEXT NOT NULL,
  banned_by UUID NOT NULL REFERENCES profiles(id),
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  appeal_allowed BOOLEAN DEFAULT TRUE,
  appeal_deadline TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX idx_banned_users_user ON public.banned_users(user_id);
CREATE INDEX idx_banned_users_expires ON public.banned_users(expires_at) WHERE ban_type = 'temporary';

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read banned users"
ON public.banned_users FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "admins manage banned users"
ON public.banned_users FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 6. Notification Preferences for Admins
CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  notify_new_reports BOOLEAN DEFAULT TRUE,
  notify_appeals BOOLEAN DEFAULT TRUE,
  notify_verification_queue BOOLEAN DEFAULT TRUE,
  notify_system_alerts BOOLEAN DEFAULT TRUE,
  digest_frequency TEXT DEFAULT 'daily' CHECK (digest_frequency IN ('realtime', 'daily', 'weekly', 'never')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own preferences"
ON public.admin_notification_preferences FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Insert default system settings
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES
  ('max_post_length', '{"value": 5000}', 'Maximum length for post captions'),
  ('enable_ai_verification', '{"value": true}', 'Enable AI-powered business verification'),
  ('report_auto_takedown_threshold', '{"value": 5}', 'Number of reports to auto-flag for review'),
  ('verification_review_timeout_days', '{"value": 30}', 'Days before verification request expires'),
  ('post_cache_ttl_seconds', '{"value": 300}', 'Cache time-to-live for post queries'),
  ('enable_user_suspensions', '{"value": true}', 'Enable temporary user suspensions'),
  ('max_concurrent_uploads', '{"value": 5}', 'Maximum concurrent media uploads per user')
ON CONFLICT (setting_key) DO NOTHING;
