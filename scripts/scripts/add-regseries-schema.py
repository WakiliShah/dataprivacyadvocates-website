#!/usr/bin/env python3
"""
Adds the Article + BreadcrumbList JSON-LD that the reg-series-* pages are
currently missing entirely (0 ld+json blocks found in the Part-2 audit).

Pulls headline/description/image straight from each page's own existing
<title>/<meta name="description">/<meta property="og:image"> tags rather
than inventing new copy. Does NOT set "datePublished" — these pages carry no
publication date anywhere on the page, in the sitemap, or in an index.json
(unlike resources/practice-notes/), and fabricating one would violate the
no-fabrication rule. Recommendation: add a real datePublished once the firm
confirms it, and re-run.
"""
import re
import os
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(ROOT, "assets", "config", "site-social.json")
CFG = json.load(open(CONFIG_PATH))

ORG_ID = CFG["organization"]["id"]
ORG_NAME = CFG["organization"]["name"]
ORG_LINKEDIN = CFG["organization"]["linkedinCompanyUrl"]
FOUNDER_ID = CFG["founder"]["id"]
FOUNDER_NAME = CFG["founder"]["name"]
FOUNDER_LINKEDIN = CFG["founder"]["linkedinPersonalUrl"]
SITE = "https://dataprivacyadvocates.co.ke/"
LOGO_URL = SITE + "images/logo-schema.png"

PAGES = [
    "reg-series-001-digital-trust-governance.html",
    "reg-series-002-cybersecurity-governance.html",
    "reg-series-003-ai-oversight.html",
    "reg-series-004-cross-border-data-governance.html",
    "reg-series-005-breach-response-readiness.html",
]

log = []


def extract(html, pattern):
    m = re.search(pattern, html)
    return m.group(1) if m else None


def build_schema(path):
    html = open(path, encoding="utf-8").read()
    if '"@type": "Article"' in html or '"@type":"Article"' in html:
        return None  # already done, idempotent

    title = extract(html, r"<title>(.*?)</title>")
    headline = title.split(" | ")[0] if title else ""
    description = extract(html, r'<meta name="description" content="([^"]*)"')
    image = extract(html, r'<meta property="og:image" content="([^"]*)"')
    canonical = extract(html, r'<link rel="canonical" href="([^"]*)"')

    article = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": headline,
        "description": description,
        "image": image,
        "author": {
            "@type": "Person",
            "@id": FOUNDER_ID,
            "name": FOUNDER_NAME,
            "jobTitle": "Founder & Advocate",
            "sameAs": [FOUNDER_LINKEDIN],
        },
        "publisher": {
            "@type": "Organization",
            "@id": ORG_ID,
            "name": ORG_NAME,
            "logo": {"@type": "ImageObject", "url": LOGO_URL, "width": 512, "height": 512},
            "sameAs": [ORG_LINKEDIN],
        },
        "mainEntityOfPage": {"@type": "WebPage", "@id": canonical},
    }

    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE},
            {"@type": "ListItem", "position": 2, "name": "Regulatory Analysis", "item": SITE + "regulatory-analysis.html"},
            {"@type": "ListItem", "position": 3, "name": headline, "item": canonical},
        ],
    }

    block = (
        '<script type="application/ld+json">\n'
        + json.dumps(article, indent=2, ensure_ascii=False)
        + "\n</script>\n"
        '<script type="application/ld+json">\n'
        + json.dumps(breadcrumb, indent=2, ensure_ascii=False)
        + "\n</script>\n"
    )
    return html.replace("</head>", block + "</head>", 1)


for name in PAGES:
    path = os.path.join(ROOT, name)
    new_html = build_schema(path)
    if new_html is None:
        continue
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_html)
    log.append(f"{name}: added Article + BreadcrumbList schema")

print("\n".join(log))
print(f"\n{len(log)} files updated.")
