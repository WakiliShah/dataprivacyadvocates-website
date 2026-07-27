/**
 * PART 6 — Unsubscribe endpoint.
 *
 * A GET link (clicked from the newsletter confirmation/briefing emails)
 * carrying a single-use, unguessable token generated at subscribe time —
 * see form-submit.mts. The token itself is the proof of ownership (it was
 * only ever sent to the subscriber's own inbox), so no further identity
 * verification is required for this specific, low-risk, reversible action
 * — unlike the broader access/deletion/correction requests in
 * dsr-request.mts, which do need a human to verify identity before acting.
 *
 * Returns HTML (not JSON) since this is a link a human clicks in a mail
 * client, not an API call from the site's own JS.
 */
import type { Context, Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { getSiteUrl } from "./lib/mailer.mts";

function htmlPage(title: string, message: string): Response {
  const siteUrl = getSiteUrl();
  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — Muchangi Patrick & Associates Advocates</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#eeece4;margin:0;padding:48px 16px;color:#17101a;}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:6px;padding:40px;text-align:center;}
  h1{font-size:22px;margin:0 0 12px;}
  p{font-size:15px;line-height:1.6;color:#5c4a54;}
  a{color:#8b6932;}
</style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="${siteUrl}">Return to dataprivacyadvocates.co.ke</a></p>
  </div>
</body>
</html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "GET") {
    return htmlPage("Unsupported request", "This link only supports GET requests.");
  }

  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return htmlPage("Missing token", "This unsubscribe link is incomplete. Please use the link exactly as it appeared in the email.");
  }

  try {
    const tokenStore = getStore("unsubscribe-tokens");
    const record = await tokenStore.get(token, { type: "json" });

    if (!record || typeof record !== "object" || !("submissionKey" in record)) {
      return htmlPage(
        "Link already used",
        "This unsubscribe link has already been used or has expired. If you're still receiving emails you didn't ask for, contact consult@dataprivacyadvocates.co.ke."
      );
    }

    const { submissionKey } = record as { submissionKey: string };
    const submissionStore = getStore("form-submissions");
    await submissionStore.delete(submissionKey);
    await tokenStore.delete(token); // single-use

    return htmlPage("You're unsubscribed", "You won't receive further KPLR newsletter emails. You can resubscribe at any time from the website.");
  } catch (err) {
    console.error("unsubscribe: failed", err);
    return htmlPage(
      "Something went wrong",
      "We couldn't process this automatically. Please email consult@dataprivacyadvocates.co.ke and we'll unsubscribe you directly."
    );
  }
};

export const config: Config = {
  path: "/api/unsubscribe",
};
