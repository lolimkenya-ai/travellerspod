import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Send, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { rateLimit, clientCooldown } from "@/lib/rateLimit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DbMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

interface OtherProfile {
  id: string;
  nametag: string;
  display_name: string;
  avatar_url: string | null;
  verified: boolean;
}

/**
 * Build a structured booking-inquiry template for a post.
 * Easy to edit and skim by the host on the receiving end.
 */
function buildInquiryTemplate(opts: { caption?: string | null; location?: string | null }) {
  const refLine = opts.caption
    ? `Hi! I'm interested in your post:\n"${opts.caption.slice(0, 140)}${
        opts.caption.length > 140 ? "…" : ""
      }"\n\n`
    : "Hi! I'd like to make a booking inquiry.\n\n";
  return (
    refLine +
    "📍 Destination: " + (opts.location ?? "") + "\n" +
    "📅 Dates: \n" +
    "👥 Travelers: \n" +
    "🛏  Rooms / setup: \n" +
    "💰 Budget range: \n" +
    "📝 Special requests: \n\n" +
    "Could you share availability, total price, and how to book? Thank you!"
  );
}

export default function MessageThread() {
  const { id: routeId = "" } = useParams();
  const [params] = useSearchParams();
  const toUserId = params.get("to");
  const fromPostId = params.get("postId");
  const inquiryFlag = params.get("inquiry") === "1";
  const navigate = useNavigate();
  const { user, promptSignUp } = useAuth();

  const [convId, setConvId] = useState<string | null>(null);
  const [other, setOther] = useState<OtherProfile | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Resolve / create the conversation we should view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        promptSignUp();
        return;
      }
      setLoading(true);

      let realConvId: string | null = null;

      if (toUserId) {
        // Always ask the server to find-or-create — handles the legacy
        // /messages/conv-<userId> deep links from older Inquire buttons.
        const { data, error } = await supabase.rpc("start_dm", {
          _other: toUserId,
          _is_inquiry: inquiryFlag,
        });
        if (error) {
          toast.error(error.message);
          setLoading(false);
          return;
        }
        realConvId = data as string;
      } else if (routeId.startsWith("conv-") || routeId === "new") {
        // Legacy mock id or "new" without recipient — bail to inbox.
        navigate("/messages", { replace: true });
        return;
      } else {
        realConvId = routeId;
      }

      if (cancelled || !realConvId) return;
      setConvId(realConvId);

      // Load the other participant's profile.
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", realConvId)
        .neq("user_id", user.id)
        .limit(1);
      const otherId = parts?.[0]?.user_id;
      if (otherId) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, nametag, display_name, avatar_url, verified")
          .eq("id", otherId)
          .maybeSingle();
        if (!cancelled) setOther((prof as OtherProfile) ?? null);
      }

      // Pre-fill an inquiry template if coming from a post.
      if (fromPostId && messages.length === 0 && !draft) {
        const { data: p } = await supabase
          .from("posts")
          .select("caption, location")
          .eq("id", fromPostId)
          .maybeSingle();
        if (!cancelled) setDraft(buildInquiryTemplate({ caption: p?.caption, location: p?.location }));
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, toUserId, user]);

  // 2. Load messages + subscribe to realtime updates.
  const loadMessages = useCallback(async () => {
    if (!convId) return;
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, author_id, body, created_at")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true })
      .limit(500);
    setMessages((data as DbMessage[]) ?? []);
  }, [convId]);

  useEffect(() => {
    if (!convId) return;
    loadMessages();
    const ch = supabase
      .channel(`thread-${convId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        loadMessages,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [convId, loadMessages]);

  // 3. Mark as read every time we open or get new messages.
  useEffect(() => {
    if (!convId) return;
    supabase.rpc("mark_conversation_read", { _conv: convId }).then(() => {});
  }, [convId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !convId || !user) return;
    if (!clientCooldown(`msg-${convId}`, 400)) return;
    setSending(true);
    const ok = await rateLimit("send_message", 30, 60);
    if (!ok) {
      setSending(false);
      return;
    }
    const { error } = await supabase.from("messages").insert({
      conversation_id: convId,
      author_id: user.id,
      body,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-screen max-w-[480px] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {other ? (
          <>
            <img
              src={
                other.avatar_url ??
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(other.display_name)}`
              }
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center gap-1">
                <p className="text-sm font-semibold text-foreground">{other.display_name}</p>
                {other.verified && (
                  <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">@{other.nametag}</p>
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold text-foreground">Conversation</p>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center pt-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Start a conversation.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.author_id === user.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2 text-sm",
                  mine
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground",
                )}
              >
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-card p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Message..."
            rows={Math.min(6, Math.max(1, draft.split("\n").length))}
            className="flex-1 resize-none rounded-2xl border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
