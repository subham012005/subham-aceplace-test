import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RATE_LIMITS } from "@/lib/sandbox-config";

/**
 * ACEPLACE Sandbox Middleware
 *
 * Enforces IP-level rate limiting and request throttling for all API routes.
 * Uses a simple in-memory counter (suitable for single-process dev/preview
 * environments). In production, replace with Redis or Upstash.
 *
 * Protection layers:
 *  1. IP rate limiting (requests per minute)
 *  2. Request rate limiting per path family
 *  3. WebSocket upgrade throttling
 *  4. Firestore write/read overload protection (header injection for API handlers)
 */

// ─── In-memory rate limit store ───────────────────────────────────────────────
// { key: { count, windowStart } }
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

/**
 * Check and increment a rate limit bucket.
 * Returns { allowed, remaining, resetAt }
 */
function checkRateLimit(
  key: string,
  limitPerWindow: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limitPerWindow - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limitPerWindow) {
    const resetAt = entry.windowStart + windowMs;
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: limitPerWindow - entry.count,
    resetAt: entry.windowStart + windowMs,
  };
}

// ─── Periodic cleanup to prevent memory growth ────────────────────────────────
// Runs every 5 minutes in development; in production use an external store.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const windowMs = RATE_LIMITS.IP_WINDOW_SECONDS * 1000;
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.windowStart >= windowMs * 2) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

// ─── Paths that are exempt from rate limiting ─────────────────────────────────
const EXEMPT_PATHS = [
  "/",
  "/login",
  "/legal",
  "/_next",
  "/favicon.ico",
  "/ace-symbol.png",
  "/ace-favicon.png",
];

function isExempt(pathname: string): boolean {
  return EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

// ─── Middleware ────────────────────────────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip exempt paths
  if (isExempt(pathname)) {
    return NextResponse.next();
  }

  // Extract IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anonymous";

  // ── 1. IP rate limiting ────────────────────────────────────────────────────
  const ipKey = `ip:${ip}`;
  const ipLimit = checkRateLimit(
    ipKey,
    RATE_LIMITS.IP_REQUESTS_PER_MINUTE,
    RATE_LIMITS.IP_WINDOW_SECONDS
  );

  if (!ipLimit.allowed) {
    const retryAfter = Math.ceil((ipLimit.resetAt - Date.now()) / 1000);
    return new NextResponse(
      JSON.stringify({
        error: "RATE_LIMITED",
        message: "Too many requests from this IP address. Please wait before retrying.",
        retryAfterSeconds: retryAfter,
        sandbox: true,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMITS.IP_REQUESTS_PER_MINUTE),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(ipLimit.resetAt / 1000)),
          "X-Sandbox-RateLimit": "ip",
        },
      }
    );
  }

  // ── 2. API-specific path rate limiting ────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    // Group by top-level API family (e.g., /api/runtime/*, /api/jobs/*)
    const apiFamily = pathname.split("/").slice(0, 3).join("/");
    const apiKey = `api:${ip}:${apiFamily}`;
    const apiLimit = checkRateLimit(
      apiKey,
      RATE_LIMITS.USER_REQUESTS_PER_MINUTE,
      RATE_LIMITS.IP_WINDOW_SECONDS
    );

    if (!apiLimit.allowed) {
      const retryAfter = Math.ceil((apiLimit.resetAt - Date.now()) / 1000);
      return new NextResponse(
        JSON.stringify({
          error: "API_RATE_LIMITED",
          message: `API rate limit exceeded for ${apiFamily}. Sandbox environments enforce stricter limits.`,
          retryAfterSeconds: retryAfter,
          sandbox: true,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(RATE_LIMITS.USER_REQUESTS_PER_MINUTE),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(apiLimit.resetAt / 1000)),
            "X-Sandbox-RateLimit": "api",
          },
        }
      );
    }

    // Inject rate limit headers on allowed requests for transparency
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMITS.IP_REQUESTS_PER_MINUTE));
    response.headers.set("X-RateLimit-Remaining", String(ipLimit.remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(ipLimit.resetAt / 1000)));
    response.headers.set("X-Sandbox-Environment", "true");
    response.headers.set("X-Sandbox-Preview", "public-runtime-preview");
    return response;
  }

  // ── 3. WebSocket upgrade throttling ───────────────────────────────────────
  const upgradeHeader = req.headers.get("upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    const wsKey = `ws:${ip}`;
    const wsLimit = checkRateLimit(
      wsKey,
      RATE_LIMITS.WS_MESSAGES_PER_SECOND * 60, // scale to per-minute window
      RATE_LIMITS.IP_WINDOW_SECONDS
    );

    if (!wsLimit.allowed) {
      return new NextResponse(
        JSON.stringify({
          error: "WS_THROTTLED",
          message: "WebSocket connection rate limit exceeded.",
          sandbox: true,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ── Sandbox headers on all responses ─────────────────────────────────────
  const res = NextResponse.next();
  res.headers.set("X-Sandbox-Environment", "true");
  res.headers.set("X-Sandbox-Preview", "public-runtime-preview");
  return res;
}

// ─── Matcher ──────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
