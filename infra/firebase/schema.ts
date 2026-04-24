/**
 * Firestore Schema — Phase 2
 *
 * Canonical collection definitions for the ACEPLACE deterministic runtime.
 * This is the source of truth for all Firestore collection shapes.
 *
 * Phase 2 | Envelope-Driven Runtime
 */

// ─── api_keys Collection ───────────────────────────────────────────────────────
// Stores service-level API keys for authenticating runtime routes.
// Referenced in API docs but was previously missing from schema.

export interface ApiKeyDoc {
  /** Unique identifier for this key (e.g. "key_abc123") */
  key_id: string;
  /** Organisation this key belongs to */
  org_id: string;
  /** Human-readable label (e.g. "CI Worker Key") */
  label: string;
  /** bcrypt-hashed key value — NEVER store plaintext */
  hashed_key: string;
  /** Whether this key is usable */
  status: "active" | "revoked";
  /**
   * Permission scopes granted to this key.
   * Known scopes:
   *   "runtime:dispatch"   — may call POST /api/dispatch
   *   "runtime:read"       — may read envelope/job state
   *   "runtime:admin"      — full administrative access
   */
  scopes: string[];
  created_at: string;
  last_used_at?: string;
  revoked_at?: string;
  revoked_by?: string;
}

// ─── execution_queue Collection ────────────────────────────────────────────────
// Queue of envelopes awaiting worker pickup.
// Written by engine.ts (web tier) — read and claimed by runtime-worker.

export interface ExecutionQueueDoc {
  /** The envelope to execute */
  envelope_id: string;
  /** "queued" → "claimed" → "completed" | "failed" */
  status: "queued" | "claimed" | "completed" | "failed";
  /** ISO timestamp of when the entry was created (by web tier) */
  created_at: string;
  /** Which worker instance claimed this entry */
  claimed_by?: string;
  /** ISO timestamp of when the worker claimed it */
  claimed_at?: string;
  /** ISO timestamp of when execution finished */
  finalized_at?: string;
  /** Error message if execution failed */
  error?: string;
}

// ─── agents Collection ─────────────────────────────────────────────────────────
// Agent identity records. Source of truth for fingerprint verification.

export interface AgentDoc {
  agent_id: string;
  display_name: string;
  /** Canonical JSON string — SHA-256 of this is identity_fingerprint */
  canonical_identity_json: string;
  identity_fingerprint: string;
  agent_class: string;
  jurisdiction: string;
  mission: string;
  tier: number;
  created_at: string;
  last_verified_at: string | null;
}

// ─── Collection name map ───────────────────────────────────────────────────────
// Use this instead of string literals anywhere you reference collection names.

export const COLLECTION_NAMES = {
  EXECUTION_ENVELOPES: "execution_envelopes",
  EXECUTION_QUEUE: "execution_queue",
  EXECUTION_TRACES: "execution_traces",
  AGENTS: "agents",
  ARTIFACTS: "artifacts",
  JOBS: "jobs",
  API_KEYS: "api_keys",
  LICENSES: "licenses",
  LICENSE_AUDIT_EVENTS: "license_audit_events",
  EXECUTION_MESSAGES: "execution_messages",
  TELEMETRY_EVENTS: "telemetry_events",
  TELEMETRY_ROLLUPS: "telemetry_rollups",
  ENVELOPE_METRICS: "envelope_metrics",
  AGENT_METRICS: "agent_metrics",
  SECRETS: "secrets",
} as const;
