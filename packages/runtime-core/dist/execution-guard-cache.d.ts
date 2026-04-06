/**
 * Per-process execution guard cache (ACEPLACE spec) — TTL tied to lease expiry or 10s fallback.
 */
import type { ExecutionGuardResult } from "./types";
export declare function getCachedGuard(params: {
    agent_id: string;
    instance_id: string;
    license_id: string;
}): ExecutionGuardResult | null;
export declare function setCachedGuard(params: {
    agent_id: string;
    instance_id: string;
    license_id: string;
}, result: ExecutionGuardResult): void;
export declare function invalidateGuard(params: {
    agent_id: string;
    instance_id: string;
    license_id: string;
}): void;
//# sourceMappingURL=execution-guard-cache.d.ts.map