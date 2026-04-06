/**
 * Telemetry events + envelope/agent counter rollups (ACEPLACE spec).
 */
export type TelemetryEventType = "ENVELOPE_CREATED" | "ENVELOPE_COMPLETED" | "ENVELOPE_FAILED" | "STEP_CLAIMED" | "STEP_STARTED" | "STEP_COMPLETED" | "STEP_FAILED" | "STEP_RETRY_SCHEDULED" | "LEASE_ACQUIRED" | "LEASE_RENEWED" | "LEASE_RENEW_FAILED" | "LEASE_RELEASED" | "DEAD_STEP_RECOVERED" | "ARTIFACT_CREATED" | "MESSAGE_STORED";
export declare function emitRuntimeMetric(params: {
    event_type: TelemetryEventType;
    envelope_id?: string | null;
    step_id?: string | null;
    agent_id?: string | null;
    org_id?: string | null;
    value?: number | null;
    metadata?: Record<string, unknown>;
}): Promise<void>;
//# sourceMappingURL=emitRuntimeMetric.d.ts.map