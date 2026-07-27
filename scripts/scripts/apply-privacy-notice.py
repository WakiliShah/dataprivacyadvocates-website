#!/usr/bin/env python3
"""
PART 1 — Privacy notice propagation script.

This is the single source of truth for the consent-checkbox + privacy-notice
markup embedded in the newsletter form (48 instances) and the webinar form
(1 instance). This mirrors the existing pattern already used in this repo
for assets/config/site-social.json ("update this file, then re-run the
script to propagate") — the notice text lives here, not independently
copy-pasted across 49 files.

Usage:
    python3 scripts/apply-privacy-notice.py

Idempotent: running it twice is a no-op the second time (it checks for the
target markup before touching a file). If you change NEWSLETTER_OLD/NEW or
WEBINAR_OLD/NEW below to reflect a copy change, you'll need to first revert
affected files to the *previous* NEW text (or restore from git) before
re-running, since this script does exact substring replacement rather than
diffing — the same constraint the site-social.json propagation script has.

IMPORTANT: The retention/purpose/lawful-basis figures quoted in the notice
text below are hand-mirrored from netlify/functions/lib/privacy-config.mts.
If you change a retention period or lawful basis there, update the text
below to match and re-run this script.
"""
import re
import subprocess
import sys

ROOT = "."

PRIVACY_POLICY_HREF = "/privacy-policy.html"
CONTACT_EMAIL = "consult@dataprivacyadvocates.co.ke"

# ---------------------------------------------------------------------------
# NEWSLETTER — two markup variants survive from the Build-1 form migration.
# ---------------------------------------------------------------------------

NEWSLETTER_CONSENT_BLOCK = f'''<div style="width:100%;text-align:left;font-size:.78rem;line-height:1.45;opacity:.85;margin-top:2px;">
        <label style="display:flex;align-items:flex-start;gap:6px;cursor:pointer;font-weight:normal;">
          <input type="checkbox" name="consent" value="true" required style="margin-top:3px;flex-shrink:0;" />
          <span>By subscribing you consent to receive newsletters, legal updates, invitations to webinars and related communications from Muchangi Patrick &amp; Associates Advocates. You may unsubscribe at any time.</span>
        </label>
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;">Privacy notice</summary>
          <p style="margin:6px 0 0;">We collect your email address to send the Kenya Privacy Law Review newsletter. Lawful basis: your consent. Purpose: legal updates and newsletters. Retention: until you unsubscribe. You may access, correct, or request deletion of your data, or unsubscribe, at any time &mdash; see our <a href="{PRIVACY_POLICY_HREF}" style="color:inherit;">Privacy Policy</a> or email {CONTACT_EMAIL}.</p>
        </details>
      </div>
      <input type="hidden" name="rendered_at" value="" class="js-rendered-at" />'''

NEWSLETTER_V1_OLD = '''<input type="email" name="email" required placeholder="you@company.co.ke" style="flex:1;min-width:220px;padding:12px 16px;border-radius:6px;border:none;font-family:inherit;font-size:.95rem;" />
      <button type="submit" class="btn btn-brass">Subscribe</button>'''
NEWSLETTER_V1_NEW = f'''<input type="email" name="email" required placeholder="you@company.co.ke" style="flex:1;min-width:220px;padding:12px 16px;border-radius:6px;border:none;font-family:inherit;font-size:.95rem;" />
      <button type="submit" class="btn btn-brass">Subscribe</button>
      {NEWSLETTER_CONSENT_BLOCK}'''

NEWSLETTER_V2_OLD = '''<input type="email" name="email" required placeholder="you@company.co.ke" style="flex:1;min-width:220px;padding:12px 16px;border-radius:6px;border:none;font-family:'IBM Plex Sans',sans-serif;font-size:.95rem;" />
      <button type="submit" style="background:#C69A3E;color:#1B1A17;border:none;padding:12px 22px;border-radius:6px;font-weight:600;font-family:'IBM Plex Sans',sans-serif;font-size:14px;cursor:pointer;">Subscribe</button>'''
NEWSLETTER_V2_NEW = f'''<input type="email" name="email" required placeholder="you@company.co.ke" style="flex:1;min-width:220px;padding:12px 16px;border-radius:6px;border:none;font-family:'IBM Plex Sans',sans-serif;font-size:.95rem;" />
      <button type="submit" style="background:#C69A3E;color:#1B1A17;border:none;padding:12px 22px;border-radius:6px;font-weight:600;font-family:'IBM Plex Sans',sans-serif;font-size:14px;cursor:pointer;">Subscribe</button>
      {NEWSLETTER_CONSENT_BLOCK}'''

# ---------------------------------------------------------------------------
# WEBINAR — one instance (webinars.html). Separate, optional, unchecked
# marketing consent + privacy notice, distinct from the required
# registration fields (registration is contract-basis, not consent-basis).
# ---------------------------------------------------------------------------

WEBINAR_OLD = '''<input type="hidden" name="webinar" value="The Guarantor Gap — 12 August 2026" />'''
WEBINAR_NEW = '''<input type="hidden" name="webinar" value="The Guarantor Gap — 12 August 2026" />
        <input type="hidden" name="rendered_at" value="" class="js-rendered-at" />'''


def apply(old, new, files, label):
    count = 0
    for f in files:
        content = open(f, encoding="utf-8").read()
        if new in content:
            continue  # already applied — idempotent
        if old not in content:
            print(f"  SKIP (pattern not found): {f}")
            continue
        content = content.replace(old, new, 1)
        open(f, "w", encoding="utf-8").write(content)
        count += 1
    print(f"{label}: updated {count} file(s)")


def main():
    out = subprocess.run(
        ["grep", "-rl", "kplr-subscribe", "--include=*.html", ROOT],
        capture_output=True, text=True
    ).stdout
    newsletter_files = [f.strip() for f in out.splitlines()]

    apply(NEWSLETTER_V1_OLD, NEWSLETTER_V1_NEW, newsletter_files, "Newsletter consent block (variant 1)")
    apply(NEWSLETTER_V2_OLD, NEWSLETTER_V2_NEW, newsletter_files, "Newsletter consent block (variant 2)")
    apply(WEBINAR_OLD, WEBINAR_NEW, ["./webinars.html"], "Webinar rendered_at field")


if __name__ == "__main__":
    main()
