/**
 * Unified form-submission handler — now privacy-by-design per the Client
 * Communication & Automation Standard AND the Kenya Data Protection Act,
 * 2019 / Data Protection (General) Regulations, 2021 compliance build.
 *
 * Pipeline: Validate -> Verify origin/rate-limit/spam -> Capture consent
 * -> Save (with retention + audit metadata) -> Notify (internal) ->
 * Acknowledge (visitor email, with Privacy Policy link + unsubscribe
 * where applicable) -> Track -> Queue future automation.
 *
 * form_type: "newsletter"
 *   Lawful basis: consent. The `consent` checkbox is REQUIRED server-side
 *   (not just via the HTML `required` attribute, which is trivially
 *   bypassed) — a submission without explicit consent is rejected, not
 *   silently accepted. See PRIVACY_CONFIG.lawfulBases.newsletter.
 *
 * form_type: "webinar"
 *   Registration itself is contract-basis (necessary to provide the
 *   webinar the visitor asked for) and does NOT require the marketing
 *   checkbox. `marketing_consent` is a separate, optional, unchecked-by-
 *   default opt-in stored independently — see PRIVACY_CONFIG.lawfulBases.
 *   webinar_marketing and the audit record's `marketing_consent` block.
 *
 * Required environment variables — see FORM-PIPELINE-SETUP.md.
 */
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import {
  FORM_TYPE_CONFIG,
  renderAcknowledgementEmail,
  renderInternalNotificationEmail,
} from "./lib/email-templates.mts";
import { PRIVACY_CONFIG } from "./lib/privacy-config.mts";
import { buildAuditRecord } from "./lib/audit.mts";
import { getMailer, getFromEmail, getInternalNotifyEmail, getSiteUrl } from "./lib/mailer.mts";
import {
  verifyOrigin,
  getClientIp,
  checkRateLimit,
  sanitizeFields,
  isValidEmail,
  passesTimeTrap,
  SECURE_JSON_HEADERS,
} from "./lib/security.mts";

const FIELD_MAX_LENGTHS: Record<string, number> = {
  email: 254,
  name: 200,
  organisation: 200,
  role: 100,
  webinar: 200,
  form_type: 40,
  consent: 10,
  marketing_consent: 10,
  "bot-field": 200,
  rendered_at: 20,
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: SECURE_JSON_HEADERS });
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  // ---- PART 8: Origin verification (CSRF-equivalent for anonymous forms) --
  if (!verifyOrigin(req)) {
    return jsonResponse({ ok: false, error: "invalid_origin" }, 403);
  }

  // ---- Parse ---------------------------------------------------------
  let rawFields: Record<string, string> = {};
  try {
    const formData = await req.formData();
    for (const [key, value] of formData.entries()) {
      rawFields[key] = typeof value === "string" ? value : "";
    }
  } catch (err) {
    console.error("form-submit: failed to parse body", err);
    return jsonResponse({ ok: false, error: "invalid_body" }, 400);
  }

  // ---- PART 8: sanitise before anything else touches the values -------
  const fields = sanitizeFields(rawFields, FIELD_MAX_LENGTHS);

  // Honeypot — pretend success so bots don't learn they were caught.
  if (fields["bot-field"]) {
    return jsonResponse({ ok: true, event: null }, 200);
  }
  // Minimum-time-to-submit spam check.
  if (!passesTimeTrap(fields["rendered_at"])) {
    return jsonResponse({ ok: true, event: null }, 200); // fail closed silently, same as honeypot
  }

  const formType = fields["form_type"];
  const formConfig = formType ? FORM_TYPE_CONFIG[formType] : undefined;
  if (!formConfig) {
    return jsonResponse({ ok: false, error: "unknown_form_type" }, 400);
  }

  const ip = getClientIp(req);

  // ---- PART 8: rate limit (5 submissions / 10 min / IP / form type) ---
  const rateLimit = await checkRateLimit(ip, `form-submit:${formType}`, { maxRequests: 5, windowSeconds: 600 });
  if (!rateLimit.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }

  // ---- Validate --------------------------------------------------------
  for (const requiredField of formConfig.requiredFields) {
    if (!fields[requiredField]) {
      return jsonResponse({ ok: false, error: `missing_field:${requiredField}` }, 400);
    }
  }
  if (fields.email && !isValidEmail(fields.email)) {
    return jsonResponse({ ok: false, error: "invalid_email" }, 400);
  }

  // ---- PART 2: newsletter consent is REQUIRED, checked server-side ----
  // (the checkbox also carries `required` in the HTML, but that is
  // trivially bypassed — see FORM-AUDIT PART 3.3 — so it is re-checked here.)
  if (formType === "newsletter" && fields["consent"] !== "true") {
    return jsonResponse({ ok: false, error: "consent_required" }, 400);
  }

  const now = new Date();
  const userAgent = req.headers.get("user-agent") || "";
  const pagePath = fields["page_path"] || req.headers.get("referer") || "";

  // ---- PART 2/3: consent block(s) --------------------------------------
  const consentBlock =
    formType === "newsletter"
      ? {
          consent_given: true, // enforced above — a false/missing value already returned 400
          consent_timestamp: now.toISOString(),
          consent_version: PRIVACY_CONFIG.consentVersion,
          ip_address: ip,
          user_agent: userAgent,
        }
      : null; // webinar *registration* is contract-basis, not consent-basis — see header comment

  // PART 3: webinar marketing consent, recorded separately, never required.
  const marketingConsentBlock =
    formType === "webinar"
      ? {
          given: fields["marketing_consent"] === "true",
          consent_timestamp: fields["marketing_consent"] === "true" ? now.toISOString() : null,
          consent_version: PRIVACY_CONFIG.consentVersion,
          ip_address: ip,
          user_agent: userAgent,
        }
      : undefined;

  // ---- PART 5/10: retention + audit trail ------------------------------
  const activity = formType === "newsletter" ? "newsletter" : "webinar_registration";
  const retentionDays = formType === "newsletter" ? null : PRIVACY_CONFIG.retention.webinar.days;
  const audit = buildAuditRecord({
    activity,
    consentGiven: formType === "newsletter" ? true : null,
    retentionDays,
    now,
  });

  // Strip consent fields out of the generic `fields` bag before storing —
  // they live in their own typed blocks above instead.
  const { consent: _c, marketing_consent: _mc, "bot-field": _bf, rendered_at: _ra, ...visibleFields } = fields;

  const submission = {
    form_type: formType,
    fields: visibleFields,
    consent: consentBlock,
    marketing_consent: marketingConsentBlock,
    audit,
    page_path: pagePath,
    submitted_at: now.toISOString(),
    user_agent: userAgent,
  };

  // ---- Save (system of record) + Log, keyed for retention cleanup -----
  let unsubscribeToken = "";
  try {
    const store = getStore("form-submissions");
    const key = `${formType}/${audit.submission_id}`;
    await store.setJSON(key, submission);

    if (formType === "newsletter") {
      unsubscribeToken = crypto.randomUUID();
      const tokenStore = getStore("unsubscribe-tokens");
      await tokenStore.setJSON(unsubscribeToken, { submissionKey: key, email: fields.email });
    }
  } catch (err) {
    console.error("form-submit: blob save failed", err);
  }

  // ---- Notify (internal) + Acknowledge (visitor email) -----------------
  const siteUrl = getSiteUrl();
  const fromEmail = getFromEmail();
  const internalTo = getInternalNotifyEmail();
  const mailer = getMailer();

  let emailSent = false;
  if (mailer) {
    try {
      const internal = renderInternalNotificationEmail({
        formType,
        fields: visibleFields,
        pagePath,
        audit: {
          submission_id: audit.submission_id,
          lawful_basis: audit.lawful_basis,
          consent_status: audit.consent_status,
          retention_until: audit.retention_until,
          retention_policy: audit.retention_policy,
        },
      });
      await mailer.sendMail({
        from: `"KPLR Website" <${fromEmail}>`,
        to: internalTo,
        subject: internal.subject,
        html: internal.bodyHtml,
      });

      if (fields.email) {
        const ack = renderAcknowledgementEmail(formType, visibleFields, siteUrl, unsubscribeToken);
        if (ack) {
          await mailer.sendMail({
            from: `"Muchangi Patrick & Associates Advocates" <${fromEmail}>`,
            to: fields.email,
            subject: ack.subject,
            html: ack.bodyHtml,
          });
        }
      }
      emailSent = true;
    } catch (err) {
      console.error("form-submit: email send failed", err);
    }
  } else {
    console.warn("form-submit: ZOHO_SMTP_USER/PASS not set — skipping email send.");
  }

  // ---- Queue future automation (non-blocking) ---------------------------
  const webhookUrl = Netlify.env.get("AUTOMATION_WEBHOOK_URL");
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    }).catch((err) => console.error("form-submit: automation webhook failed", err));
  }

  // ---- Track --------------------------------------------------------------
  return jsonResponse({ ok: true, event: formConfig.analyticsEvent, email_sent: emailSent }, 200);
};

export const config: Config = {
  path: "/api/form-submit",
};
