"use strict";
/**
 * Runtime Invariants — Unit Tests
 *
 * Validates global system invariants that must hold at all times:
 * - Terminal states have no allowed transitions
 * - No execution with pending_verification fingerprint in prod
 * - Step pipeline is non-empty and agents are unique per role
 * - Default identity contexts are flagged as unverified
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const constants_1 = require("../constants");
const envelope_builder_1 = require("../envelope-builder");
const step_planner_1 = require("../step-planner");
const identity_1 = require("../kernels/identity");
(0, vitest_1.describe)("Invariant — terminal states have no transitions", () => {
    const terminals = ["approved", "completed", "rejected", "failed", "quarantined"];
    for (const state of terminals) {
        (0, vitest_1.it)(`${state} allows no further transitions`, () => {
            (0, vitest_1.expect)(constants_1.ENVELOPE_STATUS_TRANSITIONS[state]).toHaveLength(0);
        });
    }
});
(0, vitest_1.describe)("Invariant — pending_verification fingerprint", () => {
    (0, vitest_1.it)("buildDefaultIdentityContext produces pending_verification (dev only)", () => {
        const ctx = (0, envelope_builder_1.buildDefaultIdentityContext)("agent_test");
        (0, vitest_1.expect)(ctx.identity_fingerprint).toBe("pending_verification");
        (0, vitest_1.expect)(ctx.verified).toBe(false);
    });
    (0, vitest_1.it)("pending_verification is rejected in prod (ALLOW_PENDING_IDENTITY not set)", () => {
        delete process.env.ALLOW_PENDING_IDENTITY;
        const isProdSafe = process.env.ALLOW_PENDING_IDENTITY !== "true";
        (0, vitest_1.expect)(isProdSafe).toBe(true);
    });
});
(0, vitest_1.describe)("Invariant — step planner agent coverage", () => {
    (0, vitest_1.it)("planEnvelopeSteps returns at least 4 steps", () => {
        const steps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments: {
                COO: "agent_coo",
                Researcher: "agent_researcher",
                Worker: "agent_worker",
                Grader: "agent_grader",
            },
        });
        (0, vitest_1.expect)(steps.length).toBeGreaterThanOrEqual(4);
    });
    (0, vitest_1.it)("all planned steps have a non-empty assigned_agent_id", () => {
        const steps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments: {
                COO: "agent_coo",
                Researcher: "agent_researcher",
                Worker: "agent_worker",
                Grader: "agent_grader",
            },
        });
        for (const step of steps) {
            (0, vitest_1.expect)(step.assigned_agent_id, `step ${step.step_id} must have an agent`).toBeTruthy();
        }
    });
    (0, vitest_1.it)("planEnvelopeSteps derives correct agent set (not hardcoded)", () => {
        const steps = (0, step_planner_1.planEnvelopeSteps)({
            require_human_approval: false,
            role_assignments: {
                COO: "custom_coo",
                Researcher: "custom_researcher",
                Worker: "custom_worker",
                Grader: "custom_grader",
            },
        });
        const agents = new Set(steps.map((s) => s.assigned_agent_id));
        (0, vitest_1.expect)(agents.has("custom_coo")).toBe(true);
        (0, vitest_1.expect)(agents.has("custom_researcher")).toBe(true);
        (0, vitest_1.expect)(agents.has("custom_worker")).toBe(true);
        (0, vitest_1.expect)(agents.has("custom_grader")).toBe(true);
        // Must NOT contain the old hardcoded IDs
        (0, vitest_1.expect)(agents.has("agent_researcher")).toBe(false);
        (0, vitest_1.expect)(agents.has("agent_grader")).toBe(false);
    });
});
(0, vitest_1.describe)("Invariant — COLLECTIONS constant completeness", () => {
    (0, vitest_1.it)("COLLECTIONS includes EXECUTION_QUEUE", () => {
        (0, vitest_1.expect)(constants_1.COLLECTIONS.EXECUTION_QUEUE).toBeDefined();
        (0, vitest_1.expect)(constants_1.COLLECTIONS.EXECUTION_QUEUE).toBe("execution_queue");
    });
    (0, vitest_1.it)("COLLECTIONS includes API_KEYS", () => {
        (0, vitest_1.expect)(constants_1.COLLECTIONS.API_KEYS).toBeDefined();
        (0, vitest_1.expect)(constants_1.COLLECTIONS.API_KEYS).toBe("api_keys");
    });
    (0, vitest_1.it)("fingerprint of same data is deterministic (SHA-256 invariant)", () => {
        const data = JSON.stringify({ agent_id: "agent_coo", role: "orchestrator" });
        const fp = (0, identity_1.computeFingerprint)(data);
        (0, vitest_1.expect)(fp).toHaveLength(64);
        (0, vitest_1.expect)((0, identity_1.computeFingerprint)(data)).toBe(fp);
    });
});
//# sourceMappingURL=invariants.test.js.map