/**
 * API Security helpers — used by all runtime + cron routes.
 *
 * Rules:
 *  1. All API responses include security headers.
 *  2. Error bodies never leak stack traces or internal paths.
 *  3. CRON_SECRET is required (not optional).
 *  4. User input is sanitised before reaching business logic.
 */

import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";


// ─── Security Headers ─────────────────────────────────────────────────────────
// Applied to every JSON response from runtime / cron routes.

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cache-Control": "no-store",
};

/** Wrap any JSON response with security headers */
export function secureJson(
  body: unknown,
  init?: ResponseInit
): NextResponse {
  const res = NextResponse.json(body, init);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

// ─── CRON Authentication ──────────────────────────────────────────────────────
// CRON_SECRET must be set in production. Both routes enforce it.

/**
 * Returns a 401 NextResponse if the request is not authorised as a cron caller,
 * or `null` if authorisation passes.
 *
 * Behaviour:
 *  - If CRON_SECRET is unset in env → reject with 500 (misconfiguration)
 *  - If Authorization header doesn't match → reject with 401
 */
export function verifyCronAuth(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  // Hard-fail if the secret is not configured — this is a server misconfiguration
  if (!cronSecret) {
    console.error("[SECURITY] CRON_SECRET is not set. Refusing cron request.");
    return secureJson(
      { error: "SERVER_MISCONFIGURED", message: "Cron secret is not configured." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return secureJson({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  return null; // auth passed
}

/**
 * Returns a 401 NextResponse if the request is not authorised as a Master caller,
 * or `null` if authorisation passes.
 *
 * Checks: 1. MASTER_RUNTIME_SECRET, then 2. CRON_SECRET (fallback).
 */
export function verifyMasterAuth(req: Request): NextResponse | null {
  const masterSecret = process.env.MASTER_RUNTIME_SECRET || process.env.CRON_SECRET;

  if (!masterSecret) {
    console.error("[SECURITY] MASTER_RUNTIME_SECRET/CRON_SECRET is not set. Refusing master request.");
    return secureJson(
      { error: "SERVER_MISCONFIGURED", message: "Master authentication is not configured." },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${masterSecret}`) {
    return secureJson({ error: "UNAUTHORIZED_MASTER" }, { status: 401 });
  }

  return null; // auth passed
}

/**
 * 🔐 Resolves a User from an API Key OR a Firebase ID Token.
 *
 * Checks:
 *  1. Is it a valid Firebase ID Token?
 *  2. Is it a valid Master Secret in `api_keys`?
 */
export async function verifyUserApiKey(req: Request): Promise<{
  userId: string;
  orgId: string;
  error?: NextResponse;
}> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      userId: "",
      orgId: "",
      error: secureJson({ error: "UNAUTHORIZED", message: "Missing or malformed Authorization header." }, { status: 401 }),
    };
  }

  const tokenCandidate = authHeader.split(" ")[1];

  if (!adminDb || !adminAuth) {
    console.error("[SECURITY] Firebase Admin not fully initialized.");
    return {
      userId: "",
      orgId: "",
      error: secureJson({ error: "SERVER_ERROR", message: "Auth service not available." }, { status: 500 }),
    };
  }

  try {
    // 🛡️ 1. Try Firebase ID Token first (Dashboard / Workstation)
    try {
      const decodedToken = await adminAuth.verifyIdToken(tokenCandidate);
      return {
        userId: decodedToken.uid,
        orgId: (decodedToken.org_id as string) || "default",
      };
    } catch (e: any) {
      console.warn(`[SECURITY] ID Token verification failed: ${e.message}. Attempting API Key fallback.`);
      // Not a Firebase token, continue to API Key check
    }

    // 🛡️ 2. Try API Key / Master Secret (External Agents)
    const crypto = await import("crypto");
    const hashedCandidate = crypto.createHash("sha256").update(tokenCandidate).digest("hex");

    const snap = await adminDb
      .collection("api_keys")
      .where("hashed_secret", "==", hashedCandidate)
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snap.empty) {
      return {
        userId: "",
        orgId: "",
        error: secureJson({ error: "UNAUTHORIZED_KEY", message: "Invalid token or master secret." }, { status: 403 }),
      };
    }

    const keyData = snap.docs[0].data();
    return {
      userId: keyData.user_id,
      orgId: keyData.org_id || "default",
    };
  } catch (error) {
    console.error("[SECURITY] Auth lookup failed:", error);
    return {
      userId: "",
      orgId: "",
      error: secureJson({ error: "AUTH_SERVICE_UNAVAILABLE" }, { status: 503 }),
    };
  }
}


// ─── Input Sanitisation ───────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 8_000;  // ~2k tokens
const MAX_STRING_LENGTH = 512;

/** Trim and enforce max length on a string field. Throws a typed error if invalid. */
export function sanitiseString(
  value: unknown,
  field: string,
  maxLength = MAX_STRING_LENGTH
): string {
  if (typeof value !== "string") {
    throw Object.assign(new Error(`INVALID_FIELD_TYPE:${field}`), { statusHint: 400 });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw Object.assign(new Error(`EMPTY_FIELD:${field}`), { statusHint: 400 });
  }
  if (trimmed.length > maxLength) {
    throw Object.assign(new Error(`FIELD_TOO_LONG:${field}`), { statusHint: 400 });
  }
  return trimmed;
}

export function sanitisePrompt(value: unknown): string {
  return sanitiseString(value, "prompt", MAX_PROMPT_LENGTH);
}

/** Validate that a user_id looks like a Firebase UID (20–128 alphanumeric/dash chars) */
export function sanitiseUserId(value: unknown): string {
  const uid = sanitiseString(value, "user_id", 128);
  // Firebase UIDs are 28-char strings; allow dash/underscore for compatibility
  if (!/^[a-zA-Z0-9_\-]{4,128}$/.test(uid)) {
    throw Object.assign(new Error("INVALID_USER_ID_FORMAT"), { statusHint: 400 });
  }
  return uid;
}

// ─── Safe Error Response ──────────────────────────────────────────────────────
// Never leak stack traces, file paths, or internal node_module names.

export function safeErrorResponse(
  error: unknown,
  context: string,
  defaultStatus = 500
): NextResponse {
  const err = error instanceof Error ? error : new Error(String(error));
  const code = err.message.split(":")[0]; // e.g. "ENVELOPE_NOT_FOUND"
  const statusHint = (err as { statusHint?: number }).statusHint;

  // Determine HTTP status from error code prefix
  const status = statusHint ?? inferStatus(code, defaultStatus);

  // Log full error server-side (never sent to client)
  console.error(`[${context}]`, err.message);

  return secureJson({ error: code, context }, { status });
}

function inferStatus(code: string, fallback: number): number {
  if (
    code.startsWith("INVALID_") ||
    code.startsWith("MISSING_") ||
    code.startsWith("EMPTY_") ||
    code.startsWith("FIELD_TOO_LONG") ||
    code.startsWith("COO_") ||
    code.startsWith("ROLE_") ||
    code.startsWith("HANDOFF_") ||
    code.startsWith("DISPATCH_")
  ) return 400;

  if (
    code.startsWith("UNAUTHORIZED") ||
    code.startsWith("IDENTITY_") ||
    code.startsWith("EXECUTION_BLOCKED")
  ) return 403;

  if (code.startsWith("ENVELOPE_NOT_FOUND") || code.startsWith("AGENT_NOT_FOUND")) return 404;
  if (code.startsWith("FORK_DETECTED") || code.startsWith("INVALID_TRANSITION")) return 409;

  return fallback;
}
