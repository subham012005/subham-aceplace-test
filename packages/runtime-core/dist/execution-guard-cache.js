"use strict";
/**
 * Per-process execution guard cache (ACEPLACE spec) — TTL tied to lease expiry or 10s fallback.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedGuard = getCachedGuard;
exports.setCachedGuard = setCachedGuard;
exports.invalidateGuard = invalidateGuard;
const guardCache = new Map();
function keyOf(p) {
    return `${p.agent_id}:${p.instance_id}:${p.license_id}`;
}
function getCachedGuard(params) {
    const k = keyOf(params);
    const e = guardCache.get(k);
    if (!e)
        return null;
    if (Date.now() > e.expiresAt) {
        guardCache.delete(k);
        return null;
    }
    return e.result;
}
function setCachedGuard(params, result) {
    const leaseExpiry = result.lease?.lease_expires_at
        ? new Date(result.lease.lease_expires_at).getTime()
        : Date.now() + 10_000;
    guardCache.set(keyOf(params), {
        result,
        expiresAt: Math.min(leaseExpiry, Date.now() + 60_000),
    });
}
function invalidateGuard(params) {
    guardCache.delete(keyOf(params));
}
//# sourceMappingURL=execution-guard-cache.js.map