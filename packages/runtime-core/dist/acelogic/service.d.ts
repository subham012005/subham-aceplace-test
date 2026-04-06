/**
 * ACELOGIC control plane logic — used by /api/acelogic/* and runtime guard.
 */
import type { ExecutionGuardResult } from "../types";
import type { LicenseManifest } from "./types";
export declare function aceLogicIntrospect(license: LicenseManifest): Promise<{
    license_id: string;
    org_id: string;
    tier: import("./types").LicenseTier;
    deployment_mode: "hosted_control_plane";
    gates: {
        min_gate: number;
        max_gate: number;
    };
    modules: Record<string, boolean>;
    limits: {
        max_agents: number | null;
        max_environments: number | null;
        telemetry_required: boolean;
    };
}>;
export declare function aceLogicVerifyIdentity(params: {
    license: LicenseManifest;
    route: string;
    body: {
        agent_id?: string;
        identity_fingerprint?: string;
        instance_id?: string;
    };
    runtimeId: string | null;
}): Promise<{
    error: string | undefined;
    capability: string;
    valid?: undefined;
    agent_id?: undefined;
    identity_fingerprint?: undefined;
} | {
    error: string;
    capability?: undefined;
    valid?: undefined;
    agent_id?: undefined;
    identity_fingerprint?: undefined;
} | {
    valid: boolean;
    agent_id: string;
    identity_fingerprint: string;
    error?: undefined;
    capability?: undefined;
}>;
export declare function aceLogicLeaseAcquire(params: {
    license: LicenseManifest;
    route: string;
    body: {
        agent_id?: string;
        instance_id?: string;
    };
    runtimeId: string | null;
}): Promise<{
    error: string | undefined;
    capability: string;
    lease_id?: undefined;
    agent_id?: undefined;
    instance_id?: undefined;
    lease_expires_at?: undefined;
    status?: undefined;
} | {
    lease_id: string;
    agent_id: string | undefined;
    instance_id: string | undefined;
    lease_expires_at: string;
    status: "active";
    error?: undefined;
    capability?: undefined;
}>;
export declare function aceLogicLeaseRenew(params: {
    license: LicenseManifest;
    route: string;
    runtimeId: string | null;
}): Promise<{
    error: string | undefined;
    renewed?: undefined;
    lease_expires_at?: undefined;
} | {
    renewed: boolean;
    lease_expires_at: string;
    error?: undefined;
}>;
export declare function aceLogicLeaseRelease(params: {
    license: LicenseManifest;
    route: string;
    runtimeId: string | null;
}): Promise<{
    error: string | undefined;
    released?: undefined;
} | {
    released: boolean;
    error?: undefined;
}>;
export declare function aceLogicResurrectionVerify(params: {
    license: LicenseManifest;
    route: string;
    runtimeId: string | null;
}): Promise<{
    error: string | undefined;
    valid?: undefined;
    status?: undefined;
} | {
    valid: boolean;
    status: "verified";
    error?: undefined;
}>;
/**
 * Unified guard for runtime: identity + optional lease when tier allows fork_detection.
 */
export declare function runAceLogicExecutionGuard(params: {
    agent_id: string;
    identity_fingerprint: string;
    instance_id: string;
    org_id: string;
    license_id: string;
}): Promise<ExecutionGuardResult>;
//# sourceMappingURL=service.d.ts.map