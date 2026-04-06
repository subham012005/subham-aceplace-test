"use strict";
/**
 * Lease — Unit Tests
 *
 * Validates the per-agent lease model invariants:
 * - Same instance can renew its lease
 * - Different instance triggers FORK_DETECTED
 * - No double lease on same envelope
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// We test the pure validation logic (validatePerAgentLease) without Firestore
// by constructing synthetic envelope objects.
const per_agent_authority_1 = require("../per-agent-authority");
function makeLease(overrides = {}) {
    return {
        lease_id: "lease_test_001",
        agent_id: "agent_coo",
        current_instance_id: "inst_abc",
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(), // 1 min in future
        acquired_at: new Date().toISOString(),
        last_renewed_at: new Date().toISOString(),
        status: "active",
        ...overrides,
    };
}
function makeEnvelope(lease) {
    return {
        envelope_id: "env_test_001",
        authority_leases: { [lease.agent_id]: lease },
    };
}
(0, vitest_1.describe)("Lease — validatePerAgentLease", () => {
    (0, vitest_1.it)("passes validation for active same-instance lease", () => {
        const lease = makeLease();
        const envelope = makeEnvelope(lease);
        (0, vitest_1.expect)(() => (0, per_agent_authority_1.validatePerAgentLease)(envelope, "agent_coo", "inst_abc")).not.toThrow();
    });
    (0, vitest_1.it)("throws LEASE_INSTANCE_MISMATCH when a different instance holds the lease", () => {
        const lease = makeLease({ current_instance_id: "inst_abc" });
        const envelope = makeEnvelope(lease);
        (0, vitest_1.expect)(() => (0, per_agent_authority_1.validatePerAgentLease)(envelope, "agent_coo", "inst_xyz")).toThrow(/LEASE_INSTANCE_MISMATCH/);
    });
    (0, vitest_1.it)("throws LEASE_MISSING when no lease exists for agent", () => {
        const envelope = {
            envelope_id: "env_test_001",
            authority_leases: {},
        };
        (0, vitest_1.expect)(() => (0, per_agent_authority_1.validatePerAgentLease)(envelope, "agent_coo", "inst_abc")).toThrow(/LEASE_MISSING/);
    });
    (0, vitest_1.it)("throws LEASE_EXPIRED when lease has passed expiry", () => {
        const expiredLease = makeLease({
            lease_expires_at: new Date(Date.now() - 1000).toISOString(), // 1s in past
        });
        const envelope = makeEnvelope(expiredLease);
        (0, vitest_1.expect)(() => (0, per_agent_authority_1.validatePerAgentLease)(envelope, "agent_coo", "inst_abc")).toThrow(/LEASE_EXPIRED/);
    });
    (0, vitest_1.it)("throws LEASE_NOT_ACTIVE when lease status is revoked", () => {
        const revokedLease = makeLease({ status: "revoked" });
        const envelope = makeEnvelope(revokedLease);
        (0, vitest_1.expect)(() => (0, per_agent_authority_1.validatePerAgentLease)(envelope, "agent_coo", "inst_abc")).toThrow(/LEASE_NOT_ACTIVE/);
    });
});
//# sourceMappingURL=lease.test.js.map