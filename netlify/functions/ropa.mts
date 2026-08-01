/**
 * PART 11 — Record of Processing Activities (ROPA), machine-readable.
 *
 * Generated directly from PRIVACY_CONFIG (PART 12) rather than maintained
 * as a separate document — change a retention period or lawful basis in
 * privacy-config.mts and this endpoint reflects it immediately, so the
 * ROPA can't silently drift out of sync with what the code actually does.
 *
 * This is a starting point for your Section [TODO: confirm exact DPA 2019
 * provision] ROPA obligation, not a replacement for a full organisational
 * ROPA covering processing outside this website (matter files, billing,
 * correspondence, etc.) — it only knows about the two processing
 * activities currently implemented in this codebase.
 */
import type { Context, Config } from "@netlify/functions";
import { PRIVACY_CONFIG } from "./lib/privacy-config.mts";

export default async (_req: Request, _context: Context): Promise<Response> => {
  const activities = (Object.keys(PRIVACY_CONFIG.lawfulBases) as Array<keyof typeof PRIVACY_CONFIG.lawfulBases>).map(
    (activity) => {
      const dataCategoryKey = activity.startsWith("webinar")
        ? "webinar"
        : activity === "dsr_request"
          ? "dsr_request"
          : "newsletter";

      return {
        processing_activity: activity,
        controller: PRIVACY_CONFIG.firm.name,
        dpo: PRIVACY_CONFIG.dpo,
        purpose: PRIVACY_CONFIG.purposes[activity],
        lawful_basis: PRIVACY_CONFIG.lawfulBases[activity],
        categories_of_data: PRIVACY_CONFIG.dataCategories[dataCategoryKey as keyof typeof PRIVACY_CONFIG.dataCategories],
        data_subjects: PRIVACY_CONFIG.dataSubjects[dataCategoryKey as keyof typeof PRIVACY_CONFIG.dataSubjects],
        recipients: PRIVACY_CONFIG.recipients[dataCategoryKey as keyof typeof PRIVACY_CONFIG.recipients],
        retention:
          activity === "newsletter"
            ? PRIVACY_CONFIG.retention.newsletter
            : activity === "dsr_request"
              ? PRIVACY_CONFIG.retention.dsr_request
              : PRIVACY_CONFIG.retention.webinar,
        international_transfers: PRIVACY_CONFIG.transfers,
        security_measures: PRIVACY_CONFIG.securityMeasures,
        processing_system: PRIVACY_CONFIG.processingSystem,
      };
    }
  );

  const ropa = {
    generated_at: new Date().toISOString(),
    controller: {
      name: PRIVACY_CONFIG.firm.name,
      address: PRIVACY_CONFIG.firm.address,
      contact: PRIVACY_CONFIG.firm.contactEmail,
    },
    dpo: PRIVACY_CONFIG.dpo,
    privacy_policy_version: PRIVACY_CONFIG.privacyPolicyVersion,
    consent_version: PRIVACY_CONFIG.consentVersion,
    scope_note:
      "Covers processing activities implemented on dataprivacyadvocates.co.ke only (newsletter, webinar registration, webinar marketing opt-in, data subject rights requests). Does not cover matter management, billing, or correspondence systems outside this website.",
    activities,
  };

  return new Response(JSON.stringify(ropa, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export const config: Config = {
  path: "/api/ropa",
};
