import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

interface LocationPickerProps {
  value: string;
  onChange: (value: string, meta?: { lat?: number; lon?: number }) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}

/**
 * Smart location autocomplete backed by OpenStreetMap Nominatim.
 * Free, no API key. Debounced 350ms; respects Nominatim's 1 req/sec policy.
 */
export function LocationPicker({
  value,
  onChange,
  placeholder = "Search a city, region or place...",
  className,
  maxLength = 160,
}: LocationPickerProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function search(q: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("search failed");
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function pick(r: NominatimResult) {
    const a = r.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.suburb ?? a.county;
    const region = a.state ?? a.region;
    const country = a.country;
    const pretty = [city, region, country].filter(Boolean).join(", ") || r.display_name;
    setQuery(pretty);
    setOpen(false);
    onChange(pretty, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) });
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            const v = e.target.value.slice(0, maxLength);
            setQuery(v);
            onChange(v);
            search(v);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-full border border-border bg-muted px-9 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange("");
              setResults([]);
            }}
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            aria-label="Clear"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2 text-foreground">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
