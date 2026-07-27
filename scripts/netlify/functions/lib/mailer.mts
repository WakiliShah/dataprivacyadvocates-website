/**
 * PART 13 — Shared SMTP transport factory. Previously duplicated inline in
 * form-submit.mts; now the one place that reads the ZOHO_SMTP_* env vars.
 */
import nodemailer from "nodemailer";

export function getMailer() {
  const user = Netlify.env.get("ZOHO_SMTP_USER");
  const pass = Netlify.env.get("ZOHO_SMTP_PASS");
  if (!user || !pass) return null;

  const host = Netlify.env.get("ZOHO_SMTP_HOST") || "smtp.zoho.com";
  const port = Number(Netlify.env.get("ZOHO_SMTP_PORT") || "465");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getFromEmail(): string {
  return Netlify.env.get("ZOHO_SMTP_USER") || "consult@dataprivacyadvocates.co.ke";
}

export function getInternalNotifyEmail(): string {
  return Netlify.env.get("INTERNAL_NOTIFY_EMAIL") || getFromEmail();
}

export function getSiteUrl(): string {
  return Netlify.env.get("SITE_URL") || "https://dataprivacyadvocates.co.ke";
}
