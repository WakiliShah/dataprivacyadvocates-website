# Muchangi Patrick & Associates Advocates — v12 Deployment

## Included in this single deployment

1. Approved ODPC Complaint pathway and interactive intake page from v11.
2. Approved plum / warm-paper / brass visual palette retained and harmonised site-wide through the shared CSS variables.
3. Practice Areas page rebuilt as a problem-first, visitor-oriented page while preserving the five existing substantive practice areas and their supplied service content.
4. Practice Areas now includes the same five-item resource band used by the approved complaint page.
5. Practice Areas includes clear pathways for:
   - Data Protection & Privacy
   - GDPR & Cross-Border Compliance
   - Fintech & Startup Advisory
   - Board & Governance Advisory
   - AI Governance & Emerging Tech
   - Breach Response & Cybersecurity Readiness
6. Existing site assets, directories, architecture, PDFs and local links are preserved.
7. Stylesheet cache version advanced to `v7` so browsers do not retain the previous stylesheet.

## Practice Areas design intent

The page now begins with the visitor's problem rather than a list of legal service labels. It then maps each problem to the relevant practice area, explains what the work covers, and ends with a clear route to contact the firm or the ODPC complaint pathway.

## QA performed

- 123 HTML pages scanned.
- 0 missing local `href`, `src` or stylesheet/image/script references.
- Practice Areas: 6 problem pathways, 5 substantive service sections, 5 resource-band links.
- Practice Areas orphan content after `</html>` removed.
- Existing case-digest / publication assets remain in place.
- No new framework or package introduced.

## Deployment

Deploy the contents of the `muchangi-case-digest-integrated/` directory as the site root, exactly as supplied.
