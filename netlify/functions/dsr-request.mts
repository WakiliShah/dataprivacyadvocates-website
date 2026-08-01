/**
 * PART 6 — Data subject rights: access, deletion, correction.
 *
 * Design decision: this endpoint intakes and acknowledges the request; it
 * does not auto-fulfil it. Unlike unsubscribe.mts (where a token mailed to
 * the subscriber's own inbox IS sufficient proof of ownership for that one
 * reversible action), access/deletion/correction requests need a human to
 * verify the requester's identity before acting — auto-deleting or
 * disclosing data based on an unverified email address typed into a public
 * form would itself be a security/compliance problem, and this endpoint
 * only has visibility into the website's own form-submissions store, not
 * the firm's wider data estate (matter files, correspondence, etc.), so a
 * human has to coordinate fulfilment either way.
 *
 * What it does automatically:
 *   - Validates + rate-limits + spam-checks the request
 *   - Generates an opaque reference token (never exposes internal Blobs
 *     keys or submission IDs)
 *   - Logs an immutable, auditable request record
 *   - Sends the requester a neutral acknowledgment (same wording whether
 *     or not their email matches any record on file, to avoid confirming
 *     someone's subscription status to an unverified requester)
 *   - Notifies the firm with full detail so the request can be actioned
 *     within the applicable statutory period
 */
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { renderShell } from "./lib/email-templates.mts";
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

const VALID_REQUEST_TYPES = new Set(["access", "deletion", "correction"]);

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: SECURE_JSON_HEADERS });
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!verifyOrigin(req)) {
    return jsonResponse({ ok: false, error: "invalid_origin" }, 403);
  }

  let rawFields: Record<string, string> = {};
  try {
    const formData = await req.formData();
    for (const [key, value] of formData.entries()) {
      rawFields[key] = typeof value === "string" ? value : "";
    }
  } catch {
    return jsonResponse({ ok: false, error: "invalid_body" }, 400);
  }

  const fields = sanitizeFields(rawFields, {
    email: 254,
    request_type: 20,
    details: 2000,
    "bot-field": 200,
    rendered_at: 20,
  });

  if (fields["bot-field"] || !passesTimeTrap(fields["rendered_at"])) {
    // Same neutral response as a real submission — don't tip off automation.
    return jsonResponse({ ok: true, reference: crypto.randomUUID() }, 200);
  }

  const ip = getClientIp(req);
  const rateLimit = await checkRateLimit(ip, "dsr-request", { maxRequests: 3, windowSeconds: 3600 });
  if (!rateLimit.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }

  const requestType = fields["request_type"];
  if (!VALID_REQUEST_TYPES.has(requestType)) {
    return jsonResponse({ ok: false, error: "invalid_request_type" }, 400);
  }
  if (!fields.email || !isValidEmail(fields.email)) {
    return jsonResponse({ ok: false, error: "invalid_email" }, 400);
  }

  const now = new Date();
  const audit = buildAuditRecord({
    activity: "dsr_request",
    consentGiven: null, // legal-obligation basis, not consent — see PRIVACY_CONFIG.lawfulBases.dsr_request
    retentionDays: PRIVACY_CONFIG.retention.dsr_request.days,
    now,
  });

  // PART 6: opaque reference token — never the Blobs key itself.
  const referenceToken = crypto.randomUUID();

  const record = {
    reference_token: referenceToken,
    request_type: requestType,
    email: fields.email,
    details: fields.details || "",
    status: "pending",
    ip_address: ip,
    user_agent: req.headers.get("user-agent") || "",
    audit,
  };

  try {
    const store = getStore("dsr-requests");
    await store.setJSON(`dsr-requests/${referenceToken}`, record);
  } catch (err) {
    console.error("dsr-request: blob save failed", err);
    return jsonResponse({ ok: false, error: "storage_failed" }, 500);
  }

  const mailer = getMailer();
  const siteUrl = getSiteUrl();
  const fromEmail = getFromEmail();

  if (mailer) {
    try {
      // Neutral acknowledgment to the requester — identical wording
      // regardless of whether this email matches any record on file.
      const ackHtml = renderShell({
        siteUrl,
        preheader: "We've received your data subject rights request.",
        eyebrow: "Data Subject Rights Request",
        heading: "Request received.",
        bodyHtml: `
          <p style="margin:0 0 16px;">We've received your <strong>${requestType}</strong> request
          referenced <code>${referenceToken}</code>.</p>
          <p style="margin:0 0 16px;">We will verify your identity and respond within the statutory
          period. If we need more information to verify your identity or locate your data, we'll
          contact you at this email address.</p>
          <p style="margin:0;">Quote reference <code>${referenceToken}</code> in any follow-up.</p>`,
        reasonForReceiving: "you submitted a data subject rights request on dataprivacyadvocates.co.ke.",
      });
      await mailer.sendMail({
        from: `"Muchangi Patrick & Associates Advocates" <${fromEmail}>`,
        to: fields.email,
        subject: `Request received — ref ${referenceToken.slice(0, 8)}`,
        html: ackHtml,
      });

      const internalHtml = renderShell({
        siteUrl,
        preheader: `New ${requestType} request`,
        eyebrow: "Internal Notification — DSR",
        heading: `New ${requestType} request`,
        bodyHtml: `
          <p>Reference: <code>${referenceToken}</code></p>
          <p>Email: ${fields.email}</p>
          <p>Type: ${requestType}</p>
          <p>Details: ${fields.details || "(none provided)"}</p>
          <p>Action within the statutory period. Verify identity before disclosing, correcting, or
          deleting any data.</p>`,
        reasonForReceiving: "you are the configured recipient for data subject rights requests on the firm's website.",
      });
      await mailer.sendMail({
        from: `"KPLR Website" <${fromEmail}>`,
        to: getInternalNotifyEmail(),
        subject: `[DSR] New ${requestType} request — ${referenceToken.slice(0, 8)}`,
        html: internalHtml,
      });
    } catch (err) {
      console.error("dsr-request: email failed", err);
    }
  }

  return jsonResponse({ ok: true, reference: referenceToken }, 200);
};

export const config: Config = {
  path: "/api/dsr-request",
};
