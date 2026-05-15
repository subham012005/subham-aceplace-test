/**
 * ACEPLACE Sandbox Configuration
 * Public Runtime Preview — Developer Sandbox
 *
 * All limits and caps for the sandbox environment.
 * These apply globally and are enforced server-side.
 */

// ─── Terms Version ────────────────────────────────────────────────────────────
export const TERMS_VERSION = "2026-05-15-v1";

// ─── Usage Limits (per user, per day) ─────────────────────────────────────────
export const USAGE_LIMITS = {
  /** Maximum job executions a user may trigger per calendar day (UTC). */
  MAX_EXECUTIONS_PER_DAY: 25,

  /** Maximum concurrently active runtime envelopes per user. */
  MAX_ACTIVE_RUNTIME_ENVELOPES: 3,

  /** Minimum seconds between successive execution dispatches (cooldown). */
  COOLDOWN_BETWEEN_EXECUTIONS_SECONDS: 30,

  /** Maximum total steps that can be queued across all active envelopes. */
  EXECUTION_QUOTA_TOTAL_STEPS: 100,
} as const;

// ─── IP / Request Rate Limits ─────────────────────────────────────────────────
export const RATE_LIMITS = {
  /** Max requests per IP per minute (window = 60s). */
  IP_REQUESTS_PER_MINUTE: 60,

  /** Max API requests per authenticated user per minute. */
  USER_REQUESTS_PER_MINUTE: 40,

  /** Max WebSocket messages per connection per second. */
  WS_MESSAGES_PER_SECOND: 10,

  /** Window for IP rate-limit reset (seconds). */
  IP_WINDOW_SECONDS: 60,
} as const;

// ─── Storage / Artifact Limits ────────────────────────────────────────────────
export const STORAGE_LIMITS = {
  /** Max bytes of artifact storage per user. (~10 MB) */
  MAX_ARTIFACT_BYTES_PER_USER: 10 * 1024 * 1024,

  /** Hours before an artifact is auto-expired if not accessed. */
  ARTIFACT_EXPIRATION_HOURS: 48,

  /** Minutes of inactivity before a session is auto-cleaned. */
  SESSION_INACTIVITY_CLEANUP_MINUTES: 120,

  /** Max temporary artifacts retained per job. */
  MAX_ARTIFACTS_PER_JOB: 20,
} as const;

// ─── Firestore Protection Caps ────────────────────────────────────────────────
export const FIRESTORE_CAPS = {
  /** Max Firestore writes allowed per user per hour. */
  MAX_WRITES_PER_USER_PER_HOUR: 500,

  /** Max Firestore reads allowed per user per hour. */
  MAX_READS_PER_USER_PER_HOUR: 2000,

  /** Max telemetry events stored per user per day. */
  MAX_TELEMETRY_EVENTS_PER_DAY: 1000,

  /** Queue depth threshold before new envelopes are rejected. */
  QUEUE_OVERLOAD_THRESHOLD: 50,

  /** Max runtime envelopes stored per user (hard cap, including historical). */
  MAX_ENVELOPES_PER_USER: 200,
} as const;

// ─── Sandbox Notice Messages ──────────────────────────────────────────────────
export const SANDBOX_NOTICES = [
  "Public sandbox sessions may be rate limited, reset, or terminated without notice.",
  "Users are responsible for their own API provider credentials and usage costs.",
  "Runtime inference is powered by user-provided API credentials. ACEPLACE does not store or access your keys beyond the session.",
] as const;

// ─── Policy Links ─────────────────────────────────────────────────────────────
export const POLICY_LINKS = {
  TERMS_CONDITIONS: "/legal/terms",
  PRIVACY_POLICY: "/legal/privacy",
  ACCEPTABLE_USE: "/legal/acceptable-use",
  RUNTIME_USAGE: "/legal/runtime-usage",
} as const;
