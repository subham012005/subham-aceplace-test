/**
 * ACELOGIC control plane types (Tier 0–2) — aligned with api docs requ / ACEPLACE API.
 */
export type LicenseTier = "free" | "builder" | "growth";
export type DeploymentMode = "hosted_control_plane";
export type LicenseStatus = "active" | "suspended" | "expired" | "revoked";
export interface LicenseManifest {
    license_id: string;
    org_id: string;
    tier: LicenseTier;
    deployment_mode: DeploymentMode;
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
    status: LicenseStatus;
    issued_at: string;
    expires_at: string | null;
}
//# sourceMappingURL=types.d.ts.map