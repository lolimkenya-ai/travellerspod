import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Mail } from "lucide-react";
import { CONVERSATIONS } from "@/data/messages";
import { getUser } from "@/data/users";
import { timeAgo } from "@/lib/format";

export default function Messages() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">Messages</h1>
      </header>
      <div>
        {CONVERSATIONS.map((c) => {
          const other = getUser(c.participantIds.find((p) => p !== "me") ?? "");
          return (
            <Link
              key={c.id}
              to={`/messages/${c.id}`}
              className="flex items-center gap-3 border-b border-border/50 px-4 py-3 hover:bg-accent"
            >
              <img src={other.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="truncate text-sm font-semibold text-foreground">{other.displayName}</p>
                  {other.verified && <BadgeCheck className="h-4 w-4 fill-verified text-verified-foreground" />}
                  {c.isInquiry && (
                    <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      <Mail className="h-2.5 w-2.5" /> Inquiry
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.lastMessage}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{timeAgo(c.lastAt)}</span>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
