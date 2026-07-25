#!/usr/bin/env python3
"""
Tightens entity consolidation across dataprivacyadvocates.co.ke:

1. On every Article JSON-LD block whose "author" is a bare Organization node,
   replace it with a Person node (Patrick Muchangi) carrying the canonical
   @id (#founder), so Google/AI crawlers consolidate authorship into the same
   Knowledge Graph node used on people.html and the insight-* articles.
2. On the same Article blocks, add "@id" + "sameAs" to the publisher
   Organization node so it resolves to the same #legalservice entity as
   everywhere else on the site (avoids Google treating each page's publisher
   as a distinct, unlinked organization).
3. Adds a ProfilePage schema block to people.html whose mainEntity points at
   the canonical #founder Person node (Part 1 gap: no dedicated author/profile
   page exists yet, so people.html is the interim canonical profile URL).

Idempotent: safe to re-run.
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
ORG_NAME = CFG["organization"]["name"]
ORG_LINKEDIN = CFG["organization"]["linkedinCompanyUrl"]
FOUNDER_ID = CFG["founder"]["id"]
FOUNDER_NAME = CFG["founder"]["name"]
FOUNDER_LINKEDIN = CFG["founder"]["linkedinPersonalUrl"]
WEBSITE_URL = CFG["website"]["url"]

LOGO_URL = "https://dataprivacyadvocates.co.ke/images/logo-schema.png"

log = []

LDJSON_RE = re.compile(
    r'(<script type="application/ld\+json">\s*\n?)(.*?)(\n?\s*</script>)', re.DOTALL
)


def fix_article_node(node, changed):
    if not isinstance(node, dict):
        return node
    if node.get("@type") == "Article":
        author = node.get("author")
        if isinstance(author, dict) and author.get("@type") == "Organization":
            node["author"] = {
                "@type": "Person",
                "@id": FOUNDER_ID,
                "name": FOUNDER_NAME,
                "jobTitle": "Founder & Advocate",
                "sameAs": [FOUNDER_LINKEDIN],
            }
            changed[0] = True

        publisher = node.get("publisher")
        if isinstance(publisher, dict) and publisher.get("@type") == "Organization":
            if publisher.get("@id") != ORG_ID:
                new_pub = {}
                for k, v in publisher.items():
                    new_pub[k] = v
                    if k == "@type":
                        new_pub["@id"] = ORG_ID
                publisher = new_pub
                changed[0] = True
            same_as = publisher.get("sameAs")
            if same_as is None:
                publisher["sameAs"] = [ORG_LINKEDIN]
                changed[0] = True
            elif isinstance(same_as, list) and ORG_LINKEDIN not in same_as:
                same_as.append(ORG_LINKEDIN)
                changed[0] = True
            node["publisher"] = publisher
    return node


def process_block(raw_json):
    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        return None, False
    changed = [False]
    if isinstance(data, dict):
        data = fix_article_node(data, changed)
    if not changed[0]:
        return None, False
    return json.dumps(data, indent=2, ensure_ascii=False), True


def patch_articles():
    for path in glob.glob(os.path.join(ROOT, "*.html")):
        name = os.path.basename(path)
        html = open(path, encoding="utf-8").read()
        original = html

        def _sub(m):
            new_json, changed = process_block(m.group(2))
            if not changed:
                return m.group(0)
            log.append(f"{name}: Article author -> Person(#founder), publisher -> #legalservice")
            return m.group(1) + new_json + m.group(3)

        html = LDJSON_RE.sub(_sub, html)
        if html != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)


PROFILE_PAGE_SCHEMA = f'''<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": "{WEBSITE_URL}people.html#profilepage",
  "url": "{WEBSITE_URL}people.html",
  "name": "{FOUNDER_NAME} | Founder & Advocate",
  "mainEntity": {{"@id": "{FOUNDER_ID}"}},
  "dateModified": "2026-07-21"
}}
</script>
'''


def add_profile_page_schema():
    path = os.path.join(ROOT, "people.html")
    html = open(path, encoding="utf-8").read()
    if '"@type": "ProfilePage"' in html:
        return
    marker = "</head>"
    assert marker in html
    html = html.replace(marker, PROFILE_PAGE_SCHEMA + marker, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    log.append("people.html: added ProfilePage schema (mainEntity -> #founder)")


if __name__ == "__main__":
    patch_articles()
    add_profile_page_schema()
    print("\n".join(log))
    print(f"\n{len(log)} changes applied.")
