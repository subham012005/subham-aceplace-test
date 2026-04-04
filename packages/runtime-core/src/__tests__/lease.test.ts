/**
 * Lease — Unit Tests
 *
 * Validates the per-agent lease model invariants:
 * - Same instance can renew its lease
 * - Different instance triggers FORK_DETECTED
 * - No double lease on same envelope
 */

import { describe, it, expect } from "vitest";

// We test the pure validation logic (validatePerAgentLease) without Firestore
// by constructing synthetic envelope objects.
import { validatePerAgentLease } from "../per-agent-authority";
import type { ExecutionEnvelope, AgentAuthorityLease } from "../types";

function makeLease(overrides: Partial<AgentAuthorityLease> = {}): AgentAuthorityLease {
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

function makeEnvelope(lease: AgentAuthorityLease): Partial<ExecutionEnvelope> {
  return {
    envelope_id: "env_test_001",
    authority_leases: { [lease.agent_id]: lease },
  } as Partial<ExecutionEnvelope>;
}

describe("Lease — validatePerAgentLease", () => {
  it("passes validation for active same-instance lease", () => {
    const lease = makeLease();
    const envelope = makeEnvelope(lease) as ExecutionEnvelope;
    expect(() => validatePerAgentLease(envelope, "agent_coo", "inst_abc")).not.toThrow();
  });

  it("throws LEASE_INSTANCE_MISMATCH when a different instance holds the lease", () => {
    const lease = makeLease({ current_instance_id: "inst_abc" });
    const envelope = makeEnvelope(lease) as ExecutionEnvelope;
    expect(() => validatePerAgentLease(envelope, "agent_coo", "inst_xyz")).toThrow(
      /LEASE_INSTANCE_MISMATCH/
    );
  });

  it("throws LEASE_MISSING when no lease exists for agent", () => {
    const envelope = {
      envelope_id: "env_test_001",
      authority_leases: {},
    } as unknown as ExecutionEnvelope;
    expect(() => validatePerAgentLease(envelope, "agent_coo", "inst_abc")).toThrow(/LEASE_MISSING/);
  });

  it("throws LEASE_EXPIRED when lease has passed expiry", () => {
    const expiredLease = makeLease({
      lease_expires_at: new Date(Date.now() - 1000).toISOString(), // 1s in past
    });
    const envelope = makeEnvelope(expiredLease) as ExecutionEnvelope;
    expect(() => validatePerAgentLease(envelope, "agent_coo", "inst_abc")).toThrow(/LEASE_EXPIRED/);
  });

  it("throws LEASE_NOT_ACTIVE when lease status is revoked", () => {
    const revokedLease = makeLease({ status: "revoked" });
    const envelope = makeEnvelope(revokedLease) as ExecutionEnvelope;
    expect(() => validatePerAgentLease(envelope, "agent_coo", "inst_abc")).toThrow(/LEASE_NOT_ACTIVE/);
  });
});
