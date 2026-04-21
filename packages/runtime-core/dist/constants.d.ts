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
import type { EnvelopeStatus, StepStatus, ProtocolVerb } from "./types";
export declare const COLLECTIONS: {
    readonly EXECUTION_ENVELOPES: "execution_envelopes";
    readonly AGENTS: "agents";
    readonly ARTIFACTS: "artifacts";
    readonly EXECUTION_TRACES: "execution_traces";
    readonly PROTOCOL_MESSAGES: "protocol_messages";
    readonly EXECUTION_MESSAGES: "execution_messages";
    readonly JOBS: "jobs";
    readonly JOB_TRACES: "job_traces";
    readonly LICENSE_AUDIT_EVENTS: "license_audit_events";
    readonly LICENSES: "licenses";
    readonly TELEMETRY_EVENTS: "telemetry_events";
    readonly TELEMETRY_ROLLUPS: "telemetry_rollups";
    readonly ENVELOPE_METRICS: "envelope_metrics";
    readonly AGENT_METRICS: "agent_metrics";
    readonly SECRETS: "secrets";
    readonly EXECUTION_QUEUE: "execution_queue";
    readonly API_KEYS: "api_keys";
};
export declare const ENVELOPE_STATUS_TRANSITIONS: Record<EnvelopeStatus, EnvelopeStatus[]>;
export declare const STEP_STATUS_TRANSITIONS: Record<StepStatus, StepStatus[]>;
export declare const STEP_TYPE_CONFIG: Record<string, {
    label: string;
    protocol_verb: ProtocolVerb;
    agent_role: string;
    icon: string;
    color: string;
}>;
export declare const DEFAULT_STEP_PIPELINE: string[];
export declare const ALLOWED_PROTOCOL_VERBS: readonly ProtocolVerb[];
export declare const PROTOCOL_VERB_LABELS: Record<ProtocolVerb, string>;
export declare const STALE_CLAIM_THRESHOLD_MS = 120000;
export declare const DEFAULT_LEASE_DURATION_SECONDS = 300;
export declare const MAX_LEASE_DURATION_SECONDS = 1800;
export declare const STEP_EXECUTION_MIN_WINDOW_MS = 20000;
export declare const ENVELOPE_STATUS_DISPLAY: Record<EnvelopeStatus, {
    label: string;
    color: string;
    bgColor: string;
    borderColor: string;
}>;
export declare const STEP_STATUS_DISPLAY: Record<StepStatus, {
    label: string;
    color: string;
}>;
export declare const TIER_DEFINITIONS: Record<number, {
    name: string;
    color: string;
}>;
//# sourceMappingURL=constants.d.ts.map