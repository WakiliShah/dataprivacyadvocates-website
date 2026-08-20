# Ask Wakili — Build Note

AI-assisted legal-issue-spotting tool, embedded on `expertise.html` (Data
Protection & Privacy section) and, in a lighter-touch form, on `contact.html`
(before the "Talk to Counsel" options). Grounded entirely in the site's own
Case Digest — it does not know anything about Kenyan law beyond what's
already published in `case-digest-index.json`.

## What it does

A visitor describes a situation in plain language. The tool returns:
a one-line issue label, a short plain-English explanation, up to three
matching case notes from the Case Digest (never more), and a set of related
topic tags. It never gives a definitive legal conclusion, and it says so —
in the model's own output and in a static disclaimer on every render.

## Why grounding is the whole design, not a feature of it

The risk with a tool like this isn't tone, it's citation. An LLM asked
"what case supports this" will produce a plausible-sounding case name if it
doesn't have one — that's the single biggest way a tool like this damages a
firm's credibility. Two independent layers guard against it:

1. **Prompt-level**: the system prompt gives the model the full text of every
   entry in `ask-wakili-casebank.mts` and instructs it to cite only by exact
   `id`, and to say `"no_match": true` rather than force a weak match.
2. **Server-level (the layer that actually matters)**: `ask-wakili.mts`
   discards any `id` in the model's response that isn't a real key in
   `CASEBANK_BY_ID`, before the response ever reaches the browser. A prompt
   instruction is a request; this filter is a guarantee. Tested directly by
   feeding the render path a fabricated id — confirmed dropped, not shown.

The corpus itself is a **snapshot**, not a live read of
`case-digest-index.json` at request time (`ask-wakili-casebank.mts` is a
generated, checked-in file — see "Keeping the corpus in sync" below). One
entry (Balicha v Platinum Credit Limited) was independently checked against
Kenya Law directly; the other 32 were carried over from the Case Digest as
published and have not each been individually re-verified in this pass —
same caveat that applies to the Case Digest pages themselves.

## Files added / changed

```
netlify/functions/ask-wakili.mts                 NEW — the endpoint itself
netlify/functions/lib/ask-wakili-casebank.mts     NEW — generated corpus (33 entries)
netlify/functions/lib/privacy-config.mts          CHANGED — added ask_wakili_query activity
expertise.html                                    CHANGED — widget inserted after #data-protection
contact.html                                      CHANGED — lighter variant inserted before #talk-to-counsel
```

Nothing else was touched. In particular: `styles.css`, `script.js`, and
every other function file are untouched — Ask Wakili's CSS lives in a scoped
`<style>` block on each page it appears on, following the same pattern as
`changelog.html`.

## Required environment variable

| Variable | Where | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Netlify → Site configuration → Environment variables | Get a **production** key from console.anthropic.com. Never the same key used in a local `.env` you might commit. The function returns a clean 503 ("Ask Wakili is not fully set up yet") if this is missing, rather than crashing. |

No other new environment variables. Reuses `ALLOWED_ORIGINS` and whatever
Netlify Blobs configuration the existing functions already rely on via
`lib/security.mts`.

## Design decisions worth understanding, not just accepting

**The query text is never stored — only metadata is.** Unlike the contact
and webinar forms, there's no consent checkbox here, and a query can contain
personal data about the visitor or a third party they mention. The audit
record written to the `ask-wakili-log` Blobs store contains a *hashed* IP,
query length, matched-case citations, and whether the query was a "no
match" — never the query string itself. See the `TODO(Patrick)` in
`privacy-config.mts` on the lawful-basis call (`legitimate_interests`) —
that balancing judgment is flagged for you to confirm, the same way exact
statutory citations are flagged elsewhere in this codebase rather than
guessed at.

**Rate limit is 8 requests / 10 minutes per IP**, reusing
`lib/security.mts: checkRateLimit` — same Netlify-Blobs-backed sliding
window as the other endpoints, with the same caveat already documented in
`PRIVACY-COMPLIANCE-BUILD.md`: eventually consistent, fine for casual abuse,
not a WAF.

**The hero panel uses fixed hex colours, not `var(--ink)` / `var(--paper)`.**
While building this, dark mode was tested and the hero briefly went
near-invisible — text and background were both flipping to the same value.
Root cause: `--ink` inverts under `[data-theme="dark"]`, but
`.section--ink` elsewhere in `styles.css` sets `background:var(--ink)`,
which means **every dark accent band on the live site currently has this
same latent contrast bug in dark mode**, not just this new component. Fixed
locally here with literal hex values (`#1b1a17` / `#f2ecdc`) so Ask Wakili
stays legible regardless of site theme. `.section--ink` itself was
deliberately left untouched — that's shared sitewide and outside this
pass; worth its own fix.

**Visual language borrows from `.hp-dash` and `.cl-preview-card` on purpose**,
not from scratch: the live-pulse dot, the glass-panel input treatment, and
the hover-lift + brass-border authority cards all reuse patterns already
established on the homepage dashboard and Case Digest preview, rather than
introducing a new visual idiom for one component.

## What's deliberately not done yet

- **The other 32 Case Digest entries haven't been individually re-verified**
  against Kenya Law by this pass — only Balicha v Platinum Credit Limited
  was spot-checked. Worth a verification sweep before leaning on this
  tool's coverage claims in any marketing of it.
- **No live end-to-end test against the real Anthropic API.** Everything was
  type-checked (`tsc --strict`), bundle-checked with esbuild (same bundler
  Netlify uses — confirmed clean), and the grounding filter was tested
  directly by simulating a model response containing a fabricated case id.
  What couldn't be tested here: an actual request hitting the real
  `api.anthropic.com` with a live key. Test that on a deploy preview first.
- **No server-side content moderation beyond the grounding filter.** The
  system prompt constrains tone and citations; it does not defend against a
  visitor deliberately trying to prompt-inject the model into saying
  something off-brand. Low-stakes for an educational tool with no
  authenticated actions behind it, but worth knowing before this gets
  linked from anywhere higher-traffic than the two pages it's on now.
- **No pre-fill from Ask Wakili into the contact form.** The Contact page
  variant links to `#talk-to-counsel` but doesn't carry the visitor's typed
  query into the enquiry textarea. Straightforward to add — deferred to
  keep this pass reviewable.

## Deploy checklist

1. Merge these five files into the real repo (not this zip's directory
   structure — check paths match your actual `netlify/functions/` layout).
2. Set `ANTHROPIC_API_KEY` in Netlify's environment variables for the
   relevant deploy context (production, and any deploy-preview context you
   want to test in first).
3. Push to a deploy preview. Open `expertise.html#data-protection`, submit a
   real query, confirm: (a) a response comes back, (b) every citation shown
   links to a real page on the site, (c) the browser network tab shows no
   Anthropic key or system prompt anywhere in the request/response the
   *client* sends — only your own `/api/ask-wakili` call.
4. Check dark mode specifically (toggle via the nav) on both pages.
5. Check the rate limit fires after 8 rapid submissions and recovers after
   the window.
6. Only then merge to production.
