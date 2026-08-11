# Homepage Redesign — Implementation Notes

## Revision 2 — fixed, single-view homepage
Following review, the homepage was revised so it is a **fixed, full-viewport,
non-scrolling view** rather than the top of a long scrolling page:

- `<body>` on `index.html` now carries `class="home-fixed-view"`, which scopes
  new CSS rules that pin `html`/`body` height to `100vh` with `overflow:hidden`
  on desktop/tablet-wide screens (>981px) — the document cannot be scrolled at
  all at those widths; the supplied screenshot's composition **is** the entire
  page, with nothing appended below it.
- All homepage sections that previously lived below the hero (the SACCO/SME
  path-grid, "Why Clients Choose Us", the Digital Trust intro, the five
  Advisory Solutions cards, the Phoenix Methodology timeline, the Knowledge &
  Compliance Centre section plus its compliance-checker modal, the trust
  strip, the six "Why Us" pillars, the Leadership spotlight, the Featured
  Expertise grid, Who We Serve, the Digital Trust Framework diagram, the Data
  Protection Spotlight image, the Recent Thinking / insights preview, both
  CTA bands, and the newsletter subscribe form) were **removed from
  `index.html`**. None of this content was deleted from the site — it all
  still exists as separate pages (`about.html`, `expertise.html`, `retainer.html`,
  `contact.html`, the Knowledge Centre dropdown targets, etc.), which is how
  "navigation changes between views" now works in practice: clicking a header
  nav item takes you to that page/view; it never triggers a scroll on the
  homepage.
- The `<footer>` was also removed from `index.html` for the same reason (it
  would reintroduce scrolling). The sitewide footer with all legal links
  (Privacy Policy, Terms, Cookie Notice, Accessibility, Sitemap) is unchanged
  and still present on every other page.
- The `compliance-checker.js` script tag was removed from `index.html` since
  its only target (the `#kc-modal` compliance checker) no longer exists on
  this page. `compliance-checker.js` itself was **not deleted or modified** —
  it's still on disk, and every other page that references it is unaffected.
- The `<div class="cookie-banner">` consent banner was kept — it's an
  overlay (`position:fixed`), so it doesn't introduce scrolling.

### Because 19 links won't always fit one screen
On shorter desktop/laptop viewports (verified down to a 1366×768 laptop
screen), the four service categories plus 19 links don't always fit
vertically alongside the hero. Rather than truncating the service list or
allowing the whole page to scroll, **only the sidebar scrolls internally**
(`overflow-y:auto` on `.hh-sidebar`) while the rest of the view — header,
hero text, hero image, bottom contact strip — stays fixed in place. This
was verified with a headless browser: at 1536×864, 1440×900, 1366×768,
1152×800 and 1024×768, `document.documentElement.scrollHeight` exactly
equals `clientHeight` (i.e., the page itself never scrolls), and the sidebar
list scrolls to reveal "Corporate & Commercial" / "Corporate Data
Governance" at the bottom.

### Below 981px (tablet/mobile)
At and below the existing 981px breakpoint, where the sidebar already drops
below the hero content, the fixed/no-scroll behaviour is turned off and the
single view is allowed to scroll as one unit. There was no realistic way to
fit a full hero plus a 19-link, 4-category service list on a phone screen
with zero scrolling — but this is still **one view**, not several homepage
sections stacked one after another; nothing new was added below it.

---

## Files modified
- **`index.html`**
  - Replaced the old hero section (`<section class="hero">…</section>`) with the
    new homepage composition: a left "Our Services" sidebar (4 categories, 19
    real service links), a right hero panel (eyebrow, headline, sub-line, gold
    CTA, hero image), and a bottom contact strip (phone / email / address /
    LinkedIn) — this is now the page's **only** section.
  - Relabelled two existing nav links to match the approved screenshot's wording —
    `The Firm` → `About Us` and `Solutions` → `Practice Areas`. **Hrefs were not
    changed** (`about.html`, `expertise.html`), so no link was broken.
  - Added `class="home-fixed-view"` to `<body>`.
  - Removed every section below the hero and the `<footer>` (see Revision 2
    above); removed the now-unused `compliance-checker.js` script tag.
  - Bumped the stylesheet cache-buster from `styles.css?v=5` to `styles.css?v=6`
    since new CSS was appended.
  - All meta tags, the three JSON-LD blocks, the header markup, the cookie
    banner, and the remaining script tags are untouched.

- **`styles.css`**
  - Appended a new, self-contained CSS block at the end of the file, scoped
    entirely under an `hh-` class prefix (`.hh-hero`, `.hh-grid`, `.hh-sidebar`,
    `.hh-service-group`, `.hh-main`, `.hh-main-image`, `.hh-contact-strip`, etc.),
    plus the `body.home-fixed-view` fixed-viewport rules, plus responsive rules
    at 1152px, 1024px, 981px and 640px.
  - No existing selector or rule was edited, removed, or overridden — this was a
    pure addition, so every other page that links `styles.css` is unaffected.

## Files created
- **`images/hero-scales-cityscape.jpg`** — the hero image. This is a direct crop
  of the right-hand justice-scales/book/city-skyline portion of the supplied
  approved screenshot (no external image URL was used, per the brief).
- **`HOMEPAGE-REDESIGN-IMPLEMENTATION-NOTES.md`** — this file.

## Navigation changes
- Existing "Knowledge Centre" dropdown panel (Practice Notes, Bills Review,
  Regulatory Analysis, Legal Insights, Compliance Toolkit, KPLR Academy,
  Webinars, Comparative Law) was **preserved as-is** — no duplicate navigation
  system was created.
- "The Firm" relabelled to "About Us"; "Solutions" relabelled to "Practice
  Areas" — cosmetic label changes only, matching the approved screenshot;
  underlying hrefs unchanged.
- "Our Team" and "Insights" top-level links were kept (they exist in the
  current site but not in the screenshot) rather than removed, per the
  preservation rule against deleting working navigation.
- The header's existing top utility bar (phone / email / address / LinkedIn)
  was **left in place** rather than removed, since removing it would touch
  the shared, JS-driven fixed-header shrink behaviour (`site-header.is-scrolled`)
  used across the whole site. The screenshot's bottom contact strip was added
  as a **new** element inside the hero section instead.
- With the fixed-view redesign, every nav item now genuinely represents a
  distinct "view" — the homepage view stays put and never scrolls; every
  other item navigates to its own page.

## New homepage sidebar → real page map (all 19 links verified to resolve)
**Regulatory & Compliance:** `odpc-registration.html`, `retainer.html`,
`regulatory-review.html`, `policy-procedure-drafting.html`,
`gdpr-cross-border-compliance.html`
**Litigation & Dispute Resolution:** `odpc-response-appeals.html`,
`enforcement-defence.html`, `high-court-appellate-counsel.html`,
`regulatory-dispute-support.html`
**Technology & Cyber Law:** `cybersecurity-law.html`, `technology-contracts.html`,
`vendor-processor-agreements.html`, `cloud-data-transfers.html`,
`it-compliance-counsel.html`
**Corporate & Commercial:** `fintech-startup-advisory.html`,
`commercial-agreements.html`, `regulatory-counselling.html`,
`privacy-clauses-transactions.html`, `corporate-data-governance.html`

## Assumptions made
- "No endless downward scrolling" was read as: the homepage document itself
  never scrolls on desktop/tablet-wide screens; the approved screenshot's
  composition is the whole page. The sidebar's own internal scroll (a
  contained, app-like scroll region, not page scroll) was used as the
  pragmatic way to keep all 19 real links reachable without shrinking type
  to the point of illegibility.
- "Navigation changes between views" was read as: the homepage stays fixed,
  and every header nav item continues to link to its own already-existing
  page (About Us, Practice Areas, Knowledge Centre, ODPC Registration,
  Retainer, Contact) — each of those pages is a "view" in its own right, per
  the site's existing multi-page architecture, rather than building a new
  single-page-app view-switcher that would have meant rebuilding navigation
  for the entire site.
- On phones and narrow tablets (≤981px) the single homepage view is allowed
  to scroll as a whole, since the hero and 19-link sidebar cannot realistically
  both be visible with zero scrolling on a small screen — no additional
  content was added there beyond what was already part of this one view.
- The bottom contact strip uses the same phone/email/LinkedIn values already
  present elsewhere in the site's header and footer — no new contact details
  were invented.
- The hero CTA "Explore our Knowledge Centre" links to `/resources/practice-notes/`,
  the same destination the existing Knowledge Centre dropdown's top link
  already uses.
- Existing SEO metadata and all three JSON-LD blocks (`LegalService`, `WebSite`,
  `WebPage`) were left exactly as they were.

## Verified before packaging
- [x] `index.html` opens to the redesigned, fixed homepage.
- [x] Hero image (`images/hero-scales-cityscape.jpg`) is present in the folder.
- [x] All 19 service sidebar links resolve to existing files in the site.
- [x] Every other local `href` in `index.html` resolves to an existing file.
- [x] HTML tag balance checked (`<section>`, `<aside>`, `<details>` all
      open/close evenly).
- [x] Headless-browser check at 1536×864, 1440×900, 1366×768, 1152×800 and
      1024×768: `document.documentElement.scrollHeight` equals `clientHeight`
      at every one of these — the page cannot be scrolled.
- [x] Headless-browser check that `.hh-sidebar` scrolls internally and reaches
      its last item ("Corporate Data Governance") on the shortest tested
      viewport (1366×768).
- [x] Rendered at 1152px, 1024px, 981px and 390px — sidebar and hero stack
      correctly below 981px with no overlap.
- [x] No unrelated file in the site was deleted, renamed, or rewritten (diffed
      the full folder against the original upload — only `index.html`,
      `styles.css`, and the two new files listed above differ).

## Remaining issues / things worth a human look
- Legal footer links (Privacy Policy, Terms, Cookie Notice, Accessibility,
  Sitemap) are no longer reachable from the homepage itself (no footer, no
  scroll) — they remain one click away via `contact.html`'s or any other
  page's footer, and the cookie banner still links directly to the Cookie
  Notice. Worth confirming this trade-off is acceptable, since it's a step
  away from having every legal link on every page.
- Font Awesome icons are loaded from the CDN referenced in `<head>`
  (`cdnjs.cloudflare.com`), same as the rest of the site.
- The site was **not deployed** — this is packaging only, per the brief.

## Confirmation
This ZIP contains the **complete website folder** (all 123 original files/
folders, unchanged, plus the 2 new files listed above) — not just the
homepage.

