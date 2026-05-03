
CREATE OR REPLACE FUNCTION public.remove_post(_post_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (has_role(v_caller,'moderator'::app_role) OR has_role(v_caller,'admin'::app_role) OR has_role(v_caller,'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.posts
    SET removed_at = now(),
        removed_by = v_caller,
        removal_reason = COALESCE(_reason, 'Removed by moderator')
    WHERE id = _post_id;
  PERFORM log_admin_action('remove_post', 'post', _post_id::text, jsonb_build_object('reason', _reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_report(_report_id uuid, _note text DEFAULT NULL, _remove_post boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_post_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (has_role(v_caller,'moderator'::app_role) OR has_role(v_caller,'admin'::app_role) OR has_role(v_caller,'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT post_id INTO v_post_id FROM public.content_reports WHERE id = _report_id;

  UPDATE public.content_reports
    SET status = 'resolved'::report_status,
        resolved_by = v_caller,
        resolved_at = now(),
        resolution_note = _note
    WHERE id = _report_id;

  IF _remove_post AND v_post_id IS NOT NULL THEN
    UPDATE public.posts
      SET removed_at = now(),
          removed_by = v_caller,
          removal_reason = COALESCE(_note, 'Removed via report resolution')
      WHERE id = v_post_id;
  END IF;

  PERFORM log_admin_action('resolve_report', 'content_report', _report_id::text,
    jsonb_build_object('note', _note, 'removed_post', _remove_post, 'post_id', v_post_id));
END;
$$;
