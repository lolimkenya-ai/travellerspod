
# travelpod — Frontend Prototype Plan (revised: flat action bar)

A mobile-first, dark, immersive social travel app prototype. Mock data only. Anyone can browse; tapping any interaction opens a sign-up sheet.

## Header & navigation (matches your screenshot)

```text
┌──────────────────────────────────────────────┐
│ travelpod            ⊕  🔍  🔔  ✉  👤        │
│  Discover  Following  Broadcasts  Trip Boards │
│ ( All ) Destinations  Hotels & Resorts  …     │
│                                               │
│         [ feed content area ]                 │
└──────────────────────────────────────────────┘
```

- Top bar: wordmark + Create / Search / Notifications / Messages / Profile
- Primary tabs: Discover · Following · Broadcasts · Trip Boards (active = white text + underline)
- Category chips: horizontal scroll, active chip white-on-black, others dark gray
- No bottom tab bar — nav lives in the header

## Post layout — flat horizontal action bar (NEW)

LinkedIn-style bottom action row, but with travelpod's interaction set. The action bar sits **below each post**, full-width, flat, no floating right rail.

```text
┌───────────────────────────────────────────┐
│  @nora · Bali 📍                  • Follow│
│ ┌───────────────────────────────────────┐ │
│ │            [ video / image ]          │ │
│ └───────────────────────────────────────┘ │
│  "Sunrise at Uluwatu — worth the 4am"     │
│  1.2k likes · 84 comments · 31 reposts    │  ← stat row (tap to open)
│ ───────────────────────────────────────── │
│  ♡ Like   💬 Comment   🔁 Repost   ↗ Share│  ← primary action bar
│  ───────────────────────────────────────  │
│  🔖 Save to Trip Board     [ Inquire Now ]│  ← secondary row (verified biz)
└───────────────────────────────────────────┘
```

**Primary action bar** (always visible, evenly spaced, icon + label, ~48px tappable):
- Like — heart, fills sunset-orange when active, count animates
- Comment — speech bubble, opens threaded comment sheet
- Repost — circular arrows, opens Quote / Inline picker
- Share — arrow-up-right, opens share sheet (mocked)

**Secondary row** (below a thin divider):
- Save to Trip Board — bookmark icon, opens board picker sheet
- Inquire Now — pill button, only on verified-business posts, right-aligned

**Stat row** above the action bar shows like/comment/repost counts — tapping a stat opens the relevant sheet.

**Video posts** keep immersive full-bleed media but the action bar is part of the card, not floating overlays. On full-screen video posts the action bar gets a soft gradient background so it stays legible over moving video.

## Tabs & screens

1. **Discover** — hybrid feed filtered by chip category
2. **Following** — followed creators only
3. **Broadcasts** — boosted posts from organization accounts (can repeat, marked "Broadcast")
4. **Trip Boards** — grid of location-based boards; tap to see saved posts
5. **Header icons** — Create sheet, Search, Notifications, Messages inbox + thread, Profile

## Key interactions (all mocked)

- Swipe up on Discover → next post; non-ad posts seen-once per session; Broadcasts can reappear
- Comment → bottom sheet, threaded + nested replies + inline reposts inside threads
- Repost → modal: Quote (your thoughts + original attached) or Inline (appears in original's comments)
- Save → bottom sheet to pick a Trip Board or create a new one (location-tagged)
- Logged-out + any interaction → Sign up / Log in sheet (Google + email/OTP visual only)
- Inquire Now → pre-filled message thread with the business

## Visual direction

- Pure black `#000` background, near-white foreground
- Sunset-orange accent for primary actions (active like, follow, Inquire Now)
- Teal for location pins and Trip Boards
- Inter, slightly bolder wordmark
- Rounded-2xl cards, hairline dividers in the action bar
- Subtle motion: like-burst, bookmark fill, count tick-up, tab underline slide

## Build steps

1. **Design tokens** — dark HSL tokens in `index.css` + `tailwind.config.ts`; app wrapped in `dark`.
2. **Mock data** — `src/data/`: posts, users (normal / verified-business / organization), boards, comments, notifications, conversations, categories. Unsplash images, public sample MP4s.
3. **AppShell** — sticky header (wordmark + icons), primary tabs, category chip strip. Routes: `/`, `/following`, `/broadcasts`, `/boards`, `/boards/:id`, `/search`, `/notifications`, `/messages`, `/messages/:id`, `/profile/:nametag`, `/post/:id`, `/create`.
4. **Feed engine** — `FeedContainer` with vertical snap-scroll, renders `VideoPost` / `ImagePost` / `TextCardPost`. Filters by active chip. `SeenPostsContext` prevents non-ad repeats; Broadcasts bypass.
5. **Post shell** — shared `PostCard` with `AuthorChip`, media slot, caption, `StatRow`, and the new flat `PostActionBar` (primary + secondary rows).
6. **PostActionBar** — `ActionButton` with icon, label, count, active state. Secondary row conditionally renders `InquireNowButton` for verified-business posts.
7. **Comment sheet** — Radix Drawer, threaded list, reply input, inline-repost as nested card.
8. **Repost flow** — modal with Quote / Inline + textarea.
9. **Save → Board sheet** — list of Trip Boards + "New board" with location field.
10. **Trip Boards screen** — grid of boards with cover collage; detail page lists saved posts.
11. **Header destinations** — Search, Notifications, Messages (inbox + thread with Inquire Now prefill), Profile (header + Posts / Reposts / Boards tabs).
12. **Auth gate** — `useAuth` mock context (default `null`); `<RequireAuth>` opens `SignUpSheet` (Google + email/OTP, visual only).
13. **Create sheet** — ⊕ opens sheet with Video / Image / Text card placeholder composer.

## Technical notes

- React 18, Vite, Tailwind, shadcn/ui, react-router-dom. No backend.
- Colors via HSL CSS variables; no hard-coded hex in components.
- Video: native `<video>` + `IntersectionObserver`, autoplay in-view, muted with tap-to-unmute.
- Snap scrolling: `snap-y snap-mandatory` on feed; each `PostCard` is `snap-start` and sized to the area under the header.
- `PostActionBar` uses `flex justify-between` with equal-width buttons; stat row above is a separate `flex` row with `gap-3` and dot separators.
- State via React context: `AuthContext`, `SeenPostsContext`, `BoardsContext`, `CategoryContext`, `TabContext`.
- Mobile-first; on ≥`md` feed centers in a ~460px column with dim backdrop.
- Out of scope (Phase 2 with Lovable Cloud): real auth, uploads, message delivery, business verification, broadcast engine, admin review.
