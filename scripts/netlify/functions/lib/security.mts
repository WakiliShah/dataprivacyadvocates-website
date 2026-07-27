/**
 * PART 8 — Shared security helpers used by every public-facing function.
 *
 * A note on "CSRF protection" for this architecture: these are anonymous,
 * unauthenticated public forms with no session/cookie state — there is no
 * privileged session for a forged cross-site request to ride on, which is
 * what classic CSRF tokens defend against. The functionally equivalent,
 * standard mitigation for this shape of endpoint is Origin/Referer
 * verification (reject POSTs that didn't originate from this site), which
 * is what verifyOrigin() below implements. A synchroniser token would add
 * complexity without adding real protection here.
 */
import { getStore } from "@netlify/blobs";

const ALLOWED_ORIGINS = [
  "https://dataprivacyadvocates.co.ke",
  "https://www.dataprivacyadvocates.co.ke",
];

/** Verifies the request's Origin (falling back to Referer) is this site. */
export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return ALLOWED_ORIGINS.includes(origin);

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      return ALLOWED_ORIGINS.includes(refOrigin);
    } catch {
      return false;
    }
  }

  // Netlify's own Deploy Previews won't match ALLOWED_ORIGINS and would be
  // rejected here too — add the preview pattern to ALLOWED_ORIGINS while
  // testing on a deploy preview if needed.
  return false;
}

/** Best-effort visitor IP, for rate limiting and the audit trail. Never
 * used for anything security-critical beyond coarse abuse mitigation. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

/**
 * Simple IP + form_type sliding-window rate limit backed by Netlify Blobs.
 * Not a hard security boundary (Blobs is eventually consistent) — it's
 * abuse mitigation, not a substitute for a real WAF.
 */
export async function checkRateLimit(
  ip: string,
  bucket: string,
  opts: { maxRequests: number; windowSeconds: number }
): Promise<{ allowed: boolean; remaining: number }> {
  if (ip === "unknown") return { allowed: true, remaining: opts.maxRequests };

  const store = getStore("rate-limits");
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  let timestamps: number[] = [];
  try {
    const existing = await store.get(key, { type: "json" });
    if (Array.isArray(existing)) timestamps = existing as number[];
  } catch {
    timestamps = [];
  }

  const windowStart = now - opts.windowSeconds * 1000;
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= opts.maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  try {
    await store.setJSON(key, timestamps, { metadata: { expiresAt: now + opts.windowSeconds * 1000 } });
  } catch {
    // If the store write fails, fail open rather than blocking a legitimate
    // submission over an infrastructure hiccup.
  }

  return { allowed: true, remaining: opts.maxRequests - timestamps.length };
}

/**
 * Trims, length-caps, and strips control characters from every submitted
 * field. This is defence in depth, not a substitute for output encoding —
 * email-templates.mts still HTML-escapes everything at render time.
 */
export function sanitizeFields(
  raw: Record<string, string>,
  maxLengths: Record<string, number> = {}
): Record<string, string> {
  const DEFAULT_MAX = 500;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const stripped = value
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim();
    const limit = maxLengths[key] ?? DEFAULT_MAX;
    out[key] = stripped.slice(0, limit);
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email) && email.length <= 254;
}

/**
 * Minimum-time-to-submit spam check. Forms embed a hidden
 * `rendered_at` field (epoch ms, set by JS on page load); genuine humans
 * take at least a couple of seconds to fill a form, bots typically submit
 * near-instantly.
 */
export function passesTimeTrap(renderedAt: string | undefined, minMs = 2000): boolean {
  if (!renderedAt) return true; // don't punish forms that predate this field
  const ts = Number(renderedAt);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts >= minMs;
}

/** Standard security-relevant headers for JSON API responses. */
export const SECURE_JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "no-store",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
