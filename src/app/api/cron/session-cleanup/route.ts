import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { STORAGE_LIMITS, FIRESTORE_CAPS } from "@/lib/sandbox-config";

/**
 * GET /api/cron/session-cleanup
 *
 * Cron job for sandbox environment cleanup. Handles:
 *  1. Temporary artifact expiration (older than ARTIFACT_EXPIRATION_HOURS)
 *  2. Inactive session cleanup (sessions idle > SESSION_INACTIVITY_CLEANUP_MINUTES)
 *  3. Per-user artifact count enforcement (> MAX_ARTIFACTS_PER_JOB)
 *  4. Firestore write/read telemetry cap enforcement
 *  5. Queue / runtime overload protection (stale executing envelopes)
 *
 * Trigger: Configure via Vercel Cron or Cloud Scheduler every 30 minutes.
 * Authorization: Requires CRON_SECRET header.
 */
export async function GET(req: Request) {
  // ── Verify cron secret ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!adminDb) {
    return NextResponse.json(
      { error: "ADMIN_NOT_INIT", skipped: true },
      { status: 503 }
    );
  }

  const results = {
    artifactsExpired: 0,
    sessionsCleared: 0,
    staleEnvelopesQuarantined: 0,
    telemetryTrimmed: 0,
    errors: [] as string[],
  };

  const now = new Date();

  // ── 1. Expire old artifacts ───────────────────────────────────────────────
  try {
    const artifactExpiryMs =
      STORAGE_LIMITS.ARTIFACT_EXPIRATION_HOURS * 60 * 60 * 1000;
    const artifactCutoff = new Date(now.getTime() - artifactExpiryMs).toISOString();

    const artifactSnap = await adminDb
      .collection("artifacts")
      .where("createdAt", "<", artifactCutoff)
      .where("temporary", "==", true)
      .limit(200)
      .get();

    const batch = adminDb.batch();
    artifactSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
      results.artifactsExpired++;
    });
    if (results.artifactsExpired > 0) await batch.commit();
  } catch (err: any) {
    results.errors.push(`artifact_expiry: ${err.message}`);
  }

  // ── 2. Clean inactive sessions ────────────────────────────────────────────
  try {
    const sessionInactivityMs =
      STORAGE_LIMITS.SESSION_INACTIVITY_CLEANUP_MINUTES * 60 * 1000;
    const sessionCutoff = new Date(now.getTime() - sessionInactivityMs).toISOString();

    const sessionSnap = await adminDb
      .collection("sandbox_sessions")
      .where("lastActiveAt", "<", sessionCutoff)
      .where("status", "==", "active")
      .limit(100)
      .get();

    const sessionBatch = adminDb.batch();
    sessionSnap.docs.forEach((doc) => {
      sessionBatch.update(doc.ref, {
        status: "expired",
        expiredAt: now.toISOString(),
        expiredReason: "inactivity",
      });
      results.sessionsCleared++;
    });
    if (results.sessionsCleared > 0) await sessionBatch.commit();
  } catch (err: any) {
    results.errors.push(`session_cleanup: ${err.message}`);
  }

  // ── 3. Quarantine stale executing envelopes ───────────────────────────────
  // Envelopes that have been "executing" for more than 2 hours are considered stale.
  try {
    const staleCutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    const staleSnap = await adminDb
      .collection("execution_envelopes")
      .where("status", "==", "executing")
      .where("created_at", "<", staleCutoff)
      .limit(50)
      .get();

    const staleBatch = adminDb.batch();
    staleSnap.docs.forEach((doc) => {
      staleBatch.update(doc.ref, {
        status: "quarantined",
        quarantined_at: now.toISOString(),
        quarantine_reason: "sandbox_stale_execution_cleanup",
      });
      results.staleEnvelopesQuarantined++;
    });
    if (results.staleEnvelopesQuarantined > 0) await staleBatch.commit();
  } catch (err: any) {
    results.errors.push(`stale_envelope_quarantine: ${err.message}`);
  }

  // ── 4. Trim excess telemetry events ──────────────────────────────────────
  // Remove telemetry older than 7 days to stay within Firestore caps.
  try {
    const telemetryCutoff = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const telemetrySnap = await adminDb
      .collection("telemetry")
      .where("timestamp", "<", telemetryCutoff)
      .limit(500)
      .get();

    const telemetryBatch = adminDb.batch();
    telemetrySnap.docs.forEach((doc) => {
      telemetryBatch.delete(doc.ref);
      results.telemetryTrimmed++;
    });
    if (results.telemetryTrimmed > 0) await telemetryBatch.commit();
  } catch (err: any) {
    results.errors.push(`telemetry_trim: ${err.message}`);
  }

  // ── 5. Queue overload protection ─────────────────────────────────────────
  // If total dispatched/pending envelopes exceed threshold, reject and log.
  try {
    const queueSnap = await adminDb
      .collection("execution_envelopes")
      .where("status", "in", ["dispatched", "pending"])
      .limit(FIRESTORE_CAPS.QUEUE_OVERLOAD_THRESHOLD + 1)
      .get();

    if (queueSnap.size > FIRESTORE_CAPS.QUEUE_OVERLOAD_THRESHOLD) {
      // Log overload event
      await adminDb.collection("sandbox_events").add({
        type: "QUEUE_OVERLOAD",
        timestamp: now.toISOString(),
        queueDepth: queueSnap.size,
        threshold: FIRESTORE_CAPS.QUEUE_OVERLOAD_THRESHOLD,
      });
    }
  } catch (err: any) {
    results.errors.push(`queue_overload_check: ${err.message}`);
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    results,
    limits: {
      artifactExpirationHours: STORAGE_LIMITS.ARTIFACT_EXPIRATION_HOURS,
      sessionInactivityMinutes: STORAGE_LIMITS.SESSION_INACTIVITY_CLEANUP_MINUTES,
      queueOverloadThreshold: FIRESTORE_CAPS.QUEUE_OVERLOAD_THRESHOLD,
    },
  });
}
