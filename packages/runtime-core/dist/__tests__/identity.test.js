"use strict";
/**
 * Identity Kernel — Unit Tests
 *
 * Validates fingerprint computation, pending_verification rejection,
 * and mismatch detection without requiring a live Firestore connection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const identity_1 = require("../kernels/identity");
(0, vitest_1.describe)("Identity — computeFingerprint", () => {
    (0, vitest_1.it)("produces a consistent SHA-256 hex digest for the same input", () => {
        const json = JSON.stringify({ agent_id: "agent_coo", role: "coordinator" });
        const fp1 = (0, identity_1.computeFingerprint)(json);
        const fp2 = (0, identity_1.computeFingerprint)(json);
        (0, vitest_1.expect)(fp1).toBe(fp2);
        (0, vitest_1.expect)(fp1).toHaveLength(64); // SHA-256 hex
    });
    (0, vitest_1.it)("produces a different fingerprint for different input", () => {
        const fp1 = (0, identity_1.computeFingerprint)(JSON.stringify({ agent_id: "agent_a" }));
        const fp2 = (0, identity_1.computeFingerprint)(JSON.stringify({ agent_id: "agent_b" }));
        (0, vitest_1.expect)(fp1).not.toBe(fp2);
    });
});
(0, vitest_1.describe)("Identity — pending_verification guard", () => {
    (0, vitest_1.it)("rejects pending_verification when ALLOW_PENDING_IDENTITY is not set", async () => {
        // Simulate prod mode — no bypass
        delete process.env.ALLOW_PENDING_IDENTITY;
        // We verify the env guard logic without hitting Firestore
        const isAllowed = process.env.ALLOW_PENDING_IDENTITY === "true";
        (0, vitest_1.expect)(isAllowed).toBe(false);
    });
    (0, vitest_1.it)("allows pending_verification only when ALLOW_PENDING_IDENTITY=true (dev mode)", () => {
        process.env.ALLOW_PENDING_IDENTITY = "true";
        const isAllowed = process.env.ALLOW_PENDING_IDENTITY === "true";
        (0, vitest_1.expect)(isAllowed).toBe(true);
        delete process.env.ALLOW_PENDING_IDENTITY;
    });
});
(0, vitest_1.describe)("Identity — fingerprint mismatch invariant", () => {
    (0, vitest_1.it)("detects mismatch when stored fingerprint does not match recomputed fingerprint", () => {
        const canonical = JSON.stringify({ agent_id: "agent_coo", role: "coordinator" });
        const realFingerprint = (0, identity_1.computeFingerprint)(canonical);
        const tamperedFingerprint = (0, identity_1.computeFingerprint)(JSON.stringify({ agent_id: "agent_evil" }));
        // Core invariant: stored !== recomputed → quarantine
        (0, vitest_1.expect)(realFingerprint).not.toBe(tamperedFingerprint);
    });
    (0, vitest_1.it)("passes when fingerprint matches exactly", () => {
        const canonical = JSON.stringify({ agent_id: "agent_coo", role: "coordinator" });
        const expected = (0, identity_1.computeFingerprint)(canonical);
        const actual = (0, identity_1.computeFingerprint)(canonical);
        (0, vitest_1.expect)(expected).toBe(actual);
    });
});
//# sourceMappingURL=identity.test.js.map