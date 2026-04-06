/**
 * GET /api/cron/telemetry-rollup — aggregate telemetry_events into rollups.
 *
 * 🔐 Security: CRON_SECRET is required. Returns 500 if not configured.
 */

import { aggregateTelemetryWindow } from "@aceplace/runtime-core";
import { verifyCronAuth, secureJson } from "@/lib/api-security";

export async function GET(req: Request) {
  // 🔐 CRON_SECRET is required — hard-fail if missing or wrong
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  try {
    const windowMs = 60_000;
    const window_end = new Date().toISOString();
    const window_start = new Date(Date.now() - windowMs).toISOString();
    const { rollup_id } = await aggregateTelemetryWindow({ window_start, window_end });
    return secureJson({ success: true, rollup_id, window_start, window_end });
  } catch (e) {
    console.error("[CRON] Telemetry rollup error:", e instanceof Error ? e.message : String(e));
    return secureJson({ error: "ROLLUP_ERROR" }, { status: 500 });
  }
}
