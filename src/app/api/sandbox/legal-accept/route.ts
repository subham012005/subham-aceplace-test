import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { TERMS_VERSION } from "@/lib/sandbox-config";

/**
 * POST /api/sandbox/legal-accept
 *
 * Logs the user's acceptance of the legal terms for the sandbox environment.
 * Recorded fields:
 *  - userId          (provided by client, validated server-side)
 *  - ip              (extracted from request headers)
 *  - acceptedAtUtc   (server-side UTC timestamp — authoritative)
 *  - termsVersion    (from TERMS_VERSION constant)
 *  - acceptance      (always true)
 *  - userAgent       (browser string for audit trail)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId, termsVersion } = body as {
      userId?: string;
      termsVersion?: string;
    };

    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "MISSING_USER_ID" },
        { status: 400 }
      );
    }

    // Extract IP from standard proxy headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const userAgent = req.headers.get("user-agent") || "unknown";

    const record = {
      userId: userId.trim(),
      ip,
      userAgent,
      acceptedAtUtc: new Date().toISOString(),
      termsVersion: termsVersion === TERMS_VERSION ? termsVersion : TERMS_VERSION,
      acceptance: true,
    };

    if (adminDb) {
      // Store under users/{userId}/legal_acceptances/{timestamp}
      await adminDb
        .collection("users")
        .doc(record.userId)
        .collection("legal_acceptances")
        .add(record);

      // Also update the user's top-level record for quick lookup
      await adminDb
        .collection("users")
        .doc(record.userId)
        .set(
          {
            legalAccepted: true,
            legalAcceptedAt: record.acceptedAtUtc,
            legalTermsVersion: record.termsVersion,
            legalAcceptedIp: record.ip,
          },
          { merge: true }
        );
    } else {
      // Dev mode: log to console
      console.log("[SANDBOX LEGAL] Acceptance logged (dev mode):", record);
    }

    return NextResponse.json({ ok: true, logged: true }, { status: 200 });
  } catch (err: any) {
    console.error("[SANDBOX LEGAL] Error logging acceptance:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err?.message },
      { status: 500 }
    );
  }
}
