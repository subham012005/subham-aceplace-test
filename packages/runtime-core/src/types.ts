/**
 * ACEPLACE Runtime — Phase 2 TypeScript Type Definitions
 *
 * Canonical ExecutionEnvelope is the ONLY source of truth.
 * Steps are EMBEDDED inside the envelope (not external).
 * Lease is EMBEDDED inside the envelope (not separate collection).
 *
 * Phase 2 | Envelope-Driven Runtime
 */

// ─── #us# Protocol Verbs ──────────────────────────────────────────────────────
// ONLY these five verbs are allowed. Any other message type is rejected.

export type ProtocolVerb =
  | "#us#.task.plan"
  | "#us#.task.assign"
  | "#us#.artifact.produce"
  | "#us#.evaluation.score"
  | "#us#.execution.complete";

// ─── Embedded Authority Lease ─────────────────────────────────────────────────
// Lease lives INSIDE the envelope. No separate leases collection.
// Legacy single-envelope lease uses holder_instance_id / expires_at.
// Per-agent leases (multi-agent) use AgentAuthorityLease in authority_leases map.

export interface AuthorityLease {
  holder_instance_id: string;
  leased_at: string;        // ISO timestamp
  expires_at: string;       // ISO timestamp
}

/** Per-agent authority binding (ACEPLACE RUNTIME spec) */
export interface AgentAuthorityLease {
  lease_id: string;
  agent_id: string;
  current_instance_id: string;
  lease_expires_at: string;
  acquired_at: string;
  last_renewed_at: string;
  status?: "active" | "expired" | "revoked";
}

// ─── Embedded Envelope Step ───────────────────────────────────────────────────
// Steps live INSIDE the envelope.steps[]. No external execution_steps collection.

export type StepType =
  | "plan"
  | "assign"
  | "artifact_produce"      // ← Python canonical (artifact_produce step)
  | "evaluation"            // ← Python canonical (grader step)
  | "produce_artifact"      // ← Legacy alias
  | "evaluate"              // ← Legacy alias
  | "human_approval"
  | "complete";

export type StepStatus =
  | "pending"
  | "ready"
  | "executing"
  | "awaiting_human"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped";

/** Structured step I/O (ACEPLACE canonical); string form kept for legacy steps */
export interface EnvelopeStepIoRef {
  message_id?: string | null;
  artifact_id?: string | null;
  artifact_ids?: string[];
  work_unit?: Record<string, unknown> | null;
}

export type RuntimeRole = "COO" | "Researcher" | "Worker" | "Grader";

export interface EnvelopeStep {
  step_id: string;
  step_type: StepType;
  status: StepStatus;
  assigned_agent_id: string;
  depends_on?: string[];
  role?: RuntimeRole;
  retry_count?: number;
  max_retries?: number;
  claimed_by_instance_id?: string | null;
  claimed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  input_ref?: string | EnvelopeStepIoRef;
  output_ref?: string | EnvelopeStepIoRef;
}

// ─── Identity Context ─────────────────────────────────────────────────────────

export interface IdentityContext {
  agent_id: string;
  identity_fingerprint: string;   // SHA-256 of canonical_identity_json
  /** @alias identity_fingerprint — UI compat */
  fingerprint?: string;
  verified: boolean;
  verified_at?: string;
  /** Multi-agent / ACEPLACE handoff */
  instance_id?: string;
  gate_level?: number;
  jurisdiction?: string;
}

// ─── Envelope Status State Machine ────────────────────────────────────────────
// Strict transitions — no skipping states.
// created → leased → planned → executing → awaiting_human → approved|rejected|failed|quarantined

export type EnvelopeStatus =
  | "created"
  | "leased"
  | "planned"
  | "executing"
  | "awaiting_human"
  | "approved"
  | "completed"
  | "rejected"
  | "failed"
  | "quarantined";

// ─── Canonical Execution Envelope ─────────────────────────────────────────────
// THIS IS THE ONLY SOURCE OF TRUTH FOR ALL EXECUTION STATE.

export type AggregationStrategy =
  | "merge_in_order"
  | "sectioned_report"
  | "summary_of_summaries";

export interface WorkUnit {
  work_unit_id: string;
  title: string;
  objective: string;
  instructions: string;
}

export interface DecompositionPlan {
  decomposition_id: string;
  parent_step_id: string;
  worker_agent_ids: string[];
  work_units: WorkUnit[];
  aggregation: {
    strategy: AggregationStrategy;
    ordered_work_unit_ids: string[];
  };
}

export interface ExecutionEnvelope {
  envelope_id: string;
  org_id: string;
  status: EnvelopeStatus;

  license_id?: string;
  root_task_id?: string;
  coordinator_agent_id?: string;
  multi_agent?: boolean;
  identity_contexts?: Record<string, IdentityContext>;
  authority_leases?: Record<string, AgentAuthorityLease | null>;
  decomposition_plan?: DecompositionPlan | null;

  // Steps EMBEDDED — NOT in external collection
  steps: EnvelopeStep[];

  // Lease EMBEDDED — NOT in external collection
  authority_lease: AuthorityLease | null;

  // Identity
  identity_context: IdentityContext;

  // Artifact references produced during execution
  artifact_refs: string[];

  // Hash chain for tamper detection
  trace_head_hash: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Legacy link fields (read-only for UI, not used for execution)
  job_id?: string;
  user_id?: string;
  prompt?: string;

  // ─── Phase 1 Backward-Compat (read-only UI display) ────────────────────────
  // These are optional nullable fields purely for UI components that haven't
  // been migrated yet. Never write to these from the runtime.
  /** @deprecated Use envelope.status instead */
  execution_context?: {
    status: string;
    [key: string]: unknown;
  };
  /** @deprecated Use envelope.authority_lease instead */
  authority_context?: {
    lease_id?: string;
    [key: string]: unknown;
  };
  /** @deprecated Derive from steps[] via status==='executing' */
  current_step_id?: string;
}


// ─── #us# Protocol Message ────────────────────────────────────────────────────
// ALL protocol messages MUST match this structure.
// Free-form messages are rejected.

export interface ProtocolMessage {
  message_id: string;
  protocol: "#us#";
  version: "1.0";
  message_type: ProtocolVerb;
  execution: {
    envelope_id: string;
    step_id: string;
  };
  identity: {
    agent_id: string;
    identity_fingerprint: string;
  };
  authority: {
    lease_holder: string;     // instance_id that holds the lease
  };
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/** Canonical #us# message shape (Message Engine spec) — persisted to execution_messages */
export interface USMessage {
  protocol: "#us#";
  version: "1.0";
  message_type: ProtocolVerb;
  execution: { envelope_id: string; step_id: string };
  identity: { agent_id: string; identity_fingerprint: string };
  authority: { lease_id?: string };
  payload: Record<string, unknown>;
  metadata: { timestamp: string };
}

export type ExecutionGuardResult = {
  allowed: boolean;
  identity_context: {
    agent_id: string;
    identity_fingerprint: string;
    instance_id: string;
    gate_level: number;
  };
  lease?: {
    lease_id: string;
    lease_expires_at: string;
    status?: "active" | "expired" | "revoked";
  } | null;
};

// ─── Artifact ─────────────────────────────────────────────────────────────────
// All outputs MUST be stored in artifacts/{artifact_id}.

export interface Artifact {
  artifact_id: string;
  execution_id: string;           // envelope_id
  identity_fingerprint: string;
  produced_by_agent: string;
  artifact_type:
    | "plan"
    | "assignment"
    | "production"
    | "evaluation"
    | "final_result"
    | "other";
  artifact_content: string;
  created_at: string;
}

// ─── Execution Trace ──────────────────────────────────────────────────────────
// Every step execution MUST append a trace.

export interface ExecutionTrace {
  trace_id: string;
  envelope_id: string;
  event_type: string;
  timestamp: string;
  agent_id: string;
  identity_fingerprint: string;
  step_id?: string;
  artifact_id?: string;
  message_id?: string;
  metadata?: Record<string, unknown>;
}

// ─── Agent Identity (stored in agents/{agent_id}) ─────────────────────────────

export interface AgentIdentity {
  agent_id: string;
  display_name: string;
  canonical_identity_json: string;   // JSON string used to compute fingerprint
  identity_fingerprint: string;      // SHA-256(canonical_identity_json)
  /** @alias identity_fingerprint — UI compat */
  fingerprint?: string;
  agent_class: string;
  jurisdiction: string;
  created_at: string;
  last_verified_at?: string;
  // Extended UI fields (stored in agents collection)
  acelogic_id?: string;
  tier?: number;
  mission?: string;
  user_id?: string;   // Owner of the identity (optional for system agents)
}

// ─── Runtime Validation Results ───────────────────────────────────────────────

export interface IdentityVerifyResult {
  verified: boolean;
  agent_id: string;
  reason?: string;
  verified_at: string;
}

export interface LeaseAcquireResult {
  acquired: boolean;
  authority_lease: AuthorityLease | null;
  reason?: "fork_detected" | "already_held" | "ok";
}

// ─── Secrets Management ───────────────────────────────────────────────────────

export interface AgentSecrets {
  agent_id: string;
  secrets: Record<string, string>;
  updated_at: string;
}

export interface SystemApiKey {
  key_id: string;
  hashed_key: string;
  user_id: string;
  status: "active" | "revoked";
  created_at: string;
}

// ─── Dispatch API ─────────────────────────────────────────────────────────────

export interface DispatchRequest {
  prompt: string;
  user_id: string;
  org_id?: string;
  agent_id?: string;
}

export interface DispatchResponse {
  success: boolean;
  envelope_id: string;
  envelope: ExecutionEnvelope;
  message: string;
}

// ─── Legacy Compat ────────────────────────────────────────────────────────────

export type LicenseTier = 0 | 1 | 2;

/** @deprecated Use ExecutionEnvelope.status instead */
export type RuntimeTraceEvent = ExecutionTrace;

/** @deprecated Alias for EnvelopeStep — steps are now embedded in envelope */
export type ExecutionStep = EnvelopeStep & {
  agent_id?: string;
  step_hash?: string;
  started_at?: string;
  completed_at?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
};

/** @deprecated Leases are now embedded in envelope.authority_lease */
export interface ExecutionLease {
  lease_id: string;
  envelope_id: string;
  agent_id: string;
  expires_at: string;
  leased_at: string;
}

/** Lease acquire/release API request types */
export interface LeaseAcquireRequest {
  envelope_id: string;
  instance_id: string;
  duration_seconds?: number;
}
export interface LeaseReleaseRequest {
  lease_id: string;
  envelope_id?: string;
  reason?: string;
}

/** Dashboard stats shape */
export interface RuntimeStats {
  active_leases: number;
  total_envelopes: number;
  executing_envelopes?: number;
  completed_envelopes: number;
  failed_envelopes: number;
  quarantined_envelopes?: number;
  total_steps_completed: number;
  average_step_duration_ms?: number;
}
