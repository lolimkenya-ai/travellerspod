import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Quote, MessageSquareReply } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { getUser } from "@/data/users";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Post } from "@/data/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: Post;
}

export function RepostSheet({ open, onOpenChange, post }: Props) {
  const [mode, setMode] = useState<"quote" | "inline">("quote");
  const [body, setBody] = useState("");
  const author = getUser(post.authorId);

  const submit = () => {
    toast.success(mode === "quote" ? "Quote repost shared to your profile" : "Inline repost added to comments");
    setBody("");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>Repost</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2 p-4">
          <ModeOption
            active={mode === "quote"}
            onClick={() => setMode("quote")}
            icon={<Quote className="h-4 w-4" />}
            title="Quote repost"
            sub="Your thoughts + original attached"
          />
          <ModeOption
            active={mode === "inline"}
            onClick={() => setMode("inline")}
            icon={<MessageSquareReply className="h-4 w-4" />}
            title="Inline repost"
            sub="Show in original's comments"
          />
        </div>
        <div className="px-4 pb-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={mode === "quote" ? "Add your thoughts..." : "Why are you reposting this?"}
            className="min-h-[100px] resize-none border-border bg-muted text-foreground"
          />
          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <img src={author.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              <span className="text-sm font-semibold text-foreground">@{author.nametag}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{post.caption}</p>
          </div>
          <button
            onClick={submit}
            disabled={!body.trim()}
            className="mt-4 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            Post repost
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ModeOption({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/10" : "border-border bg-muted hover:bg-accent",
      )}
    >
      <div className={cn("flex items-center gap-2 text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
        {icon}
        {title}
      </div>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </button>
  );
}
