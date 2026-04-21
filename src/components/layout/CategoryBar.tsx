import { useCategories } from "@/hooks/useCategories";
import { useCategoryFilter } from "@/contexts/CategoryContext";
import { cn } from "@/lib/utils";

export function CategoryBar() {
  const { active, setActive } = useCategoryFilter();
  const { categories } = useCategories();
  const items: { label: string }[] = [{ label: "All" }, ...categories.map((c) => ({ label: c.label }))];

  return (
    <div className="border-b border-border/50">
      <div className="mx-auto w-full max-w-[480px] overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-2 px-4 py-3">
          {items.map((cat) => {
            const isActive = active === cat.label;
            return (
              <button
                key={cat.label}
                onClick={() => setActive(cat.label as any)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-accent",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
