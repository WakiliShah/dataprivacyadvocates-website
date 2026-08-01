# Form Automation — Build 1 (Newsletter + Webinar)

What this build does, what changed on disk, and what you need to configure in Netlify before it goes live.

---

## What's now live in the codebase

A single serverless endpoint — **`/api/form-submit`** (`netlify/functions/form-submit.mts`) — now handles the two highest-impact forms identified in the audit:

| Form | Instances | Was | Now |
|---|---|---|---|
| Footer/inline newsletter (`kplr-subscribe`) | 48 | Native Netlify POST, **no acknowledgment at all** | Validated → saved → branded confirmation email → in-page confirmation |
| Webinar registration (`wb-form`) | 1 | Native Netlify POST, in-page confirmation only, **no email despite promising one** | Same in-page UX preserved, now also sends the Zoom-link confirmation email it already promises |

Every submission through this endpoint is validated server-side, saved to Netlify Blobs (`form-submissions` store) as a single system of record, triggers a branded internal notification to the firm, sends a branded acknowledgment email to the visitor, and has a stub hook (`AUTOMATION_WEBHOOK_URL`) ready for n8n/Zoho CRM once that phase starts — so nothing here needs rebuilding when "Tomorrow" arrives.

**Deliberately not touched in this pass** (per the audit's recommended build order — these still work on their current backend and get migrated onto `/api/form-submit` in Build 2):
- Resource-gate downloads (`kg-form`, 47 instances) — still Netlify Forms
- In-article newsletter, Executive Brief feedback, and the main Contact form — still Formspree

## Files added / changed

```
netlify/functions/form-submit.mts          NEW — the pipeline handler
netlify/functions/lib/email-templates.mts  NEW — reusable branded email shell + 2 templates
netlify.toml                               NEW — declares the functions directory
package.json                               NEW — @netlify/blobs, nodemailer
script.js                                  CHANGED — per-form-type default acknowledgment copy
webinars.html                              CHANGED — form now posts to /api/form-submit
+ 48 pages                                 CHANGED — newsletter form migrated (see FORM-AUDIT doc)
all pages loading script.js                CHANGED — cache-busting version bumped to ?v=10
```

## Required Netlify environment variables

Set these in **Netlify UI → Site configuration → Environment variables** (or via `netlify env:set`):

| Variable | Required | Notes |
|---|---|---|
| `ZOHO_SMTP_USER` | Yes | The sending mailbox, e.g. `consult@dataprivacyadvocates.co.ke` |
| `ZOHO_SMTP_PASS` | Yes | A Zoho Mail **app-specific password** (Zoho Mail → Settings → Security → App Passwords) — not your normal login password |
| `ZOHO_SMTP_HOST` | No | Defaults to `smtp.zoho.com`. Use `smtp.zoho.eu` / `smtp.zoho.in` etc. if your Zoho account is on a different data centre |
| `ZOHO_SMTP_PORT` | No | Defaults to `465` |
| `INTERNAL_NOTIFY_EMAIL` | No | Where lead notifications go. Defaults to `ZOHO_SMTP_USER` |
| `SITE_URL` | No | Defaults to `https://dataprivacyadvocates.co.ke` |
| `AUTOMATION_WEBHOOK_URL` | No | Leave unset for now — this is the future n8n/Zoho CRM hook |

**Until `ZOHO_SMTP_USER`/`ZOHO_SMTP_PASS` are set**, the function still validates and saves every submission (so nothing is lost) but skips sending email and logs a warning in the function log. That means it's safe to deploy this before Zoho Mail credentials are ready — the newsletter form will still be a strict improvement (validated, saved, in-page confirmed) even before email is switched on.

## Deploy steps

```bash
npm install          # pulls in @netlify/blobs + nodemailer
netlify deploy --prod    # or push to whatever branch triggers your existing deploy
```

No build command changes — this is still a static site; only the two new serverless-function files and `netlify.toml`'s `[functions]` block are new to the deploy.

## How to check it's working

1. Set the env vars above.
2. Submit the newsletter form on any page (e.g. the homepage footer).
3. You should get: an in-page "You're subscribed" message, an internal notification email at `INTERNAL_NOTIFY_EMAIL`, and a branded confirmation email at the address you submitted.
4. To inspect stored submissions directly: `netlify blobs:list form-submissions` (or via the Netlify UI once Blobs browsing is available for your plan).

## Next build (not yet done)

Per the audit's recommended order: migrate the resource-gate modal and the three Formspree forms (consultation, feedback, in-article newsletter) onto `/api/form-submit`, then componentize the 4 duplicated Executive Brief feedback forms into one shared partial, then add lead capture to the 33 case-law pages that currently have none.
