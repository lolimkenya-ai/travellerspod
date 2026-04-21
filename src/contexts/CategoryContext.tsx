import { createContext, useContext, useState, ReactNode } from "react";
import type { Category } from "@/data/categories";

interface CategoryContextValue {
  active: Category;
  setActive: (c: Category) => void;
}

const CategoryContext = createContext<CategoryContextValue | null>(null);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Category>("All");
  return <CategoryContext.Provider value={{ active, setActive }}>{children}</CategoryContext.Provider>;
}

export function useCategoryFilter() {
  const ctx = useContext(CategoryContext);
  if (!ctx) throw new Error("useCategoryFilter must be within CategoryProvider");
  return ctx;
}
