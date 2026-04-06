"use strict";
/**
 * ACELOGIC control plane logic — used by /api/acelogic/* and runtime guard.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.aceLogicIntrospect = aceLogicIntrospect;
exports.aceLogicVerifyIdentity = aceLogicVerifyIdentity;
exports.aceLogicLeaseAcquire = aceLogicLeaseAcquire;
exports.aceLogicLeaseRenew = aceLogicLeaseRenew;
exports.aceLogicLeaseRelease = aceLogicLeaseRelease;
exports.aceLogicResurrectionVerify = aceLogicResurrectionVerify;
exports.runAceLogicExecutionGuard = runAceLogicExecutionGuard;
const crypto_1 = require("crypto");
const capability_1 = require("./capability");
const resolve_license_1 = require("./resolve-license");
const LEASE_TTL_MS = 60_000;
function inferGateFromLease(lease) {
    if (!lease)
        return 1;
    if (lease.status === "active")
        return 5;
    return 1;
}
async function aceLogicIntrospect(license) {
    return {
        license_id: license.license_id,
        org_id: license.org_id,
        tier: license.tier,
        deployment_mode: license.deployment_mode,
        gates: license.gates,
        modules: license.modules,
        limits: license.limits,
    };
}
async function aceLogicVerifyIdentity(params) {
    const { license, route, body, runtimeId } = params;
    const cap = (0, capability_1.checkCapability)(license, "identity_core", 1);
    if (!cap.ok) {
        await (0, capability_1.auditLicenseCheck)({
            license,
            route,
            capability: "identity_core",
            requiredGate: 1,
            outcome: "denied",
            reason: cap.reason ?? null,
            runtimeId,
        });
        return { error: cap.reason, capability: "identity_core" };
    }
    if (!body.agent_id || !body.identity_fingerprint) {
        return { error: "INVALID_INPUT" };
    }
    await (0, capability_1.auditLicenseCheck)({
        license,
        route,
        capability: "identity_core",
        requiredGate: 1,
        outcome: "allowed",
        reason: null,
        runtimeId,
    });
    return {
        valid: true,
        agent_id: body.agent_id,
        identity_fingerprint: body.identity_fingerprint,
    };
}
async function aceLogicLeaseAcquire(params) {
    const { license, route, body, runtimeId } = params;
    const cap = (0, capability_1.checkCapability)(license, "fork_detection", 5);
    if (!cap.ok) {
        await (0, capability_1.auditLicenseCheck)({
            license,
            route,
            capability: "fork_detection",
            requiredGate: 5,
            outcome: "denied",
            reason: cap.reason ?? null,
            runtimeId,
        });
        return { error: cap.reason, capability: "fork_detection" };
    }
    await (0, capability_1.auditLicenseCheck)({
        license,
        route,
        capability: "fork_detection",
        requiredGate: 5,
        outcome: "allowed",
        reason: null,
        runtimeId,
    });
    const lease_id = `lease_${(0, crypto_1.randomUUID)().replace(/-/g, "")}`;
    const lease_expires_at = new Date(Date.now() + LEASE_TTL_MS).toISOString();
    return {
        lease_id,
        agent_id: body.agent_id,
        instance_id: body.instance_id,
        lease_expires_at,
        status: "active",
    };
}
async function aceLogicLeaseRenew(params) {
    const cap = (0, capability_1.checkCapability)(params.license, "fork_detection", 5);
    if (!cap.ok) {
        await (0, capability_1.auditLicenseCheck)({
            license: params.license,
            route: params.route,
            capability: "fork_detection",
            requiredGate: 5,
            outcome: "denied",
            reason: cap.reason ?? null,
            runtimeId: params.runtimeId,
        });
        return { error: cap.reason };
    }
    await (0, capability_1.auditLicenseCheck)({
        license: params.license,
        route: params.route,
        capability: "fork_detection",
        requiredGate: 5,
        outcome: "allowed",
        reason: null,
        runtimeId: params.runtimeId,
    });
    return {
        renewed: true,
        lease_expires_at: new Date(Date.now() + LEASE_TTL_MS).toISOString(),
    };
}
async function aceLogicLeaseRelease(params) {
    const cap = (0, capability_1.checkCapability)(params.license, "fork_detection", 5);
    if (!cap.ok) {
        await (0, capability_1.auditLicenseCheck)({
            license: params.license,
            route: params.route,
            capability: "fork_detection",
            requiredGate: 5,
            outcome: "denied",
            reason: cap.reason ?? null,
            runtimeId: params.runtimeId,
        });
        return { error: cap.reason };
    }
    await (0, capability_1.auditLicenseCheck)({
        license: params.license,
        route: params.route,
        capability: "fork_detection",
        requiredGate: 5,
        outcome: "allowed",
        reason: null,
        runtimeId: params.runtimeId,
    });
    return { released: true };
}
async function aceLogicResurrectionVerify(params) {
    const cap = (0, capability_1.checkCapability)(params.license, "resurrection_verification", 6);
    if (!cap.ok) {
        await (0, capability_1.auditLicenseCheck)({
            license: params.license,
            route: params.route,
            capability: "resurrection_verification",
            requiredGate: 6,
            outcome: "denied",
            reason: cap.reason ?? null,
            runtimeId: params.runtimeId,
        });
        return { error: cap.reason };
    }
    await (0, capability_1.auditLicenseCheck)({
        license: params.license,
        route: params.route,
        capability: "resurrection_verification",
        requiredGate: 6,
        outcome: "allowed",
        reason: null,
        runtimeId: params.runtimeId,
    });
    return { valid: true, status: "verified" };
}
/**
 * Unified guard for runtime: identity + optional lease when tier allows fork_detection.
 */
async function runAceLogicExecutionGuard(params) {
    const license = await (0, resolve_license_1.resolveLicenseById)(params.license_id, params.org_id);
    if (!license || license.status !== "active" || (0, resolve_license_1.isLicenseExpired)(license)) {
        console.log("[GUARD_TEST] Blocked because license invalid:", { hasLicense: !!license, status: license?.status, expired: license ? (0, resolve_license_1.isLicenseExpired)(license) : undefined });
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
    const idCap = (0, capability_1.checkCapability)(license, "identity_core", 1);
    if (!idCap.ok) {
        console.log("[GUARD_TEST] Blocked because idCap not ok:", idCap.reason);
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
    if (!params.agent_id || !params.identity_fingerprint) {
        console.log("[GUARD_TEST] Blocked because missing agent_id or identity_fingerprint:", params);
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
    const leaseCap = (0, capability_1.checkCapability)(license, "fork_detection", 5);
    if (leaseCap.ok) {
        const lease_id = `lease_${(0, crypto_1.randomUUID)().replace(/-/g, "")}`;
        lease = {
            lease_id,
            lease_expires_at: new Date(Date.now() + LEASE_TTL_MS).toISOString(),
            status: "active",
        };
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
//# sourceMappingURL=service.js.map