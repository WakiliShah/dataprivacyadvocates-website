#!/usr/bin/env python3
"""
Phase 3 of the entity-SEO rollout: adds BreadcrumbList, CollectionPage +
ItemList (for listing/hub pages), and lightweight WebPage schema to pages
that currently have none — using only breadcrumb trails, titles and links
that already exist visibly on each page (no invented labels or dates).

Deliberately skipped (and why):
  - book.html / book/index.html : client-side redirect utility stub, noindex
  - cookie-notice.html          : boilerplate legal notice, no unique entity
  - google*.html                : Search Console ownership-verification
                                  files; must stay byte-for-byte as issued
Idempotent: re-running is safe (checks for existing @type before adding).
"""
import re
import os
import json
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, "assets", "config", "site-social.json")))

ORG_ID = CFG["organization"]["id"]
ORG_NAME = CFG["organization"]["name"]
WEBSITE_ID = CFG["website"]["id"]
SITE = "https://dataprivacyadvocates.co.ke/"

log = []


def already_has(html, type_name):
    return f'"@type": "{type_name}"' in html or f'"@type":"{type_name}"' in html


def inject(path, blocks):
    html = open(path, encoding="utf-8").read()
    marker = "</head>"
    assert marker in html, path
    payload = "".join(
        f'<script type="application/ld+json">\n{json.dumps(b, indent=2, ensure_ascii=False)}\n</script>\n'
        for b in blocks
    )
    html = html.replace(marker, payload + marker, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)


def breadcrumb(trail, page_url):
    items = []
    for i, (name, url) in enumerate(trail, start=1):
        items.append({"@type": "ListItem", "position": i, "name": name, "item": url})
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": items,
    }


def webpage_node(url, name, description, image=None, breadcrumb_id=None):
    node = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "@id": url + "#webpage",
        "url": url,
        "name": name,
        "description": description,
        "isPartOf": {"@id": WEBSITE_ID},
    }
    if image:
        node["primaryImageOfPage"] = {"@type": "ImageObject", "url": image}
    if breadcrumb_id:
        node["breadcrumb"] = {"@id": breadcrumb_id}
    return node


def collection_page(url, name, description, items):
    """items: list of (name, url) real, on-page links."""
    return {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": url + "#collectionpage",
        "url": url,
        "name": name,
        "description": description,
        "isPartOf": {"@id": WEBSITE_ID},
        "mainEntity": {
            "@type": "ItemList",
            "itemListElement": [
                {"@type": "ListItem", "position": i, "name": n, "url": u}
                for i, (n, u) in enumerate(items, start=1)
            ],
        },
    }


def extract_meta(html, prop):
    m = re.search(rf'<meta (?:name|property)="{prop}" content="([^"]*)"', html)
    return m.group(1) if m else None


def extract_h3_links(html, prefix=""):
    raw = re.findall(r'<h3><a href="([^"]+)">([^<]+)</a></h3>', html)
    out = []
    for href, name in raw:
        name = re.sub(r"&amp;", "&", name).replace("&rsquo;", "\u2019").replace("&mdash;", "\u2014")
        url = href if href.startswith("http") else SITE + href.lstrip("/")
        out.append((name, url))
    return out


# ---------------------------------------------------------------------------
# 1. Small knowledge-centre hub pages: BreadcrumbList + CollectionPage/ItemList
# ---------------------------------------------------------------------------
KC_HUBS = {
    "academy.html": ("KPLR Academy", [("Home", SITE), ("Knowledge Centre", SITE + "resources/practice-notes/"), ("KPLR Academy", SITE + "academy.html")]),
    "bills-review.html": ("Bills Review", [("Home", SITE), ("Knowledge Centre", SITE + "resources/practice-notes/"), ("Bills Review", SITE + "bills-review.html")]),
    "comparative-law.html": ("Comparative Law", [("Home", SITE), ("Knowledge Centre", SITE + "resources/practice-notes/"), ("Comparative Law", SITE + "comparative-law.html")]),
    "compliance-toolkit.html": ("Compliance Toolkit", [("Home", SITE), ("Knowledge Centre", SITE + "resources/practice-notes/"), ("Compliance Toolkit", SITE + "compliance-toolkit.html")]),
    "regulatory-analysis.html": ("Regulatory Analysis", [("Home", SITE), ("Knowledge Centre", SITE + "resources/practice-notes/"), ("Regulatory Analysis", SITE + "regulatory-analysis.html")]),
}

for fname, (label, trail) in KC_HUBS.items():
    path = os.path.join(ROOT, fname)
    html = open(path, encoding="utf-8").read()
    if already_has(html, "BreadcrumbList"):
        continue
    url = SITE + fname
    description = extract_meta(html, "description") or label
    items = extract_h3_links(html)
    blocks = [breadcrumb(trail, url)]
    if items:
        blocks.append(collection_page(url, label, description, items))
    inject(path, blocks)
    log.append(f"{fname}: BreadcrumbList" + (" + CollectionPage/ItemList" if items else ""))

# insights.html: crumb is Home > Legal Insights (no Knowledge Centre hop, per its own visible crumb)
path = os.path.join(ROOT, "insights.html")
html = open(path, encoding="utf-8").read()
if not already_has(html, "BreadcrumbList"):
    url = SITE + "insights.html"
    description = extract_meta(html, "description") or "Legal Insights"
    items = extract_h3_links(html)
    trail = [("Home", SITE), ("Legal Insights", url)]
    blocks = [breadcrumb(trail, url), collection_page(url, "Legal Insights", description, items)]
    inject(path, blocks)
    log.append("insights.html: BreadcrumbList + CollectionPage/ItemList")

# ---------------------------------------------------------------------------
# 2. Standalone pages needing BreadcrumbList (+ WebPage where nothing exists)
# ---------------------------------------------------------------------------
STANDALONE = {
    "contact.html": ("Contact", [("Home", SITE), ("Contact", SITE + "contact.html")]),
    "expertise.html": ("Solutions", [("Home", SITE), ("Solutions", SITE + "expertise.html")]),
}
for fname, (label, trail) in STANDALONE.items():
    path = os.path.join(ROOT, fname)
    html = open(path, encoding="utf-8").read()
    if already_has(html, "BreadcrumbList"):
        continue
    url = SITE + fname
    description = extract_meta(html, "description") or label
    image = extract_meta(html, "og:image")
    blocks = [breadcrumb(trail, url)]
    if not already_has(html, "WebPage"):
        blocks.append(webpage_node(url, label, description, image, url + "#breadcrumb"))
    inject(path, blocks)
    log.append(f"{fname}: BreadcrumbList" + (" + WebPage" if not already_has(html, 'WebPage') else ""))

# resource-guidelines page: already has CreativeWork, just add a minimal breadcrumb
path = os.path.join(ROOT, "resource-guidelines-dpo-framework.html")
html = open(path, encoding="utf-8").read()
if not already_has(html, "BreadcrumbList"):
    url = SITE + "resource-guidelines-dpo-framework.html"
    trail = [("Home", SITE), ("Draft Guidelines on Data Protection Officers", url)]
    inject(path, [breadcrumb(trail, url)])
    log.append("resource-guidelines-dpo-framework.html: BreadcrumbList")

# sector-*.html: mirror each page's own visible "Who We Serve" crumb
SECTOR_LABELS = {
    "sector-corporate.html": "Corporate",
    "sector-education.html": "Education",
    "sector-financial-services.html": "Financial Services",
    "sector-healthcare.html": "Healthcare",
    "sector-public-sector.html": "Public Sector",
    "sector-technology.html": "Technology",
}
for fname, label in SECTOR_LABELS.items():
    path = os.path.join(ROOT, fname)
    html = open(path, encoding="utf-8").read()
    if already_has(html, "BreadcrumbList"):
        continue
    url = SITE + fname
    trail = [("Home", SITE), ("Who We Serve", SITE + "index.html#who-we-serve"), (label, url)]
    inject(path, [breadcrumb(trail, url)])
    log.append(f"{fname}: BreadcrumbList")

# ---------------------------------------------------------------------------
# 3. Homepage: add a minimal WebPage node alongside the existing LegalService
#    + WebSite nodes (homepage doesn't need a breadcrumb — it's the root)
# ---------------------------------------------------------------------------
path = os.path.join(ROOT, "index.html")
html = open(path, encoding="utf-8").read()
if not already_has(html, '"WebPage"'):
    description = extract_meta(html, "description") or ORG_NAME
    image = extract_meta(html, "og:image")
    node = webpage_node(SITE, ORG_NAME, description, image)
    node["about"] = {"@id": ORG_ID}
    inject(path, [node])
    log.append("index.html: WebPage")

print("\n".join(log))
print(f"\n{len(log)} pages updated.")
