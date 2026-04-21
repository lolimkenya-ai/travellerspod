import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DbCategory } from "@/data/categories";

let cache: DbCategory[] | null = null;

export function useCategories() {
  const [categories, setCategories] = useState<DbCategory[]>(cache ?? []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    supabase
      .from("categories")
      .select("slug, label, sort_order")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        cache = data ?? [];
        setCategories(cache);
        setLoading(false);
      });
  }, []);

  return { categories, loading };
}
