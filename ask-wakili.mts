/**
 * Ask Wakili — AI-assisted legal-issue-spotting endpoint.
 *
 * Pipeline: Validate -> Verify origin/rate-limit -> Call Claude, grounded
 * strictly to CASEBANK -> Discard any citation the model returns that isn't
 * actually in CASEBANK -> Audit (metadata only, not the query text) -> Respond.
 *
 * This endpoint deliberately does NOT store the visitor's free-text query.
 * A query may contain personal data about the visitor or a third party they
 * describe ("my landlord did X", "my colleague's loan"), and this tool has
 * no consent checkbox the way the newsletter/webinar forms do. Logging is
 * metadata-only (see buildAuditRecord below) so the audit trail proves the
 * endpoint was used responsibly without itself becoming a new store of
 * visitor-submitted personal data. See PRIVACY_CONFIG.lawfulBases.ask_wakili
 * and the TODO(Patrick) note in privacy-config.mts before this goes live.
 *
 * Required environment variable: ANTHROPIC_API_KEY
 * (Netlify UI -> Site configuration -> Environment variables. Never commit
 * this key or expose it to the browser — that is the entire point of this
 * function existing instead of calling the Anthropic API from the widget.)
 */
import type { Context, Config } from "@netlify/functions";
import { CASEBANK, CASEBANK_BY_ID } from "./lib/ask-wakili-casebank.mts";
import { buildAuditRecord } from "./lib/audit.mts";
import { getStore } from "@netlify/blobs";
import {
  verifyOrigin,
  getClientIp,
  checkRateLimit,
  sanitizeFields,
  SECURE_JSON_HEADERS,
} from "./lib/security.mts";

const MAX_QUERY_LENGTH = 320;
const MODEL = "claude-sonnet-4-6";

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: SECURE_JSON_HEADERS });
}

function buildSystemPrompt(): string {
  const casebankForPrompt = CASEBANK.map((c) => ({
    id: c.id,
    name: c.name,
    citation: c.citation,
    outcome: c.outcome,
    categories: c.categories,
    summary: c.summary,
  }));

  return `You are "Ask Wakili", an educational legal-issue-spotting tool embedded on the website of Muchangi Patrick & Associates Advocates, a Kenyan law firm specialising in data protection, privacy, AI governance and technology law.

A website visitor will describe a situation in plain language. Your task:

1. In one short sentence, name the general area of Kenyan privacy / data-protection law their situation may touch on.
2. Write a careful 2-3 sentence explanation. You may reference Article 31 (privacy), Article 35 (access to information) or Article 47 (fair administrative action) of the Constitution of Kenya, and may refer generally to "the Data Protection Act, 2019" if relevant. Do NOT cite specific section numbers of the Act unless you are certain of them — refer to the Act generally if unsure.
3. Select relevant authorities ONLY from the CASEBANK list below, by their exact "id". Never invent, name, or imply any case, statute, or ODPC decision that is not in this list. If nothing in the list is a good match, set "no_match": true and say so honestly instead of forcing a weak match. It is always better to under-cite than to fabricate a citation.
4. Never state a definitive legal conclusion or tell the visitor what to do. Always frame this as general information that "may relate to" their situation and that outcomes "depend on the specific facts" — real advice requires speaking to an advocate.
5. Reply with ONLY valid JSON, no markdown code fences, no preamble or explanation outside the JSON, exactly matching this shape:
{"issue_title": "string", "issue_summary": "string", "statutory_hooks": ["string"], "authorities": [{"id": "string (must exactly match a CASEBANK id)", "relevance": "Most relevant" or "Related", "why": "string, max 25 words, may reference the case's practice point"}], "related_topics": ["string", "max 4 items"], "no_match": boolean}

CASEBANK (${casebankForPrompt.length} entries):
${JSON.stringify(casebankForPrompt, null, 2)}`;
}

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  if (!verifyOrigin(req)) {
    return jsonResponse({ ok: false, error: "invalid_origin" }, 403);
  }

  const ip = getClientIp(req);
  const rate = await checkRateLimit(ip, "ask-wakili", { maxRequests: 8, windowSeconds: 600 });
  if (!rate.allowed) {
    return jsonResponse(
      { ok: false, error: "rate_limited", message: "Too many questions in a short time. Please wait a few minutes, or contact the firm directly." },
      429
    );
  }

  let rawQuery = "";
  try {
    const body = await req.json();
    rawQuery = typeof body?.query === "string" ? body.query : "";
  } catch {
    return jsonResponse({ ok: false, error: "invalid_body" }, 400);
  }

  const { query } = sanitizeFields({ query: rawQuery }, { query: MAX_QUERY_LENGTH });
  if (!query || query.length < 4) {
    return jsonResponse({ ok: false, error: "empty_query" }, 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ask-wakili: ANTHROPIC_API_KEY is not configured");
    return jsonResponse(
      { ok: false, error: "not_configured", message: "Ask Wakili is not fully set up yet. Please contact the firm directly." },
      503
    );
  }

  let parsed: any;
  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: query }],
      }),
    });

    if (!anthropicRes.ok) {
      console.error("ask-wakili: Anthropic API error", anthropicRes.status, await anthropicRes.text());
      return jsonResponse({ ok: false, error: "upstream_error" }, 502);
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    if (!textBlock) throw new Error("no text block in model response");
    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("ask-wakili: failed to get/parse model response", err);
    return jsonResponse(
      { ok: false, error: "processing_failed", message: "Ask Wakili couldn't process that just now. Please try rephrasing, or contact the firm directly." },
      502
    );
  }

  // ---- Server-side grounding guard: never trust the model's citations. ----
  const requestedIds: string[] = Array.isArray(parsed.authorities)
    ? parsed.authorities.map((a: any) => a?.id).filter(Boolean)
    : [];
  const safeAuthorities = (parsed.authorities || [])
    .filter((a: any) => a && typeof a.id === "string" && CASEBANK_BY_ID[a.id])
    .slice(0, 3)
    .map((a: any) => {
      const c = CASEBANK_BY_ID[a.id];
      return {
        name: c.name,
        citation: c.citation,
        outcome: c.outcome,
        url: c.url,
        relevance: a.relevance === "Most relevant" ? "Most relevant" : "Related",
        why: typeof a.why === "string" ? a.why.slice(0, 240) : c.practicePoint,
      };
    });
  const droppedCount = requestedIds.length - safeAuthorities.length;
  if (droppedCount > 0) {
    console.warn(`ask-wakili: dropped ${droppedCount} authority id(s) not present in CASEBANK`, requestedIds);
  }
  const noMatch = Boolean(parsed.no_match) || safeAuthorities.length === 0;

  const responsePayload = {
    ok: true,
    issue_title: typeof parsed.issue_title === "string" ? parsed.issue_title.slice(0, 160) : "Possible legal issue",
    issue_summary: typeof parsed.issue_summary === "string" ? parsed.issue_summary.slice(0, 800) : "",
    statutory_hooks: Array.isArray(parsed.statutory_hooks) ? parsed.statutory_hooks.slice(0, 6) : [],
    authorities: safeAuthorities,
    related_topics: Array.isArray(parsed.related_topics) ? parsed.related_topics.slice(0, 4) : [],
    no_match: noMatch,
  };

  // ---- Metadata-only audit trail — never the raw query text. -------------
  try {
    const audit = buildAuditRecord({
      activity: "ask_wakili_query" as any,
      consentGiven: null,
      retentionDays: 90,
    });
    const store = getStore("ask-wakili-log");
    await store.setJSON(audit.submission_id, {
      ...audit,
      ip_hash: ip === "unknown" ? "unknown" : await sha256(ip),
      query_length: query.length,
      matched_case_ids: safeAuthorities.map((a: any) => a.citation),
      no_match: noMatch,
      dropped_hallucinated_citations: droppedCount,
    });
  } catch (err) {
    console.error("ask-wakili: audit log write failed (non-fatal)", err);
  }

  return jsonResponse(responsePayload, 200);
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const config: Config = {
  path: "/api/ask-wakili",
};
