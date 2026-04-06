"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCapability = checkCapability;
exports.auditLicenseCheck = auditLicenseCheck;
const db_1 = require("../db");
const constants_1 = require("../constants");
function checkCapability(license, capability, requiredGate) {
    if (!license.modules?.[capability]) {
        return { ok: false, reason: "CAPABILITY_DENIED" };
    }
    if (requiredGate !== undefined) {
        const { min_gate, max_gate } = license.gates;
        if (requiredGate < min_gate || requiredGate > max_gate) {
            return { ok: false, reason: "GATE_DENIED" };
        }
    }
    return { ok: true };
}
async function auditLicenseCheck(params) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.LICENSE_AUDIT_EVENTS)
        .add({
        org_id: params.license.org_id,
        license_id: params.license.license_id,
        route: params.route,
        capability: params.capability,
        required_gate: params.requiredGate,
        outcome: params.outcome,
        reason: params.reason,
        runtime_id: params.runtimeId,
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=capability.js.map