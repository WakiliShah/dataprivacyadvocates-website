#!/usr/bin/env python3
"""
Fixes a real quality-guideline conflict introduced in the Phase-2 pass:

Google's Article structured-data guidance is explicit that author and
publisher information declared in JSON-LD "must be visible to users on the
page" (developers.google.com/search/docs/appearance/structured-data/article).

The 31 case-note pages carry a visible on-page byline reading
"By the Editorial Board, Muchangi Patrick & Associates Advocates" — not
Patrick Muchangi individually. Phase 2 set Article.author to a Person node
for "Patrick Muchangi" on these same pages, which now visibly contradicts
what a reader (and Googlebot) sees on the page itself.

The 4 executive-brief pages have no visible author byline at all (personal
or institutional), so a Person-author claim there is also unsupported by
on-page content.

Fix: revert author on these 35 pages to the Organization node (matching what
IS visible), keeping the @id/sameAs consolidation. Person-author schema is
left in place only on the insight-*.html pages, which is where Patrick
Muchangi is genuinely the visible, named author.

Idempotent.
"""
import re
import os
import json
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "assets", "config", "site-social.json")))
ORG_ID = CFG["organization"]["id"]
ORG_NAME = CFG["organization"]["name"]
ORG_LINKEDIN = CFG["organization"]["linkedinCompanyUrl"]

LDJSON_RE = re.compile(r'(<script type="application/ld\+json">\s*\n?)(.*?)(\n?\s*</script>)', re.DOTALL)

TARGET_FILES = set(glob.glob(os.path.join(ROOT, "case-*.html"))) | {
    os.path.join(ROOT, n) for n in [
        "sacco-executive-brief.html",
        "sacco-digital-trust-executive-brief.html",
        "sacco-digital-lending-executive-brief.html",
        "schools-data-protection-executive-brief.html",
    ]
}

log = []


def revert_author(node, changed):
    if not isinstance(node, dict):
        return node
    if node.get("@type") == "Article":
        author = node.get("author")
        if isinstance(author, dict) and author.get("@type") == "Person":
            node["author"] = {
                "@type": "Organization",
                "@id": ORG_ID,
                "name": ORG_NAME,
                "sameAs": [ORG_LINKEDIN],
            }
            changed[0] = True
    return node


def process(raw):
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None, False
    changed = [False]
    if isinstance(data, dict):
        data = revert_author(data, changed)
    if not changed[0]:
        return None, False
    return json.dumps(data, indent=2, ensure_ascii=False), True


for path in sorted(TARGET_FILES):
    name = os.path.basename(path)
    html = open(path, encoding="utf-8").read()
    original = html

    def _sub(m):
        new_json, changed = process(m.group(2))
        if not changed:
            return m.group(0)
        log.append(f"{name}: Article author reverted Person -> Organization (matches visible byline)")
        return m.group(1) + new_json + m.group(3)

    html = LDJSON_RE.sub(_sub, html)
    if html != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

print("\n".join(log))
print(f"\n{len(log)} files reverted.")
