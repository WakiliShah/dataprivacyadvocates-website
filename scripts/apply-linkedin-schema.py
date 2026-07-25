#!/usr/bin/env python3
"""
Applies LinkedIn integration + structured-data fixes across the static
dataprivacyadvocates.co.ke site, driven by assets/config/site-social.json.

Idempotent: safe to re-run after editing the config file.
"""
import json
import re
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "assets", "config", "site-social.json")

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

ORG_ID = CFG["organization"]["id"]
ORG_LINKEDIN = CFG["organization"]["linkedinCompanyUrl"]
FOUNDER_ID = CFG["founder"]["id"]
FOUNDER_LINKEDIN = CFG["founder"]["linkedinPersonalUrl"]
WEBSITE_ID = CFG["website"]["id"]
WEBSITE_URL = CFG["website"]["url"]
ORG_NAME = CFG["organization"]["name"]

log = []

# ---------------------------------------------------------------------------
# 1. Footer LinkedIn links (main "site-footer" template, 27 pages)
# ---------------------------------------------------------------------------
OLD_FOOTER_PLACEHOLDER = (
    '<div class="footer-social">\n'
    '          <a href="#" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>\n'
    '          \n'
    '          \n'
    '        </div>'
)
OLD_FOOTER_REAL = (
    f'<div class="footer-social"><a href="{FOUNDER_LINKEDIN}" target="_blank" '
    f'rel="noopener" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a></div>'
)
NEW_FOOTER = (
    f'<div class="footer-social"><a href="{ORG_LINKEDIN}" target="_blank" '
    f'rel="noopener noreferrer" aria-label="LinkedIn Company Page">'
    f'<i class="fab fa-linkedin-in" aria-hidden="true"></i>'
    f'<span class="sr-only">LinkedIn Company Page</span></a></div>'
)

# ---------------------------------------------------------------------------
# 2. Footer LinkedIn link (secondary "mp-gfoot" template, case/insight pages)
# ---------------------------------------------------------------------------
MPGFOOT_CONTACT_OLD = (
    '<div class="mp-gfoot-col"><h5>Contact</h5><p>Nairobi, Kenya</p>'
    '<p><a href="tel:+254722878607">0722 878 607</a></p>'
    '<p><a href="https://wa.me/254736358938" target="_blank" rel="noopener">0736 358 938 (WhatsApp)</a></p>'
    '<p><a href="mailto:consult@dataprivacyadvocates.co.ke">consult@dataprivacyadvocates.co.ke</a></p></div>'
)
MPGFOOT_CONTACT_NEW = (
    '<div class="mp-gfoot-col"><h5>Contact</h5><p>Nairobi, Kenya</p>'
    '<p><a href="tel:+254722878607">0722 878 607</a></p>'
    '<p><a href="https://wa.me/254736358938" target="_blank" rel="noopener">0736 358 938 (WhatsApp)</a></p>'
    '<p><a href="mailto:consult@dataprivacyadvocates.co.ke">consult@dataprivacyadvocates.co.ke</a></p>'
    f'<p><a href="{ORG_LINKEDIN}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Company Page">'
    f'<i class="fab fa-linkedin-in" aria-hidden="true"></i> LinkedIn</a></p></div>'
)

def patch_footers():
    for path in glob.glob(os.path.join(ROOT, "*.html")):
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            html = f.read()
        original = html

        if OLD_FOOTER_PLACEHOLDER in html:
            html = html.replace(OLD_FOOTER_PLACEHOLDER, NEW_FOOTER)
            log.append(f"{name}: footer LinkedIn placeholder -> company page link")
        elif OLD_FOOTER_REAL in html:
            html = html.replace(OLD_FOOTER_REAL, NEW_FOOTER)
            log.append(f"{name}: footer LinkedIn (was founder profile) -> company page link")

        if MPGFOOT_CONTACT_OLD in html:
            html = html.replace(MPGFOOT_CONTACT_OLD, MPGFOOT_CONTACT_NEW)
            log.append(f"{name}: mp-gfoot Contact column -> added LinkedIn company link")

        if html != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)

# ---------------------------------------------------------------------------
# 3. JSON-LD: add @id + sameAs to LegalService blocks; @id to Person blocks;
#    replace inline worksFor duplicates with an @id reference; add WebSite
#    schema once on the homepage.
# ---------------------------------------------------------------------------
LDJSON_RE = re.compile(
    r'(<script type="application/ld\+json">\s*\n)(.*?)(\n?</script>)', re.DOTALL
)

def _insert_id_after_type(node, id_value):
    """Return a new dict with '@id' inserted immediately after '@type', preserving order."""
    new_node = {}
    for k, v in node.items():
        new_node[k] = v
        if k == "@type":
            new_node["@id"] = id_value
    return new_node

def _merge_same_as(node, url):
    same_as = node.get("sameAs")
    if same_as is None:
        node["sameAs"] = [url]
    elif isinstance(same_as, list):
        if url not in same_as:
            same_as.append(url)
    elif isinstance(same_as, str):
        if same_as != url:
            node["sameAs"] = [same_as, url]

def _walk(node, changed_flag):
    """Recursively walk any JSON-LD structure (dict/list), mutating LegalService
    and Person(Patrick Muchangi) nodes in place, wherever they appear (top level,
    nested in author/publisher/provider/worksFor, or inside @graph arrays)."""
    if isinstance(node, list):
        for i, item in enumerate(node):
            node[i] = _walk(item, changed_flag)
        return node

    if not isinstance(node, dict):
        return node

    # Recurse into nested values first
    for k, v in list(node.items()):
        node[k] = _walk(v, changed_flag)

    t = node.get("@type")

    if t == "LegalService":
        if node.get("@id") != ORG_ID:
            node = _insert_id_after_type(node, ORG_ID)
            changed_flag[0] = True
        before = json.dumps(node.get("sameAs"))
        _merge_same_as(node, ORG_LINKEDIN)
        if json.dumps(node.get("sameAs")) != before:
            changed_flag[0] = True

    elif t == "Person" and node.get("name") == "Patrick Muchangi":
        if node.get("@id") != FOUNDER_ID:
            node = _insert_id_after_type(node, FOUNDER_ID)
            changed_flag[0] = True
        before = json.dumps(node.get("sameAs"))
        _merge_same_as(node, FOUNDER_LINKEDIN)
        if json.dumps(node.get("sameAs")) != before:
            changed_flag[0] = True

    return node

def process_ldjson_block(raw_json):
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        return None, False

    changed_flag = [False]
    data = _walk(data, changed_flag)

    if not changed_flag[0]:
        return None, False
    return json.dumps(data, indent=2, ensure_ascii=False), True


def patch_ldjson():
    for path in glob.glob(os.path.join(ROOT, "*.html")):
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            html = f.read()
        original = html

        def _sub(m):
            new_json, changed = process_ldjson_block(m.group(2))
            if not changed:
                return m.group(0)
            log.append(f"{name}: JSON-LD block updated (@id/sameAs/worksFor)")
            return m.group(1) + new_json + m.group(3)

        html = LDJSON_RE.sub(_sub, html)

        if html != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)

WEBSITE_SCHEMA = f'''<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "{WEBSITE_ID}",
  "url": "{WEBSITE_URL}",
  "name": "{ORG_NAME}",
  "publisher": {{"@id": "{ORG_ID}"}},
  "inLanguage": "en"
}}
</script>
'''

def add_website_schema():
    path = os.path.join(ROOT, "index.html")
    with open(path, encoding="utf-8") as f:
        html = f.read()
    if '"@type": "WebSite"' in html:
        return
    marker = "</head>"
    assert marker in html
    html = html.replace(marker, WEBSITE_SCHEMA + marker, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    log.append("index.html: added WebSite schema (@id #website)")

if __name__ == "__main__":
    patch_footers()
    patch_ldjson()
    add_website_schema()
    print("\n".join(log))
    print(f"\n{len(log)} changes applied.")
