"use strict";
/**
 * ACELOGIC execution guard — internal service (default), optional remote ACELOGIC_API_URL, with cache.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.acelogicExecutionGuard = acelogicExecutionGuard;
const service_1 = require("./acelogic/service");
const execution_guard_cache_1 = require("./execution-guard-cache");
if (typeof process !== "undefined" && !process.env.ACELOGIC_API_URL) {
    console.warn("[ACELOGIC] ACELOGIC_API_URL is not set. Falling back to in-process execution guard. This is RECOMMENDED FOR DEVELOPMENT ONLY.");
}
function isCapabilityDenied(status, body) {
    if (status !== 403)
        return false;
    const err = body?.error;
    return err === "CAPABILITY_DENIED" || err === "GATE_DENIED";
}
function inferGateFromLease(lease) {
    if (!lease)
        return 1;
    if (lease.status === "active")
        return 5;
    return 1;
}
async function callRemoteAceLogic(params) {
    const base = process.env.ACELOGIC_API_URL.replace(/\/+$/, "");
    const headers = {
        "Content-Type": "application/json",
        "x-license-id": params.license_id,
        "x-org-id": params.org_id,
    };
    const identityRes = await fetch(`${base}/acelogic/identity/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            agent_id: params.agent_id,
            identity_fingerprint: params.identity_fingerprint,
            instance_id: params.instance_id,
        }),
    });
    const identityJson = (await identityRes.json());
    if (!identityRes.ok || !identityJson.valid) {
        return {
            allowed: false,
            identity_context: {
                agent_id: params.agent_id,
                identity_fingerprint: params.identity_fingerprint,
                instance_id: params.instance_id,
                gate_level: 0,
            },
            lease: null,
        };
    }
    let lease = null;
    try {
        const leaseRes = await fetch(`${base}/acelogic/authority/lease/acquire`, {
            method: "POST",
            headers,
            body: JSON.stringify({
                agent_id: params.agent_id,
                instance_id: params.instance_id,
            }),
        });
        const leaseJson = (await leaseRes.json());
        if (leaseRes.ok && leaseJson.lease_id) {
            lease = {
                lease_id: leaseJson.lease_id,
                lease_expires_at: leaseJson.lease_expires_at ||
                    new Date(Date.now() + 60_000).toISOString(),
                status: leaseJson.status ?? "active",
            };
        }
        else if (isCapabilityDenied(leaseRes.status, leaseJson)) {
            lease = null;
        }
        else if (!leaseRes.ok) {
            throw new Error(`ACELOGIC_LEASE_HTTP_${leaseRes.status}`);
        }
    }
    catch (e) {
        if (e instanceof Error && e.message.startsWith("ACELOGIC_LEASE_HTTP_"))
            throw e;
        lease = null;
    }
    return {
        allowed: true,
        identity_context: {
            agent_id: params.agent_id,
            identity_fingerprint: params.identity_fingerprint,
            instance_id: params.instance_id,
            gate_level: inferGateFromLease(lease),
        },
        lease,
    };
}
async function acelogicExecutionGuard(params) {
    const cached = (0, execution_guard_cache_1.getCachedGuard)(params);
    if (cached)
        return cached;
    let result;
    const remote = process.env.ACELOGIC_API_URL?.replace(/\/+$/, "");
    if (remote) {
        result = await callRemoteAceLogic(params);
    }
    else {
        result = await (0, service_1.runAceLogicExecutionGuard)(params);
    }
    if (!result.allowed) {
        (0, execution_guard_cache_1.invalidateGuard)(params);
        return result;
    }
    (0, execution_guard_cache_1.setCachedGuard)(params, result);
    return result;
}
//# sourceMappingURL=acelogic-guard.js.map