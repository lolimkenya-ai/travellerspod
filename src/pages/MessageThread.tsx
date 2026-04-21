import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CONVERSATIONS, MESSAGES } from "@/data/messages";
import { getUser } from "@/data/users";
import { getPost } from "@/data/posts";
import { cn } from "@/lib/utils";
import type { Message } from "@/data/types";

export default function MessageThread() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const toUserId = params.get("to");
  const fromPostId = params.get("postId");
  const navigate = useNavigate();

  // Existing or synthesized conversation
  const existing = CONVERSATIONS.find((c) => c.id === id);
  const otherId = existing
    ? existing.participantIds.find((p) => p !== "me") ?? ""
    : toUserId ?? "";
  const other = getUser(otherId);

  const initialMessages = existing ? MESSAGES[existing.id] ?? [] : [];
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Pre-fill an inquiry if coming from a post
  useEffect(() => {
    if (fromPostId && messages.length === 0) {
      const post = getPost(fromPostId);
      if (post) {
        setDraft(`Hi! Inquiring about: "${post.caption.slice(0, 80)}${post.caption.length > 80 ? "…" : ""}"`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = () => {
    if (!draft.trim()) return;
    const msg: Message = {
      id: `m-${Date.now()}`,
      conversationId: id,
      authorId: "me",
      body: draft.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((p) => [...p, msg]);
    setDraft("");
    // Mock reply
    window.setTimeout(() => {
      setMessages((p) => [
        ...p,
        {
          id: `m-r-${Date.now()}`,
          conversationId: id,
          authorId: otherId,
          body: "Got it! Let me check and get back to you shortly.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }, 1100);
  };

  return (
    <div className="mx-auto flex h-screen max-w-[480px] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <img src={other.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-foreground">{other.displayName}</p>
            {other.verified && <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">@{other.nametag}</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-muted-foreground">Start a conversation.</p>
        )}
        {messages.map((m) => {
          const mine = m.authorId === "me";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
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
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Message..."
            className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
