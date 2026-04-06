"use strict";
/**
 * ACEPLACE Runtime — Phase 2 Constants
 *
 * Updated for envelope-driven runtime:
 * - No LEASES collection (lease embedded in envelope)
 * - No EXECUTION_STEPS collection (steps embedded in envelope)
 * - EXECUTION_ENVELOPES is the canonical collection
 *
 * Phase 2 | Envelope-Driven Runtime
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_DEFINITIONS = exports.STEP_STATUS_DISPLAY = exports.ENVELOPE_STATUS_DISPLAY = exports.MAX_LEASE_DURATION_SECONDS = exports.DEFAULT_LEASE_DURATION_SECONDS = exports.PROTOCOL_VERB_LABELS = exports.ALLOWED_PROTOCOL_VERBS = exports.DEFAULT_STEP_PIPELINE = exports.STEP_TYPE_CONFIG = exports.STEP_STATUS_TRANSITIONS = exports.ENVELOPE_STATUS_TRANSITIONS = exports.COLLECTIONS = void 0;
// ─── Firestore Collection Names ───────────────────────────────────────────────
// LEASES and EXECUTION_STEPS are DEPRECATED — data now lives inside the envelope.
exports.COLLECTIONS = {
    EXECUTION_ENVELOPES: "execution_envelopes", // ← Primary collection (Phase 2)
    AGENTS: "agents", // Agent identity store
    ARTIFACTS: "artifacts", // Artifact pipeline outputs
    EXECUTION_TRACES: "execution_traces", // Trace log (keep)
    PROTOCOL_MESSAGES: "protocol_messages", // #us# message log (legacy path)
    EXECUTION_MESSAGES: "execution_messages", // #us# canonical persistence (spec)
    JOBS: "jobs", // Legacy — UI pointer only (read-only)
    JOB_TRACES: "job_traces", // Legacy — UI display only
    LICENSE_AUDIT_EVENTS: "license_audit_events",
    LICENSES: "licenses",
    TELEMETRY_EVENTS: "telemetry_events",
    TELEMETRY_ROLLUPS: "telemetry_rollups",
    ENVELOPE_METRICS: "envelope_metrics",
    AGENT_METRICS: "agent_metrics",
    SECRETS: "secrets",
    // AUDIT FIX P1#5: Previously undocumented collections — now first-class constants.
    EXECUTION_QUEUE: "execution_queue", // runtime-worker polling queue (written by web, read by worker)
    API_KEYS: "api_keys", // service-level API key store (auth for runtime routes)
};
// ─── Envelope Status State Machine ────────────────────────────────────────────
// Strict transitions — MUST be enforced atomically. No skipping allowed.
exports.ENVELOPE_STATUS_TRANSITIONS = {
    created: ["leased", "failed"],
    leased: ["planned", "quarantined", "failed"],
    planned: ["executing", "failed"],
    executing: ["awaiting_human", "approved", "completed", "failed", "quarantined"],
    awaiting_human: ["approved", "rejected", "failed"],
    approved: [], // terminal
    completed: [], // terminal (canonical success — multi-agent path)
    rejected: [], // terminal
    failed: [], // terminal
    quarantined: [], // terminal — requires manual intervention
};
// ─── Step Status Transitions ──────────────────────────────────────────────────
exports.STEP_STATUS_TRANSITIONS = {
    pending: ["ready", "failed"],
    ready: ["executing", "failed"],
    executing: ["completed", "failed"],
    awaiting_human: ["completed", "failed"],
    completed: [],
    failed: [],
    blocked: ["ready", "failed"],
    skipped: [],
};
// ─── Step Type Config ─────────────────────────────────────────────────────────
// Maps step_type → required #us# protocol verb
exports.STEP_TYPE_CONFIG = {
    // ── Python STEP_HANDLERS keys (canonical source of truth) ──────────────────
    plan: {
        label: "Strategic Plan",
        protocol_verb: "#us#.task.plan",
        agent_role: "coo",
        icon: "Activity",
        color: "#00E5FF",
    },
    assign: {
        label: "Research Assignment",
        protocol_verb: "#us#.task.assign",
        agent_role: "researcher",
        icon: "Search",
        color: "#2DFF9B",
    },
    artifact_produce: {
        label: "Artifact Production",
        protocol_verb: "#us#.artifact.produce",
        agent_role: "worker",
        icon: "Cpu",
        color: "#FF9E4D",
    },
    evaluation: {
        label: "Grader Evaluation",
        protocol_verb: "#us#.evaluation.score",
        agent_role: "grader",
        icon: "GraduationCap",
        color: "#7CFF6B",
    },
    // ── Legacy aliases (keep for backward compat) ────────────────────────────
    produce_artifact: {
        label: "Artifact Production",
        protocol_verb: "#us#.artifact.produce",
        agent_role: "worker",
        icon: "Cpu",
        color: "#FF9E4D",
    },
    evaluate: {
        label: "Evaluation",
        protocol_verb: "#us#.evaluation.score",
        agent_role: "grader",
        icon: "GraduationCap",
        color: "#7CFF6B",
    },
    human_approval: {
        label: "Human Approval",
        protocol_verb: "#us#.task.plan",
        agent_role: "coo",
        icon: "UserCircle",
        color: "#94A3B8",
    },
    complete: {
        label: "Complete",
        protocol_verb: "#us#.execution.complete",
        agent_role: "coo",
        icon: "CheckCircle",
        color: "#34D399",
    },
};
// ─── Default Step Pipeline ────────────────────────────────────────────────────
// All steps default status is "pending". First step auto-advances to "ready".
// Canonical step order matching Python STEP_HANDLERS
exports.DEFAULT_STEP_PIPELINE = [
    "plan",
    "assign",
    "artifact_produce",
    "evaluation",
];
// ─── #us# Protocol Verbs ──────────────────────────────────────────────────────
// ONLY these five verbs are legal. All others MUST be rejected.
exports.ALLOWED_PROTOCOL_VERBS = [
    "#us#.task.plan",
    "#us#.task.assign",
    "#us#.artifact.produce",
    "#us#.evaluation.score",
    "#us#.execution.complete",
];
exports.PROTOCOL_VERB_LABELS = {
    "#us#.task.plan": "Task Planning",
    "#us#.task.assign": "Task Assignment",
    "#us#.artifact.produce": "Artifact Production",
    "#us#.evaluation.score": "Evaluation Scoring",
    "#us#.execution.complete": "Execution Complete",
};
// ─── Lease Configuration ──────────────────────────────────────────────────────
exports.DEFAULT_LEASE_DURATION_SECONDS = 300; // 5 minutes
exports.MAX_LEASE_DURATION_SECONDS = 1800; // 30 minutes
// ─── Status Display Config ────────────────────────────────────────────────────
exports.ENVELOPE_STATUS_DISPLAY = {
    created: { label: "CREATED", color: "text-slate-400", bgColor: "bg-slate-400/10", borderColor: "border-slate-400/50" },
    leased: { label: "LEASE ACTIVE", color: "text-purple-400", bgColor: "bg-purple-400/10", borderColor: "border-purple-400/50" },
    planned: { label: "PLANNED", color: "text-cyan-400", bgColor: "bg-cyan-400/10", borderColor: "border-cyan-400/50" },
    executing: { label: "EXECUTING", color: "text-amber-400", bgColor: "bg-amber-400/10", borderColor: "border-amber-400/50" },
    awaiting_human: { label: "AWAITING REVIEW", color: "text-orange-400", bgColor: "bg-orange-400/10", borderColor: "border-orange-400/50" },
    approved: { label: "APPROVED", color: "text-emerald-400", bgColor: "bg-emerald-400/10", borderColor: "border-emerald-400/50" },
    completed: { label: "COMPLETED", color: "text-emerald-400", bgColor: "bg-emerald-400/10", borderColor: "border-emerald-400/50" },
    rejected: { label: "REJECTED", color: "text-red-400", bgColor: "bg-red-400/10", borderColor: "border-red-400/50" },
    failed: { label: "FAILED", color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/50" },
    quarantined: { label: "QUARANTINED", color: "text-red-600", bgColor: "bg-red-600/10", borderColor: "border-red-600/50" },
};
exports.STEP_STATUS_DISPLAY = {
    pending: { label: "PENDING", color: "text-slate-500" },
    ready: { label: "READY", color: "text-cyan-400" },
    executing: { label: "Executing", color: "#4DD9FF" },
    completed: { label: "Completed", color: "#7CFF6B" },
    failed: { label: "Failed", color: "#FF4D4D" },
    awaiting_human: { label: "Awaiting Approval", color: "#FFC857" },
    blocked: { label: "Blocked", color: "#FF9E4D" },
    skipped: { label: "Skipped", color: "#94A3B8" }
};
// ─── Tier Definitions (UI display) ────────────────────────────────────────────
exports.TIER_DEFINITIONS = {
    0: { name: "Observer", color: "text-slate-400" },
    1: { name: "Operator", color: "text-cyan-400" },
    2: { name: "Sovereign", color: "text-amber-400" },
};
//# sourceMappingURL=constants.js.map