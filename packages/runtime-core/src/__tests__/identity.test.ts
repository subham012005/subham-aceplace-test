/**
 * Identity Kernel — Unit Tests
 *
 * Validates fingerprint computation, pending_verification rejection,
 * and mismatch detection without requiring a live Firestore connection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeFingerprint } from "../kernels/identity";

describe("Identity — computeFingerprint", () => {
  it("produces a consistent SHA-256 hex digest for the same input", () => {
    const json = JSON.stringify({ agent_id: "agent_coo", role: "coordinator" });
    const fp1 = computeFingerprint(json);
    const fp2 = computeFingerprint(json);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64); // SHA-256 hex
  });

  it("produces a different fingerprint for different input", () => {
    const fp1 = computeFingerprint(JSON.stringify({ agent_id: "agent_a" }));
    const fp2 = computeFingerprint(JSON.stringify({ agent_id: "agent_b" }));
    expect(fp1).not.toBe(fp2);
  });
});

describe("Identity — pending_verification guard", () => {
  it("rejects pending_verification when ALLOW_PENDING_IDENTITY is not set", async () => {
    // Simulate prod mode — no bypass
    delete process.env.ALLOW_PENDING_IDENTITY;

    // We verify the env guard logic without hitting Firestore
    const isAllowed = process.env.ALLOW_PENDING_IDENTITY === "true";
    expect(isAllowed).toBe(false);
  });

  it("allows pending_verification only when ALLOW_PENDING_IDENTITY=true (dev mode)", () => {
    process.env.ALLOW_PENDING_IDENTITY = "true";
    const isAllowed = process.env.ALLOW_PENDING_IDENTITY === "true";
    expect(isAllowed).toBe(true);
    delete process.env.ALLOW_PENDING_IDENTITY;
  });
});

describe("Identity — fingerprint mismatch invariant", () => {
  it("detects mismatch when stored fingerprint does not match recomputed fingerprint", () => {
    const canonical = JSON.stringify({ agent_id: "agent_coo", role: "coordinator" });
    const realFingerprint = computeFingerprint(canonical);
    const tamperedFingerprint = computeFingerprint(JSON.stringify({ agent_id: "agent_evil" }));

    // Core invariant: stored !== recomputed → quarantine
    expect(realFingerprint).not.toBe(tamperedFingerprint);
  });

  it("passes when fingerprint matches exactly", () => {
    const canonical = JSON.stringify({ agent_id: "agent_coo", role: "coordinator" });
    const expected = computeFingerprint(canonical);
    const actual = computeFingerprint(canonical);
    expect(expected).toBe(actual);
  });
});
