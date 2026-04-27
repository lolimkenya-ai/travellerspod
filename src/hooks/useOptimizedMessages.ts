import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ConversationPreview {
  id: string;
  is_inquiry: boolean;
  last_message: string | null;
  last_message_at: string;
  my_last_read: string;
  other_user_id: string;
  other_nametag: string;
  other_display_name: string;
  other_avatar_url: string | null;
  other_verified: boolean;
}

interface ThreadMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender_nametag: string;
  sender_display_name: string;
  sender_avatar_url: string | null;
}

/**
 * Optimized hook for fetching conversation inbox using server-side RPC
 * Replaces the old sequential query pattern with a single optimized call
 */
export function useOptimizedConversationInbox(limit = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["conversations", "inbox", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase.rpc("get_conversation_inbox", {
        _user_id: user.id,
        _limit: limit,
      });

      if (error) throw error;
      return (data as ConversationPreview[]) || [];
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Optimized hook for fetching thread messages with pagination
 */
export function useOptimizedThreadMessages(
  conversationId: string | undefined,
  page = 0,
  pageSize = 50
) {
  return useQuery({
    queryKey: ["messages", "thread", conversationId, page],
    queryFn: async () => {
      if (!conversationId) return [];

      const { data, error } = await supabase.rpc("get_thread_messages", {
        _conversation_id: conversationId,
        _limit: pageSize,
        _offset: page * pageSize,
      });

      if (error) throw error;
      return (data as ThreadMessage[]) || [];
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation for sending a message with optimistic updates
 */
export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          body,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the thread messages query to refetch
      queryClient.invalidateQueries({
        queryKey: ["messages", "thread", variables.conversationId],
      });

      // Invalidate the inbox to update last_message
      queryClient.invalidateQueries({
        queryKey: ["conversations", "inbox"],
      });
    },
  });
}

/**
 * Mutation for marking conversation as read
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("mark_conversation_read", {
        _conv: conversationId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate inbox to update unread status
      queryClient.invalidateQueries({
        queryKey: ["conversations", "inbox"],
      });
    },
  });
}

/**
 * Hook for real-time message updates using Supabase subscriptions
 */
export function useRealtimeThreadMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  useQuery({
    queryKey: ["messages", "realtime", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          () => {
            // Invalidate the thread messages to refetch
            queryClient.invalidateQueries({
              queryKey: ["messages", "thread", conversationId],
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    enabled: !!conversationId,
  });
}
