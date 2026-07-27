/**
 * KPLR / Muchangi Patrick & Associates Advocates — reusable email layer.
 *
 * This is template "00 — Master Shell" from the Client Communication &
 * Automation Standard: one branded HTML wrapper every other template is
 * built inside. Add new templates by writing a `build<Name>Email()`
 * function that calls `renderShell()` and registering it in
 * `renderAcknowledgementEmail()` / `FORM_TYPE_CONFIG` below — the shell,
 * validation wiring, and send pipeline never need to change.
 *
 * Implemented so far (per the audit's recommended build order):
 *   - 07/08  Newsletter Welcome / Confirmation  -> form_type: "newsletter"
 *   - 04     Webinar Registration Confirmation  -> form_type: "webinar"
 *
 * Not yet wired to a live form (still on Formspree — migrate in a later
 * pass): 03 Consultation Confirmation, 09 General Enquiry, 18 Feedback
 * Request, 02 Resource Download.
 */

import { PRIVACY_CONFIG } from "./privacy-config.mts";

// ---- Brand tokens (mirrored from styles.css :root — keep in sync) --------
const COLORS = {
  ink: "#17101a",
  navy: "#3f2b3d", // firm's core dark identity colour (labelled --navy/--plum in styles.css)
  slate: "#5c4a54",
  muted: "#85727c",
  paper: "#f7f6f2",
  paperAlt: "#eeece4",
  white: "#ffffff",
  brassLight: "#ecc981",
  cta: "#8b6932", // accessible brass — text/button colour on light backgrounds
  ctaHover: "#6d5327",
  line: "#e3e0d6",
  success: "#1e6b4f",
};

const FONT_DISPLAY = "Georgia, 'Times New Roman', serif"; // email-safe stand-in for Fraunces
const FONT_BODY = "Arial, Helvetica, sans-serif"; // email-safe stand-in for Inter

interface ShellOptions {
  siteUrl: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  bodyHtml: string; // inner content, already-safe HTML (paragraphs, lists, buttons)
  ctaLabel?: string;
  ctaUrl?: string;
  /** PART 7: plain-language reason this specific person is receiving this
   * specific email. Required — there is no shell-level default because a
   * generic reason is exactly the "deceptive wording" the spec prohibits. */
  reasonForReceiving: string;
  /** PART 7: newsletter-only. Omit entirely for transactional/contract-basis
   * emails (webinar confirmation, internal notifications) — an unsubscribe
   * link on a non-marketing email is itself misleading about what it does. */
  unsubscribeUrl?: string;
}

/** The one branded layout every outbound email is rendered inside. */
export function renderShell(opts: ShellOptions): string {
  const { siteUrl, preheader, eyebrow, heading, bodyHtml, ctaLabel, ctaUrl, reasonForReceiving, unsubscribeUrl } = opts;
  const logoUrl = `${siteUrl}/images/logo-schema.png`;
  const year = new Date().getFullYear();

  const ctaBlock = ctaLabel && ctaUrl
    ? `
    <tr>
      <td style="padding:8px 0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td bgcolor="${COLORS.cta}" style="border-radius:4px;">
              <a href="${ctaUrl}" target="_blank"
                 style="display:inline-block;padding:14px 28px;font-family:${FONT_BODY};font-size:14px;
                        font-weight:bold;color:${COLORS.white};text-decoration:none;letter-spacing:.3px;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${heading}</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${COLORS.paperAlt};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.paperAlt};">
<tr>
<td align="center" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
         style="width:600px;max-width:100%;background-color:${COLORS.white};border-radius:4px;overflow:hidden;">

    <!-- Header -->
    <tr>
      <td align="center" bgcolor="${COLORS.ink}" style="padding:28px 32px;">
        <img src="${logoUrl}" width="180" alt="Muchangi Patrick & Associates Advocates"
             style="display:block;border:0;max-width:180px;height:auto;" />
      </td>
    </tr>

    <!-- Brass rule -->
    <tr><td bgcolor="${COLORS.cta}" style="line-height:3px;font-size:3px;">&nbsp;</td></tr>

    <!-- Body -->
    <tr>
      <td style="padding:40px 40px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:${FONT_BODY};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;
                       color:${COLORS.cta};font-weight:bold;padding-bottom:10px;">
              ${eyebrow}
            </td>
          </tr>
          <tr>
            <td style="font-family:${FONT_DISPLAY};font-size:24px;line-height:1.3;color:${COLORS.ink};
                       font-weight:normal;padding-bottom:18px;">
              ${heading}
            </td>
          </tr>
          <tr>
            <td style="font-family:${FONT_BODY};font-size:15px;line-height:1.6;color:${COLORS.slate};">
              ${bodyHtml}
            </td>
          </tr>
          ${ctaBlock}
        </table>
      </td>
    </tr>

    <tr><td style="padding:24px 40px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td bgcolor="${COLORS.line}" style="line-height:1px;font-size:1px;">&nbsp;</td></tr>
    </table></td></tr>

    <!-- Footer -->
    <tr>
      <td style="padding:24px 40px 36px;font-family:${FONT_BODY};font-size:12px;line-height:1.7;color:${COLORS.muted};">
        <strong style="color:${COLORS.slate};">Muchangi Patrick &amp; Associates Advocates</strong><br/>
        Pinetree Plaza, 8th Floor, Kaburu Drive, off Ngong Road, Nairobi, Kenya<br/>
        <a href="tel:+254722878607" style="color:${COLORS.muted};text-decoration:underline;">0722 878 607</a>
        &nbsp;&middot;&nbsp;
        <a href="mailto:consult@dataprivacyadvocates.co.ke" style="color:${COLORS.muted};text-decoration:underline;">consult@dataprivacyadvocates.co.ke</a>
        <br/><br/>
        <em>Why you're receiving this:</em> ${reasonForReceiving}
        <br/>
        Reading or receiving this email does not create an advocate-client relationship.
        <br/><br/>
        <a href="${PRIVACY_CONFIG.privacyPolicyUrl}" style="color:${COLORS.muted};text-decoration:underline;">Privacy Policy</a>
        ${unsubscribeUrl ? `&nbsp;&middot;&nbsp; <a href="${unsubscribeUrl}" style="color:${COLORS.muted};text-decoration:underline;">Unsubscribe</a>` : ""}
        &nbsp;&middot;&nbsp; &copy; ${year} Muchangi Patrick &amp; Associates Advocates
      </td>
    </tr>
  </table>

</td>
</tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Per-form-type configuration: required fields + analytics event name.
// Extend this object (and add a matching build*Email function below) as
// each additional form type migrates onto this endpoint.
// ---------------------------------------------------------------------------
export const FORM_TYPE_CONFIG: Record<
  string,
  { requiredFields: string[]; analyticsEvent: string }
> = {
  newsletter: { requiredFields: ["email"], analyticsEvent: "newsletter_signup" },
  webinar: {
    requiredFields: ["name", "email", "organisation"],
    analyticsEvent: "webinar_register_submit",
  },
};

type Fields = Record<string, string>;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Acknowledgement emails (sent to the visitor)
// ---------------------------------------------------------------------------

function buildNewsletterConfirmationEmail(fields: Fields, siteUrl: string, unsubscribeToken: string) {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Thank you for subscribing to the Kenya Privacy Law Review (KPLR) briefing.</p>
    <p style="margin:0 0 16px;">Once a month, you'll get a short, practitioner-written update covering new
    ODPC determinations, guidance notes, and compliance deadlines relevant to Kenya's Data Protection
    Act 2019 &mdash; no spam, unsubscribe anytime.</p>
    <p style="margin:0;">In the meantime, you're welcome to browse the
    <a href="${siteUrl}/resources/practice-notes/" style="color:${COLORS.cta};">Practice Note library</a>
    or get in touch if a specific compliance question is on your mind.</p>`;

  return {
    subject: "You're subscribed — Kenya Privacy Law Review",
    bodyHtml: renderShell({
      siteUrl,
      preheader: "You're on the list for the KPLR monthly briefing.",
      eyebrow: "Kenya Privacy Law Review",
      heading: "You're subscribed.",
      bodyHtml,
      ctaLabel: "Read the latest Practice Notes",
      ctaUrl: `${siteUrl}/resources/practice-notes/`,
      reasonForReceiving:
        "you gave explicit consent to receive the KPLR newsletter on " + siteUrl.replace(/^https?:\/\//, "") + ".",
      unsubscribeUrl: `${siteUrl}/api/unsubscribe?token=${unsubscribeToken}`,
    }),
  };
}

function buildWebinarConfirmationEmail(fields: Fields, siteUrl: string) {
  const webinarName = escapeHtml(fields.webinar || "the upcoming KPLR briefing");
  const firstName = escapeHtml((fields.name || "").split(" ")[0] || "there");
  const marketingOptIn = fields.marketing_consent === "true";

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${firstName},</p>
    <p style="margin:0 0 16px;">You're registered for <strong>${webinarName}</strong>. The Zoom link
    will land in your inbox ahead of the session, and we'll send the recording and slides to everyone
    who registered &mdash; whether or not you can attend live.</p>
    <p style="margin:0;">If your organisation's details change before then, just reply to this email
    and we'll update your registration.</p>
    ${marketingOptIn
      ? `<p style="margin:16px 0 0;">You also asked to receive future legal updates and newsletters &mdash;
         we'll include you in those separately from this registration.</p>`
      : ""}`;

  return {
    subject: `You're registered — ${fields.webinar || "KPLR Briefing"}`,
    bodyHtml: renderShell({
      siteUrl,
      preheader: `You're registered for ${webinarName}.`,
      eyebrow: "Registration Confirmed",
      heading: "You're registered.",
      bodyHtml,
      reasonForReceiving: "you registered for this webinar; this confirmation is necessary to provide the session you requested.",
      // No unsubscribeUrl: this is a contract-basis transactional email, not
      // a marketing send — see PRIVACY_CONFIG.lawfulBases.webinar_registration.
    }),
  };
}

/** Dispatches to the right acknowledgement template for a given form_type. */
export function renderAcknowledgementEmail(
  formType: string,
  fields: Fields,
  siteUrl: string,
  unsubscribeToken?: string
): { subject: string; bodyHtml: string } | null {
  switch (formType) {
    case "newsletter":
      return buildNewsletterConfirmationEmail(fields, siteUrl, unsubscribeToken || "");
    case "webinar":
      return buildWebinarConfirmationEmail(fields, siteUrl);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Internal notification email (sent to the firm, one shared layout for all
// form types so a new lead never needs a bespoke internal template).
// ---------------------------------------------------------------------------
export function renderInternalNotificationEmail(opts: {
  formType: string;
  fields: Fields;
  pagePath: string;
  audit?: {
    submission_id: string;
    lawful_basis: string;
    consent_status: string;
    retention_until: string | null;
    retention_policy: string;
  };
}): { subject: string; bodyHtml: string } {
  const { formType, fields, pagePath, audit } = opts;
  const rows = Object.entries(fields)
    .filter(([key]) => key !== "bot-field" && key !== "form_type" && key !== "rendered_at")
    .map(
      ([key, value]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;font-family:${FONT_BODY};font-size:13px;color:${COLORS.muted};
                   font-weight:bold;white-space:nowrap;vertical-align:top;">${escapeHtml(key)}</td>
        <td style="padding:6px 0;font-family:${FONT_BODY};font-size:13px;color:${COLORS.ink};">${escapeHtml(value)}</td>
      </tr>`
    )
    .join("");

  const auditHtml = audit
    ? `
    <p style="margin:20px 0 6px;font-family:${FONT_BODY};font-size:11px;text-transform:uppercase;
              letter-spacing:1px;color:${COLORS.muted};">Audit trail (PART 10)</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:2px 12px 2px 0;font-family:${FONT_BODY};font-size:12px;color:${COLORS.muted};white-space:nowrap;">submission_id</td><td style="font-family:${FONT_BODY};font-size:12px;color:${COLORS.ink};">${escapeHtml(audit.submission_id)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;font-family:${FONT_BODY};font-size:12px;color:${COLORS.muted};white-space:nowrap;">lawful_basis</td><td style="font-family:${FONT_BODY};font-size:12px;color:${COLORS.ink};">${escapeHtml(audit.lawful_basis)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;font-family:${FONT_BODY};font-size:12px;color:${COLORS.muted};white-space:nowrap;">consent_status</td><td style="font-family:${FONT_BODY};font-size:12px;color:${COLORS.ink};">${escapeHtml(audit.consent_status)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;font-family:${FONT_BODY};font-size:12px;color:${COLORS.muted};white-space:nowrap;">retention_policy</td><td style="font-family:${FONT_BODY};font-size:12px;color:${COLORS.ink};">${escapeHtml(audit.retention_policy)}</td></tr>
      <tr><td style="padding:2px 12px 2px 0;font-family:${FONT_BODY};font-size:12px;color:${COLORS.muted};white-space:nowrap;">retention_until</td><td style="font-family:${FONT_BODY};font-size:12px;color:${COLORS.ink};">${escapeHtml(audit.retention_until || "until unsubscribe")}</td></tr>
    </table>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 16px;">New <strong>${escapeHtml(formType)}</strong> submission from
    <code>${escapeHtml(pagePath || "unknown page")}</code>.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-top:1px solid ${COLORS.line};margin-top:8px;">
      ${rows}
    </table>
    ${auditHtml}`;

  return {
    subject: `[KPLR Website] New ${formType} submission`,
    bodyHtml: renderShell({
      siteUrl: "https://dataprivacyadvocates.co.ke",
      preheader: `New ${formType} submission`,
      eyebrow: "Internal Notification",
      heading: "New form submission",
      bodyHtml,
      reasonForReceiving: "you are the configured recipient (INTERNAL_NOTIFY_EMAIL) for submissions on the firm's website.",
    }),
  };
}
