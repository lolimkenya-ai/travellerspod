import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Loader2, Plus, Trash2, Search, ExternalLink, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface VerifiedBiz {
  id: string;
  display_name: string;
  nametag: string;
  avatar_url: string | null;
  bio: string | null;
  listings_count?: number;
}

interface MyListing {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  price: number | null;
  currency: string;
  unit: string | null;
  external_url: string | null;
  is_active: boolean;
}

interface MyLink {
  id: string;
  label: string;
  url: string;
}

const blankListing = (): Omit<MyListing, "id"> => ({
  title: "",
  description: "",
  category: "",
  price: null,
  currency: "USD",
  unit: "",
  external_url: "",
  is_active: true,
});

export default function B2BMarketplaceTab({ verified }: { verified: boolean }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [query, setQuery] = useState("");
  const [businesses, setBusinesses] = useState<VerifiedBiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [myListings, setMyListings] = useState<MyListing[]>([]);
  const [myLinks, setMyLinks] = useState<MyLink[]>([]);
  const [newListing, setNewListing] = useState<Omit<MyListing, "id">>(blankListing());
  const [savingListing, setSavingListing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<MyListing | null>(null);
  const [newLink, setNewLink] = useState({ label: "", url: "" });

  // Browse: load all verified businesses (RLS limits visibility to verified callers)
  useEffect(() => {
    if (!verified) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, nametag, avatar_url, bio")
        .eq("account_type", "business")
        .eq("verification_status", "verified")
        .order("display_name", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
      } else {
        setBusinesses((data as VerifiedBiz[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [verified]);

  // My listings + links
  useEffect(() => {
    if (!verified || !user || tab !== "mine") return;
    let cancelled = false;
    (async () => {
      const [{ data: ls }, { data: ln }] = await Promise.all([
        supabase
          .from("b2b_listings" as any)
          .select("id, title, description, category, price, currency, unit, external_url, is_active")
          .eq("business_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("b2b_external_links" as any)
          .select("id, label, url")
          .eq("business_id", user.id)
          .order("sort_order", { ascending: true }),
      ]);
      if (cancelled) return;
      setMyListings((ls as unknown as MyListing[]) ?? []);
      setMyLinks((ln as unknown as MyLink[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [verified, user, tab]);

  if (!verified) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <BadgeCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-foreground">B2B marketplace is only for verified businesses.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Get verified to publish exclusive rates and reach other travel businesses.
        </p>
      </div>
    );
  }

  async function addListing() {
    if (!user || !newListing.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSavingListing(true);
    const { error } = await supabase.from("b2b_listings" as any).insert({
      business_id: user.id,
      title: newListing.title.trim(),
      description: newListing.description?.trim() || null,
      category: newListing.category?.trim() || null,
      price: newListing.price,
      currency: newListing.currency || "USD",
      unit: newListing.unit?.trim() || null,
      external_url: newListing.external_url?.trim() || null,
      is_active: true,
    });
    setSavingListing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewListing(blankListing());
    toast.success("Listing added");
    // refresh
    const { data: ls } = await supabase
      .from("b2b_listings" as any)
      .select("id, title, description, category, price, currency, unit, external_url, is_active")
      .eq("business_id", user.id)
      .order("created_at", { ascending: false });
    setMyListings((ls as unknown as MyListing[]) ?? []);
  }

  async function deleteListing(id: string) {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabase.from("b2b_listings" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyListings((ls) => ls.filter((l) => l.id !== id));
  }

  async function saveEdit() {
    if (!editDraft) return;
    const { error } = await supabase
      .from("b2b_listings" as any)
      .update({
        title: editDraft.title.trim(),
        description: editDraft.description?.trim() || null,
        category: editDraft.category?.trim() || null,
        price: editDraft.price,
        currency: editDraft.currency || "USD",
        unit: editDraft.unit?.trim() || null,
        external_url: editDraft.external_url?.trim() || null,
        is_active: editDraft.is_active,
      })
      .eq("id", editDraft.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyListings((ls) => ls.map((l) => (l.id === editDraft.id ? editDraft : l)));
    setEditingId(null);
    setEditDraft(null);
  }

  async function addLink() {
    if (!user || !newLink.label.trim() || !newLink.url.trim()) return;
    const { data, error } = await supabase
      .from("b2b_external_links" as any)
      .insert({
        business_id: user.id,
        label: newLink.label.trim(),
        url: newLink.url.trim(),
      })
      .select("id, label, url")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyLinks((ls) => [...ls, data as unknown as MyLink]);
    setNewLink({ label: "", url: "" });
  }

  async function deleteLink(id: string) {
    const { error } = await supabase.from("b2b_external_links" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setMyLinks((ls) => ls.filter((l) => l.id !== id));
  }

  const filtered = businesses.filter((b) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      b.display_name.toLowerCase().includes(q) ||
      b.nametag.toLowerCase().includes(q) ||
      (b.bio ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full bg-muted p-1">
        <button
          onClick={() => setTab("browse")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            tab === "browse" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Browse marketplace
        </button>
        <button
          onClick={() => setTab("mine")}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
            tab === "mine" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          My B2B listings
        </button>
      </div>

      {tab === "browse" && (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search verified businesses"
              className="w-full rounded-full border border-border bg-muted py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No verified businesses found.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((b) => (
                <Link
                  key={b.id}
                  to={`/business/b2b/${b.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent"
                >
                  <img
                    src={
                      b.avatar_url ??
                      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(b.display_name)}`
                    }
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {b.display_name}
                      </p>
                      <BadgeCheck className="h-3.5 w-3.5 fill-verified text-verified-foreground" />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      @{b.nametag}
                      {b.bio && ` · ${b.bio.slice(0, 80)}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "mine" && (
        <div className="space-y-4">
          {/* Add new listing */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Publish a B2B service
            </p>
            <div className="space-y-2">
              <input
                value={newListing.title}
                onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                placeholder="Service title (e.g. Serengeti 4-day safari)"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <textarea
                value={newListing.description ?? ""}
                onChange={(e) => setNewListing({ ...newListing, description: e.target.value })}
                placeholder="Describe what's included, dates, terms..."
                rows={2}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newListing.category ?? ""}
                  onChange={(e) => setNewListing({ ...newListing, category: e.target.value })}
                  placeholder="Category (e.g. Safari)"
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  value={newListing.unit ?? ""}
                  onChange={(e) => setNewListing({ ...newListing, unit: e.target.value })}
                  placeholder="Unit (e.g. per person)"
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  value={newListing.currency}
                  onChange={(e) => setNewListing({ ...newListing, currency: e.target.value.toUpperCase().slice(0, 4) })}
                  placeholder="USD"
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="number"
                  value={newListing.price ?? ""}
                  onChange={(e) =>
                    setNewListing({ ...newListing, price: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="B2B rate"
                  className="col-span-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <input
                value={newListing.external_url ?? ""}
                onChange={(e) => setNewListing({ ...newListing, external_url: e.target.value })}
                placeholder="External booking URL (optional)"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={addListing}
                disabled={savingListing}
                className="flex w-full items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {savingListing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Publish listing
              </button>
            </div>
          </div>

          {/* Existing listings */}
          {myListings.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No listings yet.</p>
          ) : (
            <div className="space-y-2">
              {myListings.map((l) =>
                editingId === l.id && editDraft ? (
                  <div key={l.id} className="space-y-2 rounded-xl border border-primary/40 bg-card p-3">
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editDraft.description ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={editDraft.currency}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, currency: e.target.value.toUpperCase().slice(0, 4) })
                        }
                        className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        value={editDraft.price ?? ""}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            price: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        className="col-span-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      value={editDraft.external_url ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, external_url: e.target.value })}
                      placeholder="External URL"
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={editDraft.is_active}
                        onChange={(e) => setEditDraft({ ...editDraft, is_active: e.target.checked })}
                      />
                      Active
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEdit}
                        className="flex flex-1 items-center justify-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        <Save className="h-3.5 w-3.5" /> Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                        className="flex items-center justify-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
                      >
                        <X className="h-3.5 w-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={l.id} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{l.title}</p>
                        {!l.is_active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            Hidden
                          </span>
                        )}
                      </div>
                      {l.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{l.description}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {l.price != null ? `${l.currency} ${Number(l.price).toLocaleString()}` : "No price"}
                        {l.unit ? ` · ${l.unit}` : ""}
                        {l.category ? ` · ${l.category}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(l.id);
                        setEditDraft(l);
                      }}
                      className="rounded-full p-1.5 hover:bg-accent"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteListing(l.id)}
                      className="rounded-full p-1.5 hover:bg-accent"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ),
              )}
            </div>
          )}

          {/* External B2B platform links */}
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Other B2B platforms you use
            </p>
            <div className="space-y-2">
              {myLinks.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{l.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{l.url}</p>
                  </div>
                  <button
                    onClick={() => deleteLink(l.id)}
                    className="rounded-full p-1 hover:bg-accent"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newLink.label}
                  onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                  placeholder="Label"
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                />
                <input
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  placeholder="https://..."
                  className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={addLink}
                className="flex w-full items-center justify-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add platform link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
