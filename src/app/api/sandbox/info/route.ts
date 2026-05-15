import { NextResponse } from "next/server";
import { USAGE_LIMITS, RATE_LIMITS, STORAGE_LIMITS, FIRESTORE_CAPS, SANDBOX_NOTICES, TERMS_VERSION } from "@/lib/sandbox-config";

/**
 * GET /api/sandbox/info
 *
 * Public endpoint returning sandbox environment information.
 * Used by the frontend status displays and legal disclosures.
 */
export async function GET() {
  return NextResponse.json({
    environment: "sandbox",
    type: "public-runtime-preview",
    termsVersion: TERMS_VERSION,
    notices: SANDBOX_NOTICES,
    limits: {
      usage: USAGE_LIMITS,
      rate: RATE_LIMITS,
      storage: STORAGE_LIMITS,
      firestore: FIRESTORE_CAPS,
    },
    disclosure: [
      "This is a non-production sandbox environment.",
      "Sessions may be reset, rate limited, or terminated without notice.",
      "Not a licensed production deployment of ACEPLACE.",
    ],
    timestamp: new Date().toISOString(),
  });
}
