-- Guard: messages require mutual follow, except for inquiry conversations
-- whose other participant is a verified business.
CREATE OR REPLACE FUNCTION public.guard_message_mutual_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_inquiry boolean;
  _other uuid;
  _other_verified_biz boolean;
  _follows_me boolean;
  _i_follow boolean;
BEGIN
  SELECT is_inquiry INTO _is_inquiry FROM public.conversations WHERE id = NEW.conversation_id;

  FOR _other IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.author_id
  LOOP
    -- Inquiry exemption: if this is an inquiry conversation and the other
    -- participant is a verified business, allow.
    IF COALESCE(_is_inquiry, false) THEN
      SELECT (account_type = 'business' AND verification_status = 'verified')
        INTO _other_verified_biz
      FROM public.profiles WHERE id = _other;
      IF COALESCE(_other_verified_biz, false) THEN
        CONTINUE;
      END IF;
    END IF;

    -- Otherwise require mutual follow.
    SELECT EXISTS(SELECT 1 FROM public.follows
                  WHERE follower_id = NEW.author_id AND followee_id = _other)
      INTO _i_follow;
    SELECT EXISTS(SELECT 1 FROM public.follows
                  WHERE follower_id = _other AND followee_id = NEW.author_id)
      INTO _follows_me;

    IF NOT (_i_follow AND _follows_me) THEN
      RAISE EXCEPTION 'You can only message people who follow you back. They will need to follow you to chat.'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_message_mutual_follow ON public.messages;
CREATE TRIGGER trg_guard_message_mutual_follow
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_message_mutual_follow();