-- Renaming verified to is_verified in profiles
ALTER TABLE IF EXISTS public.profiles RENAME COLUMN verified TO is_verified;

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at);

-- RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations" ON public.messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their conversations" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = author_id AND
        EXISTS (
            SELECT 1 FROM public.conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

-- Trigger to update conversation metadata
CREATE OR REPLACE FUNCTION update_conversation_metadata()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.conversations
    SET 
        last_message = LEFT(NEW.body, 100),
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_message_inserted ON public.messages;
CREATE TRIGGER on_message_inserted
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_metadata();

-- RPC: start_dm (find or create)
CREATE OR REPLACE FUNCTION start_dm(_other UUID, _is_inquiry BOOLEAN DEFAULT false)
RETURNS UUID AS $$
DECLARE
    _conv_id UUID;
    _me UUID := auth.uid();
BEGIN
    -- Check if a 1:1 conversation already exists
    SELECT cp1.conversation_id INTO _conv_id
    FROM public.conversation_participants cp1
    JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    JOIN public.conversations c ON c.id = cp1.conversation_id
    WHERE cp1.user_id = _me
      AND cp2.user_id = _other
      AND c.is_inquiry = _is_inquiry
    LIMIT 1;

    IF _conv_id IS NULL THEN
        -- Create new conversation
        INSERT INTO public.conversations (is_inquiry)
        VALUES (_is_inquiry)
        RETURNING id INTO _conv_id;

        -- Add participants
        INSERT INTO public.conversation_participants (conversation_id, user_id)
        VALUES (_conv_id, _me), (_conv_id, _other);
    END IF;

    RETURN _conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: mark_conversation_read
CREATE OR REPLACE FUNCTION mark_conversation_read(_conv UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.conversation_participants
    SET last_read_at = now()
    WHERE conversation_id = _conv
      AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: get_system_statistics
CREATE OR REPLACE FUNCTION get_system_statistics()
RETURNS TABLE (
  total_users bigint,
  total_posts bigint,
  total_reports bigint,
  open_reports bigint,
  removed_posts bigint,
  verified_businesses bigint,
  pending_verifications bigint,
  total_messages bigint,
  active_conversations bigint
) AS $$
BEGIN
  RETURN QUERY SELECT
    (SELECT count(*) FROM profiles),
    (SELECT count(*) FROM posts WHERE removed_at IS NULL),
    (SELECT count(*) FROM reports),
    (SELECT count(*) FROM reports WHERE resolved_at IS NULL),
    (SELECT count(*) FROM posts WHERE removed_at IS NOT NULL),
    (SELECT count(*) FROM profiles WHERE account_type = 'business' AND is_verified = true),
    (SELECT count(*) FROM business_verifications WHERE status = 'pending'),
    (SELECT count(*) FROM messages),
    (SELECT count(*) FROM conversations);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
