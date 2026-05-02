
-- Allow admins/super_admins to insert audit logs (system actions write through RPCs)
DROP POLICY IF EXISTS "admins write audit logs" ON public.audit_logs;
CREATE POLICY "admins write audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'moderator'::app_role)
);

-- Server-side helper to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _email text;
BEGIN
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), _email, _action, _entity_type, _entity_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Server-side grant role (super_admin can grant any; admin can grant moderator only)
CREATE OR REPLACE FUNCTION public.grant_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND _role = 'moderator'::app_role)
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.log_admin_action(
    'grant_role:' || _role::text,
    'user',
    _user_id::text,
    jsonb_build_object('role', _role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_role(_user_id uuid, _role app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _role = 'user'::app_role THEN
    RAISE EXCEPTION 'cannot_revoke_base_role';
  END IF;

  IF NOT (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR (has_role(auth.uid(), 'admin'::app_role) AND _role = 'moderator'::app_role)
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  -- Prevent removing the last super_admin
  IF _role = 'super_admin'::app_role THEN
    IF (SELECT COUNT(*) FROM public.user_roles WHERE role = 'super_admin'::app_role) <= 1 THEN
      RAISE EXCEPTION 'cannot_remove_last_super_admin';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = _role;

  PERFORM public.log_admin_action(
    'revoke_role:' || _role::text,
    'user',
    _user_id::text,
    jsonb_build_object('role', _role)
  );
END;
$$;

-- Flag/unflag user (admin+)
CREATE OR REPLACE FUNCTION public.set_user_flag(_user_id uuid, _flagged boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'insufficient_privilege';
  END IF;

  UPDATE public.profiles
     SET flagged_danger = _flagged,
         danger_reason = CASE WHEN _flagged THEN _reason ELSE NULL END
   WHERE id = _user_id;

  PERFORM public.log_admin_action(
    CASE WHEN _flagged THEN 'flag_user' ELSE 'unflag_user' END,
    'user',
    _user_id::text,
    jsonb_build_object('reason', _reason)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_flag(uuid, boolean, text) TO authenticated;
