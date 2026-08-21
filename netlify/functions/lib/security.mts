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

// Netlify Deploy Previews and branch deploys get URLs like
// https://deploy-preview-12--muchangipatrickadvocate.netlify.app or
// https://some-branch--muchangipatrickadvocate.netlify.app. The prefix
// changes on every PR/branch, so a static list can't cover them — but this
// site's own Netlify subdomain never changes, so match on that instead.
// (DEPLOY_PRIME_URL/DEPLOY_URL would give the exact preview URL, but those
// are only available to Netlify at build time, not to Functions at
// runtime — only URL, SITE_NAME, and SITE_ID are — so an env-var lookup
// isn't an option here.) Only someone who can already push to this repo
// can ever cause a page to be served from this subdomain, so this is no
// looser than trusting the production domain itself.
const NETLIFY_PREVIEW_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--muchangipatrickadvocate\.netlify\.app$/;

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || NETLIFY_PREVIEW_ORIGIN_RE.test(origin);
}

/** Verifies the request's Origin (falling back to Referer) is this site. */
export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) return isAllowedOrigin(origin);

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return isAllowedOrigin(new URL(referer).origin);
    } catch {
      return false;
    }
  }

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
