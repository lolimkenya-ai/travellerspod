
-- 1. b2b_listings
CREATE TABLE IF NOT EXISTS public.b2b_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  unit text,
  external_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_listings_business ON public.b2b_listings(business_id);
CREATE INDEX IF NOT EXISTS idx_b2b_listings_active ON public.b2b_listings(is_active);

ALTER TABLE public.b2b_listings ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller a verified business?
CREATE OR REPLACE FUNCTION public.is_verified_business(_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _user
      AND account_type = 'business'
      AND verification_status = 'verified'
  )
$$;

CREATE POLICY "verified businesses read active listings"
ON public.b2b_listings FOR SELECT
USING (
  is_active = true
  AND public.is_verified_business(auth.uid())
);

CREATE POLICY "owner reads own listings"
ON public.b2b_listings FOR SELECT
USING (auth.uid() = business_id);

CREATE POLICY "verified business owner manages own listings"
ON public.b2b_listings FOR ALL
USING (
  auth.uid() = business_id
  AND public.is_verified_business(auth.uid())
)
WITH CHECK (
  auth.uid() = business_id
  AND public.is_verified_business(auth.uid())
);

CREATE POLICY "super_admin manages all listings"
ON public.b2b_listings FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_b2b_listings_touch
BEFORE UPDATE ON public.b2b_listings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. b2b_external_links
CREATE TABLE IF NOT EXISTS public.b2b_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_b2b_links_business ON public.b2b_external_links(business_id);

ALTER TABLE public.b2b_external_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verified businesses read links"
ON public.b2b_external_links FOR SELECT
USING (public.is_verified_business(auth.uid()));

CREATE POLICY "owner reads own links"
ON public.b2b_external_links FOR SELECT
USING (auth.uid() = business_id);

CREATE POLICY "verified owner manages links"
ON public.b2b_external_links FOR ALL
USING (auth.uid() = business_id AND public.is_verified_business(auth.uid()))
WITH CHECK (auth.uid() = business_id AND public.is_verified_business(auth.uid()));

-- 3. Add is_b2b flag to conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_b2b boolean NOT NULL DEFAULT false;

-- 4. Update start_dm to support b2b
CREATE OR REPLACE FUNCTION public.start_dm(_other uuid, _is_inquiry boolean DEFAULT false, _is_b2b boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
declare _me uuid := auth.uid();
        _conv uuid;
begin
  if _me is null then raise exception 'Not authenticated'; end if;
  if _other is null or _other = _me then raise exception 'Invalid recipient'; end if;

  -- If b2b is requested, both parties must be verified businesses.
  if coalesce(_is_b2b, false) then
    if not public.is_verified_business(_me) or not public.is_verified_business(_other) then
      raise exception 'B2B conversations are only allowed between verified businesses';
    end if;
  end if;

  select c.id into _conv
  from public.conversations c
  where exists (select 1 from public.conversation_participants p
                where p.conversation_id = c.id and p.user_id = _me)
    and exists (select 1 from public.conversation_participants p
                where p.conversation_id = c.id and p.user_id = _other)
    and (select count(*) from public.conversation_participants p
         where p.conversation_id = c.id) = 2
  limit 1;

  if _conv is not null then
    if _is_inquiry then
      update public.conversations set is_inquiry = true where id = _conv;
    end if;
    if _is_b2b then
      update public.conversations set is_b2b = true where id = _conv;
    end if;
    return _conv;
  end if;

  insert into public.conversations (is_inquiry, is_b2b)
  values (coalesce(_is_inquiry, false), coalesce(_is_b2b, false))
  returning id into _conv;
  insert into public.conversation_participants (conversation_id, user_id) values (_conv, _me);
  insert into public.conversation_participants (conversation_id, user_id) values (_conv, _other);
  return _conv;
end;
$$;

-- 5. Update mutual-follow guard to exempt b2b conversations between verified businesses
CREATE OR REPLACE FUNCTION public.guard_message_mutual_follow()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _is_inquiry boolean;
  _is_b2b boolean;
  _other uuid;
  _other_verified_biz boolean;
  _author_verified_biz boolean;
  _follows_me boolean;
  _i_follow boolean;
BEGIN
  SELECT is_inquiry, is_b2b INTO _is_inquiry, _is_b2b
  FROM public.conversations WHERE id = NEW.conversation_id;

  _author_verified_biz := public.is_verified_business(NEW.author_id);

  FOR _other IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.author_id
  LOOP
    -- B2B exemption: both parties verified businesses + conversation flagged b2b
    IF COALESCE(_is_b2b, false) AND COALESCE(_author_verified_biz, false) THEN
      IF public.is_verified_business(_other) THEN
        CONTINUE;
      END IF;
    END IF;

    -- Inquiry exemption (existing behaviour)
    IF COALESCE(_is_inquiry, false) THEN
      SELECT (account_type = 'business' AND verification_status = 'verified')
        INTO _other_verified_biz
      FROM public.profiles WHERE id = _other;
      IF COALESCE(_other_verified_biz, false) THEN
        CONTINUE;
      END IF;
    END IF;

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
