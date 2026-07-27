/**
 * PART 12 — Privacy configuration (single source of truth).
 *
 * Every other privacy/consent/retention/ROPA module reads from this file.
 * To change a retention period, consent wording version, or the DPO contact,
 * edit this file only — nothing else in netlify/functions needs to change.
 *
 * NOTE ON STATUTORY CITATIONS: this file deliberately does NOT cite specific
 * section numbers of the Data Protection Act, 2019 or the Data Protection
 * (General) Regulations, 2021. Section references should be added by you
 * (or verified against the current Act/Regulations text) rather than
 * generated here — getting a citation wrong in code is worse than leaving
 * it for a lawyer to fill in correctly.
 *
 * NOTE ON THE CLIENT-FACING PRIVACY NOTICE TEXT shown on the newsletter and
 * webinar forms (see scripts/apply-privacy-notice.py): that text is
 * necessarily duplicated into static HTML at build time because this is a
 * static site with no server-side templating. The retention/purpose/lawful
 * basis *values* below are the source of truth; the notice text mirrors
 * them by hand. If you change retention periods or purposes here, update
 * the notice text in scripts/apply-privacy-notice.py and re-run it.
 */

export const PRIVACY_CONFIG = {
  privacyPolicyVersion: "2026.1",
  privacyPolicyUrl: "https://dataprivacyadvocates.co.ke/privacy-policy.html",
  consentVersion: "2026.1",

  firm: {
    name: "Muchangi Patrick & Associates Advocates",
    contactEmail: "consult@dataprivacyadvocates.co.ke",
    phone: "+254722878607",
    address: "Pinetree Plaza, 8th Floor, Kaburu Drive, off Ngong Road, Nairobi, Kenya",
  },

  dpo: {
    // TODO(Patrick): confirm whether the DPO contact should differ from the
    // general consult@ inbox for formal DSR/complaint correspondence.
    name: "Patrick Muchangi",
    email: "consult@dataprivacyadvocates.co.ke",
  },

  processingSystem: "dataprivacyadvocates.co.ke (Netlify Functions + Netlify Blobs)",

  transfers: {
    storageLocation: "Netlify Blobs — underlying region determined by Netlify account configuration",
    emailProviderRegion: "Zoho Mail — region determined by ZOHO_SMTP_HOST (defaults to smtp.zoho.com)",
    internationalTransfersOccur: true,
    note:
      "Submission data is stored via Netlify Blobs and transmitted via Zoho Mail SMTP. Both providers " +
      "may process data outside Kenya depending on account/region configuration. This flag and note are " +
      "system metadata only — they do not constitute a transfer impact assessment. Confirm actual hosting " +
      "regions against each provider's current infrastructure documentation before relying on this for one.",
  },

  // ---- Retention -----------------------------------------------------
  retention: {
    newsletter: { policyId: "retain_until_unsubscribe", days: null as number | null },
    webinar: { policyId: "retain_12_months", days: 365 },
    dsr_request: { policyId: "retain_24_months", days: 730 },
    failed_submission: { policyId: "retain_30_days", days: 30 },
    log: { policyId: "retain_90_days", days: 90 },
  },

  // ---- Lawful basis per processing activity ---------------------------
  lawfulBases: {
    newsletter: "consent",
    webinar_registration: "contract", // necessary to perform the registration the data subject requested
    webinar_marketing: "consent",
    dsr_request: "legal_obligation", // responding to a data subject rights request
  },

  purposes: {
    newsletter:
      "To send the Kenya Privacy Law Review monthly briefing and related legal updates to subscribers who have opted in.",
    webinar_registration:
      "To register the data subject for the specified webinar and provide access, the recording, and materials.",
    webinar_marketing:
      "To send future legal updates and newsletters to webinar registrants who separately opted in.",
    dsr_request: "To receive, verify, and action a data subject rights request.",
  },

  dataCategories: {
    newsletter: ["email address", "name (optional)"],
    webinar: ["name", "email address", "organisation", "position/role"],
    dsr_request: ["email address", "request type", "request details"],
  },

  recipients: {
    newsletter: [
      "Muchangi Patrick & Associates Advocates (data controller)",
      "Zoho Mail (email processor)",
      "Netlify (hosting/storage processor)",
    ],
    webinar: [
      "Muchangi Patrick & Associates Advocates (data controller)",
      "Zoho Mail (email processor)",
      "Netlify (hosting/storage processor)",
    ],
    dsr_request: ["Muchangi Patrick & Associates Advocates (data controller)"],
  },

  dataSubjects: {
    newsletter: "Website visitors who opt in to receive legal updates.",
    webinar: "Individuals registering for a firm-hosted webinar or executive briefing.",
    dsr_request: "Any individual exercising a data subject right in respect of data the firm holds about them.",
  },

  securityMeasures: [
    "TLS in transit",
    "Server-side validation, length limits, and input sanitisation",
    "Honeypot field and minimum-time-to-submit spam checks",
    "Origin-header verification on state-changing requests",
    "IP-based rate limiting on public form endpoints",
    "Secrets held exclusively in Netlify environment variables, never in source code",
    "Storage scoped to the site via Netlify Blobs (not publicly listable/readable)",
    "Immutable audit-trail metadata attached to every submission",
  ],
} as const;

export type ProcessingActivity = keyof typeof PRIVACY_CONFIG.lawfulBases;
