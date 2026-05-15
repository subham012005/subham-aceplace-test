import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { USAGE_LIMITS, FIRESTORE_CAPS } from "@/lib/sandbox-config";
import { verifyUserApiKey } from "@/lib/api-security";

/**
 * GET /api/sandbox/usage-limits
 *
 * Returns the current usage limits and the authenticated user's current consumption.
 * Used by the frontend to display quota information and enforce client-side guards.
 */
export async function GET(req: Request) {
  try {
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      // Return limits without consumption data when admin not initialized
      return NextResponse.json({
        limits: USAGE_LIMITS,
        caps: FIRESTORE_CAPS,
        consumption: null,
      });
    }

    const todayUtc = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Fetch today's execution count
    const execSnap = await adminDb
      .collection("sandbox_usage")
      .doc(userId)
      .collection("daily")
      .doc(todayUtc)
      .get();

    const execData = execSnap.data() ?? {};

    // Fetch active envelopes count
    const envelopeSnap = await adminDb
      .collection("execution_envelopes")
      .where("user_id", "==", userId)
      .where("status", "in", ["executing", "dispatched", "pending"])
      .get();

    const activeEnvelopes = envelopeSnap.size;
    const executionsToday = execData.executions ?? 0;
    const lastExecutionAt = execData.lastExecutionAt ?? null;

    // Calculate cooldown remaining
    let cooldownRemainingSeconds = 0;
    if (lastExecutionAt) {
      const elapsedMs = Date.now() - new Date(lastExecutionAt).getTime();
      const elapsedSeconds = Math.floor(elapsedMs / 1000);
      cooldownRemainingSeconds = Math.max(
        0,
        USAGE_LIMITS.COOLDOWN_BETWEEN_EXECUTIONS_SECONDS - elapsedSeconds
      );
    }

    return NextResponse.json({
      limits: USAGE_LIMITS,
      caps: FIRESTORE_CAPS,
      consumption: {
        executionsToday,
        activeEnvelopes,
        cooldownRemainingSeconds,
        dailyQuotaExhausted: executionsToday >= USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY,
        envelopeLimitReached: activeEnvelopes >= USAGE_LIMITS.MAX_ACTIVE_RUNTIME_ENVELOPES,
        cooldownActive: cooldownRemainingSeconds > 0,
      },
    });
  } catch (err: any) {
    console.error("[SANDBOX USAGE] Error fetching limits:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sandbox/usage-limits/record-execution
 * Internal helper to increment daily execution counter.
 * Called by the runtime dispatch before launching a job.
 */
export async function POST(req: Request) {
  try {
    const { userId, error } = await verifyUserApiKey(req);
    if (error) return error;

    if (!adminDb) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const todayUtc = new Date().toISOString().slice(0, 10);
    const docRef = adminDb
      .collection("sandbox_usage")
      .doc(userId)
      .collection("daily")
      .doc(todayUtc);

    const snap = await docRef.get();
    const current = (snap.data()?.executions ?? 0) as number;

    if (current >= USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY) {
      return NextResponse.json(
        {
          error: "DAILY_QUOTA_EXHAUSTED",
          message: `Maximum ${USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY} executions per day reached.`,
          limit: USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY,
          current,
        },
        { status: 429 }
      );
    }

    await docRef.set(
      {
        executions: current + 1,
        lastExecutionAt: new Date().toISOString(),
        userId,
        date: todayUtc,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      executionsToday: current + 1,
      remaining: USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY - (current + 1),
    });
  } catch (err: any) {
    console.error("[SANDBOX USAGE] Error recording execution:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
