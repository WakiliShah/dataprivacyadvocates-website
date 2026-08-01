/**
 * PART 5 — Scheduled retention cleanup.
 *
 * Runs daily, walks the form-submissions store, and deletes any record
 * whose retention_until has passed. Newsletter records have
 * retention_until: null (retain until unsubscribe) and are never touched
 * here — they're removed by unsubscribe.mts instead.
 *
 * Netlify scheduled functions have a 30-second execution limit, so this
 * caps how many records it deletes per run and simply catches up on the
 * next day's run if a backlog exists — it does not need to be exhaustive
 * in a single invocation.
 */
import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const MAX_DELETIONS_PER_RUN = 300;
const TIME_BUDGET_MS = 25_000; // leave headroom under the 30s scheduled-function limit

interface StoredRecord {
  audit?: { retention_until?: string | null };
}

async function cleanupStore(
  storeName: string,
  now: Date,
  startedAt: number
): Promise<{ scanned: number; deleted: number; timedOut: boolean }> {
  const store = getStore(storeName);
  let scanned = 0;
  let deleted = 0;

  for await (const page of store.list({ paginate: true })) {
    for (const { key } of page.blobs) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        return { scanned, deleted, timedOut: true };
      }
      if (deleted >= MAX_DELETIONS_PER_RUN) {
        return { scanned, deleted, timedOut: false };
      }
      scanned++;
      try {
        const record = (await store.get(key, { type: "json" })) as StoredRecord | null;
        const retentionUntil = record?.audit?.retention_until;
        if (retentionUntil && new Date(retentionUntil).getTime() < now.getTime()) {
          await store.delete(key);
          deleted++;
        }
      } catch (err) {
        console.error(`retention-cleanup: failed to process ${storeName}/${key}`, err);
      }
    }
  }

  return { scanned, deleted, timedOut: false };
}

export default async (req: Request): Promise<void> => {
  const startedAt = Date.now();
  const now = new Date();

  const submissions = await cleanupStore("form-submissions", now, startedAt);
  console.log(
    `retention-cleanup: form-submissions — scanned ${submissions.scanned}, deleted ${submissions.deleted}` +
      (submissions.timedOut ? " (time budget reached — will resume next run)" : "")
  );

  if (!submissions.timedOut) {
    const dsrRequests = await cleanupStore("dsr-requests", now, startedAt);
    console.log(
      `retention-cleanup: dsr-requests — scanned ${dsrRequests.scanned}, deleted ${dsrRequests.deleted}` +
        (dsrRequests.timedOut ? " (time budget reached — will resume next run)" : "")
    );
  } else {
    console.log("retention-cleanup: skipped dsr-requests this run — time budget already spent on form-submissions");
  }

  try {
    const { next_run } = await req.json();
    console.log("retention-cleanup: next run at", next_run);
  } catch {
    // no body on manual invocation — not an error
  }
};

export const config: Config = {
  schedule: "@daily",
};
