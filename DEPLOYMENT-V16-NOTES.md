# V16 Deployment Notes

## Requested fixes implemented

1. Contact page replaced with the counsel-first Contact experience:
   - Book a consultation
   - WhatsApp the firm
   - Write to counsel
   - Tell us what is going on
   - We read / We respond / We advise process
   - Nairobi contact details and map
2. ODPC Registration pricing section:
   - Removed the explanatory paragraph immediately below "Choose your entity size".
   - Removed the enforcement and SACCO information bars between the hero and pricing section so pricing appears earlier.
   - Pricing cards now follow the heading immediately.
3. Retainer pricing section:
   - Removed the explanatory paragraph and scarcity note immediately below "Choose your retainer tier".
   - Removed the enforcement and SACCO information bars between the hero and pricing section so pricing appears earlier.
   - Pricing cards now follow the heading immediately.
4. Existing ODPC Complaint page, homepage, case digests, resources and other pages were not intentionally altered by this patch.

## QA performed

- Modified pages parse as valid HTML.
- Contact page local asset/reference audit: 0 missing local references.
- ODPC Registration local asset/reference audit: 0 missing local references.
- Retainer local asset/reference audit: 0 missing local references.
- Pricing heading has no intervening explanatory paragraph/scarcity block; the price grid is the next content block.
- Existing site-wide links/assets were preserved.

## Browser note

Chromium headless is available in the environment but timed out during local screenshot rendering, so no synthetic Chrome screenshot is claimed as visual proof.
