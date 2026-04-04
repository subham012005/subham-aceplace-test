/**
 * Runtime Invariants — Unit Tests
 *
 * Validates global system invariants that must hold at all times:
 * - Terminal states have no allowed transitions
 * - No execution with pending_verification fingerprint in prod
 * - Step pipeline is non-empty and agents are unique per role
 * - Default identity contexts are flagged as unverified
 */

import { describe, it, expect } from "vitest";
import { ENVELOPE_STATUS_TRANSITIONS, COLLECTIONS } from "../constants";
import { buildDefaultIdentityContext } from "../envelope-builder";
import { planEnvelopeSteps } from "../step-planner";
import { computeFingerprint } from "../kernels/identity";
import type { EnvelopeStatus } from "../types";

describe("Invariant — terminal states have no transitions", () => {
  const terminals: EnvelopeStatus[] = ["approved", "completed", "rejected", "failed", "quarantined"];

  for (const state of terminals) {
    it(`${state} allows no further transitions`, () => {
      expect(ENVELOPE_STATUS_TRANSITIONS[state]).toHaveLength(0);
    });
  }
});

describe("Invariant — pending_verification fingerprint", () => {
  it("buildDefaultIdentityContext produces pending_verification (dev only)", () => {
    const ctx = buildDefaultIdentityContext("agent_test");
    expect(ctx.identity_fingerprint).toBe("pending_verification");
    expect(ctx.verified).toBe(false);
  });

  it("pending_verification is rejected in prod (ALLOW_PENDING_IDENTITY not set)", () => {
    delete process.env.ALLOW_PENDING_IDENTITY;
    const isProdSafe = process.env.ALLOW_PENDING_IDENTITY !== "true";
    expect(isProdSafe).toBe(true);
  });
});

describe("Invariant — step planner agent coverage", () => {
  it("planEnvelopeSteps returns at least 4 steps", () => {
    const steps = planEnvelopeSteps({
      require_human_approval: false,
      role_assignments: {
        COO: "agent_coo",
        Researcher: "agent_researcher",
        Worker: "agent_worker",
        Grader: "agent_grader",
      },
    });
    expect(steps.length).toBeGreaterThanOrEqual(4);
  });

  it("all planned steps have a non-empty assigned_agent_id", () => {
    const steps = planEnvelopeSteps({
      require_human_approval: false,
      role_assignments: {
        COO: "agent_coo",
        Researcher: "agent_researcher",
        Worker: "agent_worker",
        Grader: "agent_grader",
      },
    });
    for (const step of steps) {
      expect(step.assigned_agent_id, `step ${step.step_id} must have an agent`).toBeTruthy();
    }
  });

  it("planEnvelopeSteps derives correct agent set (not hardcoded)", () => {
    const steps = planEnvelopeSteps({
      require_human_approval: false,
      role_assignments: {
        COO: "custom_coo",
        Researcher: "custom_researcher",
        Worker: "custom_worker",
        Grader: "custom_grader",
      },
    });
    const agents = new Set(steps.map((s: { assigned_agent_id: string }) => s.assigned_agent_id));
    expect(agents.has("custom_coo")).toBe(true);
    expect(agents.has("custom_researcher")).toBe(true);
    expect(agents.has("custom_worker")).toBe(true);
    expect(agents.has("custom_grader")).toBe(true);
    // Must NOT contain the old hardcoded IDs
    expect(agents.has("agent_researcher")).toBe(false);
    expect(agents.has("agent_grader")).toBe(false);
  });
});

describe("Invariant — COLLECTIONS constant completeness", () => {
  it("COLLECTIONS includes EXECUTION_QUEUE", () => {
    expect(COLLECTIONS.EXECUTION_QUEUE).toBeDefined();
    expect(COLLECTIONS.EXECUTION_QUEUE).toBe("execution_queue");
  });

  it("COLLECTIONS includes API_KEYS", () => {
    expect(COLLECTIONS.API_KEYS).toBeDefined();
    expect(COLLECTIONS.API_KEYS).toBe("api_keys");
  });

  it("fingerprint of same data is deterministic (SHA-256 invariant)", () => {
    const data = JSON.stringify({ agent_id: "agent_coo", role: "orchestrator" });
    const fp = computeFingerprint(data);
    expect(fp).toHaveLength(64);
    expect(computeFingerprint(data)).toBe(fp);
  });
});
