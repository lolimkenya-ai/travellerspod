import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Video, Image as ImageIcon, Type } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CreateSheet({ open, onOpenChange }: Props) {
  const choose = (kind: string) => {
    toast(`${kind} composer — coming in Phase 2`);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl border-border bg-card p-0">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle>Create</SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-3 p-4">
          <Tile icon={<Video className="h-6 w-6" />} label="Video" onClick={() => choose("Video")} />
          <Tile icon={<ImageIcon className="h-6 w-6" />} label="Image" onClick={() => choose("Image")} />
          <Tile icon={<Type className="h-6 w-6" />} label="Text card" onClick={() => choose("Text")} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Tile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-muted p-5 text-foreground transition-colors hover:bg-accent"
    >
      {icon}
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );
}
