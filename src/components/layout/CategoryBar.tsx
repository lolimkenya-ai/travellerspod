import { useState } from "react";
import { CATEGORIES } from "@/data/categories";
import { useCategoryFilter } from "@/contexts/CategoryContext";
import { cn } from "@/lib/utils";

export function CategoryBar() {
  const { active, setActive } = useCategoryFilter();
  return (
    <div className="border-b border-border/50">
      <div className="mx-auto w-full max-w-[480px] overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 px-4 py-3">
          {CATEGORIES.map((cat) => {
            const isActive = active === cat;
            return (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-accent",
                )}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
