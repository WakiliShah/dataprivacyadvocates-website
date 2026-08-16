import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getMailer, getFromEmail, getInternalNotifyEmail, getSiteUrl } from "./lib/mailer.mts";
import { verifyOrigin, getClientIp, checkRateLimit, sanitizeFields, isValidEmail, passesTimeTrap, SECURE_JSON_HEADERS } from "./lib/security.mts";

const MAX: Record<string, number> = {
  name: 160, phone: 60, email: 254, organisation: 200, details: 8000,
  issue_type: 160, acknowledgement: 20, "bot-field": 200, rendered_at: 20,
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: SECURE_JSON_HEADERS });

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c] || c));
}

async function notifyWhatsApp(reference: string, fields: Record<string,string>): Promise<boolean> {
  const token = Netlify.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = Netlify.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const to = Netlify.env.get("WHATSAPP_TO");
  const template = Netlify.env.get("WHATSAPP_TEMPLATE_NAME");
  const language = Netlify.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "en_US";
  if (!token || !phoneNumberId || !to || !template) return false;

  const base = `https://graph.facebook.com/v23.0/${encodeURIComponent(phoneNumberId)}/messages`;
  const params = [reference, fields.issue_type, fields.name, fields.phone];
  const response = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: { name: template, language: { code: language }, components: [{ type: "body", parameters: params.map(text => ({ type: "text", text: String(text || "").slice(0, 1024) })) }] }
    })
  });
  if (!response.ok) {
    console.error("complaint-enquiry: WhatsApp notification failed", await response.text());
    return false;
  }
  return true;
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!verifyOrigin(req)) return json({ ok: false, error: "invalid_origin" }, 403);

  let raw: Record<string,string> = {};
  try {
    const fd = await req.formData();
    for (const [k,v] of fd.entries()) raw[k] = typeof v === "string" ? v : "";
  } catch { return json({ ok: false, error: "invalid_body" }, 400); }

  const fields = sanitizeFields(raw, MAX);
  if (fields["bot-field"]) return json({ ok: true, event: null });
  if (!passesTimeTrap(fields.rendered_at)) return json({ ok: true, event: null });

  const required = ["name","phone","details","issue_type","acknowledgement"];
  for (const field of required) if (!fields[field]) return json({ ok: false, error: `missing_field:${field}` }, 400);
  if (fields.acknowledgement !== "yes") return json({ ok: false, error: "acknowledgement_required" }, 400);
  if (fields.email && !isValidEmail(fields.email)) return json({ ok: false, error: "invalid_email" }, 400);

  const ip = getClientIp(req);
  const limit = await checkRateLimit(ip, "complaint-enquiry", { maxRequests: 3, windowSeconds: 900 });
  if (!limit.allowed) return json({ ok: false, error: "rate_limited" }, 429);

  const now = new Date();
  const reference = crypto.randomUUID();
  const userAgent = req.headers.get("user-agent") || "";
  const { "bot-field": _bot, rendered_at: _rendered, acknowledgement: _ack, ...visible } = fields;
  const submission = {
    reference, form_type: "complaint_enquiry", fields: visible,
    submitted_at: now.toISOString(), ip_address: ip, user_agent: userAgent,
    notice: "This is a legal enquiry to the firm and not an ODPC complaint itself."
  };

  try {
    await getStore("complaint-enquiries").setJSON(`${now.toISOString().slice(0,10)}/${reference}`, submission);
  } catch (err) { console.error("complaint-enquiry: blob save failed", err); }

  const from = getFromEmail();
  const to = getInternalNotifyEmail();
  const mailer = getMailer();
  let emailSent = false;
  if (mailer) {
    try {
      const subject = `New ODPC enquiry ${reference.slice(0,8).toUpperCase()} — ${fields.issue_type}`;
      const html = `<div style="font-family:Arial,sans-serif;max-width:700px"><h2>New Data Protection Enquiry</h2><p><strong>Reference:</strong> ${escapeHtml(reference)}</p><p><strong>Issue:</strong> ${escapeHtml(fields.issue_type)}</p><p><strong>Name:</strong> ${escapeHtml(fields.name)}</p><p><strong>Phone/WhatsApp:</strong> ${escapeHtml(fields.phone)}</p><p><strong>Email:</strong> ${escapeHtml(fields.email || "Not provided")}</p><p><strong>Organisation:</strong> ${escapeHtml(fields.organisation || "Not provided")}</p><hr><p><strong>What happened:</strong></p><p style="white-space:pre-wrap">${escapeHtml(fields.details)}</p><hr><p style="color:#666">Submitted through ${escapeHtml(getSiteUrl())}. This is an enquiry, not an ODPC complaint.</p></div>`;
      await mailer.sendMail({ from: `"Muchangi Patrick & Associates Advocates" <${from}>`, to, subject, html });
      emailSent = true;
    } catch (err) { console.error("complaint-enquiry: email failed", err); }
  }

  let whatsappSent = false;
  try { whatsappSent = await notifyWhatsApp(reference, fields); } catch (err) { console.error("complaint-enquiry: WhatsApp error", err); }

  return json({ ok: true, reference, email_sent: emailSent, whatsapp_sent: whatsappSent });
};

export const config: Config = { path: "/api/complaint-enquiry" };
