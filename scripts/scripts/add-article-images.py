#!/usr/bin/env python3
"""
Adds the missing recommended Article.image property, sourced from each
page's own existing og:image meta tag (no new images invented).
Idempotent.
"""
import re
import os
import json
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LDJSON_RE = re.compile(r'(<script type="application/ld\+json">\s*\n?)(.*?)(\n?\s*</script>)', re.DOTALL)

log = []

for path in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
    name = os.path.basename(path)
    html = open(path, encoding="utf-8").read()
    m = re.search(r'<meta property="og:image" content="([^"]*)"', html)
    if not m:
        continue
    og_image = m.group(1)
    original = html

    def _sub(block_match):
        raw = block_match.group(2)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return block_match.group(0)
        if not isinstance(data, dict) or data.get("@type") != "Article":
            return block_match.group(0)
        if data.get("image"):
            return block_match.group(0)
        data["image"] = og_image
        # keep key order sensible: reinsert after description if present
        log.append(f"{name}: Article.image added ({og_image.split('/')[-1]})")
        return block_match.group(1) + json.dumps(data, indent=2, ensure_ascii=False) + block_match.group(3)

    html = LDJSON_RE.sub(_sub, html)
    if html != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

print("\n".join(log))
print(f"\n{len(log)} files updated.")
