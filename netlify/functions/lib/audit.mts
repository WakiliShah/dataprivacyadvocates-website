/**
 * PART 10 — Audit trail.
 *
 * Every record written to Blobs (submissions, DSR requests) gets one of
 * these attached. Treat the returned object as immutable once written:
 * nothing in this codebase updates these fields after creation — retention
 * cleanup deletes the whole record rather than editing it, and DSR status
 * changes are appended as new events (see dsr-request.mts) rather than
 * mutating this block.
 */
import { PRIVACY_CONFIG, type ProcessingActivity } from "./privacy-config.mts";

export interface AuditRecord {
  submission_id: string;
  timestamp: string;
  lawful_basis: string;
  purpose: string;
  consent_status: "given" | "not_required" | "declined";
  privacy_notice_version: string;
  retention_until: string | null; // null = retain until unsubscribe / indefinite trigger event
  retention_policy: string;
  processing_system: string;
  processing_activity: ProcessingActivity;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function buildAuditRecord(opts: {
  activity: ProcessingActivity;
  consentGiven: boolean | null; // null = consent not applicable (e.g. contract basis)
  retentionDays: number | null; // null = no fixed end date (retain until unsubscribe)
  now?: Date;
}): AuditRecord {
  const now = opts.now ?? new Date();
  const lawfulBasis = PRIVACY_CONFIG.lawfulBases[opts.activity];
  const purpose = PRIVACY_CONFIG.purposes[opts.activity];

  let consentStatus: AuditRecord["consent_status"];
  if (opts.consentGiven === null) consentStatus = "not_required";
  else consentStatus = opts.consentGiven ? "given" : "declined";

  const retentionUntil = opts.retentionDays === null ? null : addDays(now, opts.retentionDays).toISOString();
  const retentionPolicyEntry = Object.values(PRIVACY_CONFIG.retention).find(
    (r) => r.days === opts.retentionDays
  );

  return {
    submission_id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    lawful_basis: lawfulBasis,
    purpose,
    consent_status: consentStatus,
    privacy_notice_version: PRIVACY_CONFIG.consentVersion,
    retention_until: retentionUntil,
    retention_policy: retentionPolicyEntry?.policyId ?? "unspecified",
    processing_system: PRIVACY_CONFIG.processingSystem,
    processing_activity: opts.activity,
  };
}
