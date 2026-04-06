import type { LicenseManifest } from "./types";
export declare function checkCapability(license: LicenseManifest, capability: string, requiredGate?: number): {
    ok: boolean;
    reason?: string;
};
export declare function auditLicenseCheck(params: {
    license: LicenseManifest;
    route: string;
    capability: string;
    requiredGate: number | null;
    outcome: "allowed" | "denied";
    reason: string | null;
    runtimeId: string | null;
}): Promise<void>;
//# sourceMappingURL=capability.d.ts.map