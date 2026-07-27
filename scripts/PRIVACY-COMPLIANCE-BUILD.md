# Privacy Compliance Build — Kenya DPA 2019 / DP(General) Regulations 2021

Implementation status against the 14-part spec, mapped to actual files. Scope: the two forms already on the unified pipeline (newsletter, webinar) — same scoping principle as Build 1. The other four form types (resource-gate, in-article newsletter, Executive Brief feedback, main contact form) don't have this treatment yet; see "What's deliberately not done" below.

## Part-by-part status

| Part | Status | Where |
|---|---|---|
| 1 — Privacy notices on forms | **Done for newsletter + webinar** | `<details>` disclosure block on both forms, text sourced from `scripts/apply-privacy-notice.py` |
| 2 — Newsletter explicit consent | **Done** | Required, unchecked checkbox + server-side re-validation in `form-submit.mts` (client-side `required` alone was already flagged as bypassable in the original audit) |
| 3 — Webinar separate marketing consent | **Done** | Unchecked, optional checkbox, stored in its own `marketing_consent` block, never gates registration |
| 4 — Data minimisation | **Reviewed — no changes needed.** Newsletter already collects only email. Webinar already collects only name/email/organisation/role (role ≈ "position"). Neither exceeded the ceiling the spec sets. |
| 5 — Retention policy | **Done** | `retention_until`/`retention_policy` on every stored record (`lib/audit.mts`); scheduled cleanup in `retention-cleanup-scheduled.mts` |
| 6 — Data subject rights | **Done, with one deliberate design limit** — see below | `unsubscribe.mts` (fully automated), `dsr-request.mts` (intake + human action, not auto-fulfilled) |
| 7 — Email compliance | **Done** | `lib/email-templates.mts`: Privacy Policy link, explicit "why you're receiving this," unsubscribe link (newsletter only, real token, not mailto) |
| 8 — Security | **Done, framed honestly** — see below | `lib/security.mts`: origin verification, rate limiting, honeypot + time-trap spam checks, sanitisation, secure headers |
| 9 — International transfers | **Done** | `PRIVACY_CONFIG.transfers` in `lib/privacy-config.mts` |
| 10 — Audit trail | **Done** | `lib/audit.mts` — attached to every submission and DSR request |
| 11 — ROPA | **Done, scoped to this website** | `ropa.mts` — generated live from `PRIVACY_CONFIG`, not a static document that can drift |
| 12 — Privacy config | **Done** | `lib/privacy-config.mts` — single source of truth |
| 13 — Code quality | **Done** | Shared `lib/mailer.mts`, `lib/security.mts`, `lib/audit.mts` extracted rather than duplicated across the four function files; TypeScript throughout; every exported function documented |
| 14 — Output | This document + file list below | — |

## Two design decisions worth understanding, not just accepting

**DSR requests (access/deletion/correction) are intake, not auto-fulfilment.** `dsr-request.mts` validates, logs, generates an opaque reference token, and notifies both the requester and the firm — it does not automatically delete or disclose anything. Reasoning: an unverified email address typed into a public form isn't sufficient proof of identity to act on directly (auto-deleting someone's data because *someone* claimed to be them is itself a security problem), and this endpoint only has visibility into the website's own submission store — not matter files, correspondence, or billing records, which is where a "give me all my data" request would need to reach anyway. Unsubscribe is different and *is* fully automated, because the token proving the request is legitimate was mailed only to the subscriber's own inbox — no separate identity check is needed for that specific, reversible action.

**"CSRF protection" is implemented as Origin/Referer verification, not a token.** These are anonymous, unauthenticated public forms with no session to hijack — which is what CSRF tokens defend against. The functionally equivalent, standard mitigation for this shape of endpoint is verifying the request actually originated from the site (`lib/security.mts: verifyOrigin`), which is what's implemented. A synchroniser token would add complexity without adding real protection here.

## What's deliberately not done yet

- **Privacy notices, consent capture, and audit trail on the other 4 form types** (resource-gate, in-article newsletter, Executive Brief feedback, main contact form). They still work on their existing backends (Netlify Forms / Formspree) and weren't touched in this pass — same sequencing as Build 1. When they migrate onto `/api/form-submit`, extend `FORM_TYPE_CONFIG`, `PRIVACY_CONFIG`, and re-run/extend `scripts/apply-privacy-notice.py`.
- **Exact statutory citations.** `privacy-config.mts` and `ropa.mts` deliberately don't cite specific section numbers of the Act/Regulations, and the DSR acknowledgment email says "within the statutory period" rather than a specific day count — I didn't have high enough confidence in the exact current section numbers/response-period figures to hardcode them into production code, and a wrong citation in code is worse than a `TODO` marker for you to fill in directly. Search-marked with `TODO(Patrick)` / `[TODO: ...]` in the relevant files.
- **Rate limiting is abuse mitigation, not a hard boundary.** It's backed by Netlify Blobs, which is eventually consistent — fine for slowing down casual spam, not a substitute for a WAF if the site comes under targeted attack.
- **No live end-to-end test.** Everything was type-checked (`tsc --strict`), bundle-checked with esbuild (the same bundler Netlify uses), and the pure logic (consent gating, sanitisation, rate-limit math, origin checks, audit record shape, email template output) was run and asserted against directly. What couldn't be tested in this environment: an actual live submission hitting real Netlify Blobs + real Zoho SMTP. Test that first on a deploy preview before pointing production traffic at it.

## Files created

```
netlify/functions/lib/privacy-config.mts          Single source of truth (Part 12)
netlify/functions/lib/security.mts                 Origin check, rate limit, sanitisation (Part 8)
netlify/functions/lib/audit.mts                     Audit record builder (Part 10)
netlify/functions/lib/mailer.mts                    Shared SMTP transport (extracted, Part 13)
netlify/functions/unsubscribe.mts                   Token-based unsubscribe (Part 6)
netlify/functions/dsr-request.mts                   Access/deletion/correction intake (Part 6)
netlify/functions/retention-cleanup-scheduled.mts   Daily retention cleanup (Part 5)
netlify/functions/ropa.mts                          Live ROPA JSON endpoint (Part 11)
scripts/apply-privacy-notice.py                     Reusable notice-text propagation (Part 1)
PRIVACY-COMPLIANCE-BUILD.md                         This document
```

## Files modified

```
netlify/functions/form-submit.mts        Consent gating, security checks, audit/retention metadata
netlify/functions/lib/email-templates.mts Privacy Policy link, reason-for-receiving, real unsubscribe link
netlify.toml                             Added site-wide security headers block
script.js                                rendered_at timestamp population (spam time-trap)
webinars.html                            Marketing consent checkbox, privacy notice, fixed fine-print
                                          that previously implied automatic newsletter enrolment
48 newsletter form pages                 Consent checkbox + privacy notice (via apply-privacy-notice.py)
all pages loading script.js              Cache-busting version bumped (v10 -> v11)
```

## New endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/form-submit` | POST | Unchanged path, now consent/security/audit-aware |
| `/api/unsubscribe?token=...` | GET | One-click, single-use newsletter unsubscribe |
| `/api/dsr-request` | POST | Access / deletion / correction request intake |
| `/api/ropa` | GET | Live machine-readable Record of Processing Activities |
| `retention-cleanup-scheduled` | (cron, `@daily`) | Deletes records past `retention_until` |

No new environment variables beyond Build 1's `ZOHO_SMTP_USER`/`ZOHO_SMTP_PASS` — everything here reuses that configuration.

## Deploy

Same as Build 1 — no new dependencies were added:

```bash
npm install
netlify deploy --prod
```

Verify on a deploy preview first: submit the newsletter form without ticking consent (should be rejected with `consent_required`), then with consent ticked (should succeed and the confirmation email should contain a working unsubscribe link), then click that link and confirm the record is gone from `form-submissions`.
