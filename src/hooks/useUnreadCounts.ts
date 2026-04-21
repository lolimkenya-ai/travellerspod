import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Live counts of unread notifications + unread conversations for the bell/messages icons. */
export function useUnreadCounts() {
  const { user } = useAuth();
  const [notif, setNotif] = useState(0);
  const [msgs, setMsgs] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotif(0);
      setMsgs(0);
      return;
    }

    const fetchCounts = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      setNotif(count ?? 0);

      // Unread conversations = my participant rows where last_read_at < conversation.last_message_at
      const { data } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at, conversations!inner(last_message_at)")
        .eq("user_id", user.id);
      const unread =
        data?.filter(
          (r: any) => new Date(r.conversations.last_message_at) > new Date(r.last_read_at),
        ).length ?? 0;
      setMsgs(unread);
    };

    fetchCounts();

    const ch = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        fetchCounts,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return { notif, msgs };
}
