/**
 * ACELOGIC execution guard — internal service (default), optional remote ACELOGIC_API_URL, with cache.
 */
import type { ExecutionGuardResult } from "./types";
export declare function acelogicExecutionGuard(params: {
    agent_id: string;
    identity_fingerprint: string;
    instance_id: string;
    org_id: string;
    license_id: string;
}): Promise<ExecutionGuardResult>;
//# sourceMappingURL=acelogic-guard.d.ts.map