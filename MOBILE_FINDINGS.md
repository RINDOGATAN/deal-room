# Mobile Responsiveness Audit — Layer 2

**Date:** 2026-04-29
**Targets:** iPhone SE (375×812) + iPad (768×1024)
**Scope:** static code sweep across customer-facing surfaces. Not run against live device.

Severity:
- **[H]** — visibly broken at 375 (overflow offscreen, untappable, content unreadable).
- **[M]** — usable but cramped, below WCAG/HIG touch targets, or non-ideal.
- **[L]** — polish.

---

## Verified findings

### Supervisor surface — cluster of 4 broken grids

The supervisor pages were authored desktop-first. Multiple grids have no responsive breakpoint and lock 4–5 columns at any width.

#### [H] Supervisor summary stats grid — `src/app/(supervisor)/supervise/page.tsx:116`

```tsx
<div className="grid grid-cols-4 gap-4">
```

Four cards (Assigned / Drafts / Negotiating / Agreed) lock to 4 columns regardless of viewport. At 375px each cell is ~85px wide with `text-3xl` numbers — text overflows or numbers truncate.
**Fix shape:** `grid-cols-2 md:grid-cols-4`.

#### [H] Supervisor clause-status grid — `src/app/(supervisor)/supervise/page.tsx:285`

```tsx
<div className="grid grid-cols-4 gap-2 text-center text-sm">
```

Pending / Divergent / Suggested / Agreed badges. Same problem.
**Fix shape:** `grid-cols-2 md:grid-cols-4`.

#### [H] Supervisor clause-details table — `src/app/(supervisor)/supervise/page.tsx:313`

A `grid-cols-4` "table" header (Clause | Party A Selection | Party B Selection | Status) plus matching body rows. At 375 each column is ~80px including 4px gap — selection labels and clause titles unreadable.
**Fix shape:** Wrap in `<div class="overflow-x-auto"><div class="min-w-[640px] grid-cols-4 ...">` so the table horizontal-scrolls on mobile rather than crushing. (Alternative: collapse to a card layout per clause on mobile — more work.)

#### [H] Supervisor deal-detail clause table — `src/app/(supervisor)/supervise/deals/[id]/page.tsx:369,389`

Same pattern, but `grid-cols-5` (Clause | Party A | Party B | Compromise | Status). Worse at 375 — five columns at ~58px each.
**Fix shape:** Same as above — `overflow-x-auto` wrapper + `min-w-[800px]` inner grid.

**Cross-cutting decision:** the supervisor is primarily a desktop/tablet surface for attorneys reviewing deals. Two ways to ship "mobile-OK":
- **(a) Horizontal-scroll the data tables, responsive-grid the stats panels** — most honest, preserves data fidelity.
- **(b) Card-collapse on mobile** — best mobile UX, more work (~half a day refactor).
- **(c) Keep desktop-only, show "use a larger screen" at <md breakpoint** — explicit constraint, fastest to ship.

---

### Component-level — affects every page

#### [M] Slider thumb is 16px — `src/components/ui/slider.tsx:56`

```tsx
className="border-primary ring-ring/50 block size-4 ..."
```

`size-4` = 16px diameter. The compromise-firmness slider on the negotiate page is critical UX — at 16px it's hard to grab with a thumb. Apple HIG recommends 44×44 touch targets; common mobile slider thumbs are 20–24px.
**Fix shape:** `size-5` (20px) or `size-6` (24px). Whole-app effect — every Slider use benefits.

---

### Page-level [M]s

#### [M] Founder remove button is 24×24 — `src/app/(dashboard)/launch/new/page.tsx:194-200`

```tsx
<button onClick={() => removeFounder(i)} className="text-muted-foreground hover:text-destructive p-1" aria-label="Remove founder">
  <X className="w-4 h-4" />
</button>
```

`p-1` (4px) + `w-4` icon = 24×24. Below WCAG 2.5.5 minimum (44×44). On a 5-founder list with thumb-typing, mistaps land on the email field.
**Fix shape:** `p-2` (32×32 effective) or `p-2.5` (36×36). `p-3` matches WCAG AA.

#### [M] Billing add-on rows don't reflow — `src/app/(dashboard)/billing/page.tsx:171-252`

```tsx
<div className="flex items-center justify-between py-4 ...">
```

Left side: checkbox + skill name + description. Right side: price + button. At 375 long skill names ("Delaware Certificate of Incorporation") squeeze into the left half while the price stays right.
**Fix shape:** `flex-col gap-3 sm:flex-row sm:items-center sm:justify-between` — stack on mobile, side-by-side on tablet+.

#### [M] Long emails / strings need `break-all` — `src/app/(dashboard)/deals/[id]/page.tsx:194-202`

Initiator/respondent emails are styled `truncate` inside a flex container. On long subdomain emails (`name@team.subsidiary.acme.co.uk`) the truncation kicks in mid-domain, making the email unrecognizable rather than wrapping naturally.
**Fix shape:** Replace `truncate` with `break-all` on the email element specifically; keep truncate on names.

#### [M] Icon-only buttons at `p-1` / `p-1.5` across the app — multiple files

Search across the codebase finds dozens of `<button className="p-1...">` for chevrons, close-X, info-i icons. Each is below 44×44.
**Fix shape:** Codebase-wide pattern — bump every icon button to at least `p-2`. Out of scope for one commit; queue as a follow-up sweep.

---

### [L] Polish

- **Auth layout sidebar text** can wrap on narrow screens — add `whitespace-nowrap` or `hidden sm:inline` to the "DEALROOM" label.
- **2FA verify QR code at 192px** is technically OK at 375 but tight (`w-48 h-48`). `w-40 sm:w-48` is gentler.
- **Dialog footer at the bottom of long forms** can push offscreen on iPhone SE 812-tall viewport. Sticky footer or scrollable content area would be safer for the new-deal parameter dialog.
- **`group-hover:text-primary` reveals on deal cards** have no `:active` / `:focus-visible` equivalent — touch users get no feedback that a card is interactive.
- **Marketplace skill cards** are responsive (verified — `flex-1 min-w-0` + `shrink-0` work correctly), but the price text rendered after the title is `text-xs font-semibold` which can blend with the header at 375.

---

## Triage

**4 [H]s** all live in the supervisor surface. They share a single design decision (a/b/c above).

**Component-level [M]s** (slider thumb) ship across the whole app — high leverage, single-commit fix.

**Page-level [M]s** are 3–4 small commits.

**Recommended order if you want to ship now:**
1. Component-level [M]: bump slider thumb size. One-line. Affects every Slider in the app.
2. Page-level [M]s: founder remove button, billing rows, deal-detail email break. Three small edits.
3. Supervisor [H]s: pick (a)/(b)/(c) first, then implement. (a) is fastest while honest; (b) is best UX; (c) is "punt to desktop".

---

## Layer 3 — outstanding

Skill content / value-prop coverage across 45 skills × 2 langs × 3 jurisdictions. Bilingual rendering, jurisdiction-specific clauses, parameter→boilerplate bridges, no `[BRACKET]` leaks, compromise math sanity. Held until Layer 2 fixes land.
