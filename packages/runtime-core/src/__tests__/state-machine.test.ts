/**
 * State Machine — Unit Tests
 *
 * Validates that the state machine enforces legal transitions and rejects illegal ones.
 * Uses mocked Firestore (no real DB needed for unit tests).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { canTransition } from "../state-machine";
import { ENVELOPE_STATUS_TRANSITIONS } from "../constants";
import type { EnvelopeStatus } from "../types";

describe("State Machine — transition legality", () => {
  it("allows valid transition: created → leased", () => {
    expect(canTransition("created", "leased")).toBe(true);
  });

  it("allows valid transition: leased → planned", () => {
    expect(canTransition("leased", "planned")).toBe(true);
  });

  it("allows valid transition: planned → executing", () => {
    expect(canTransition("planned", "executing")).toBe(true);
  });

  it("allows valid transition: executing → completed", () => {
    expect(canTransition("executing", "completed")).toBe(true);
  });

  it("allows valid transition: executing → quarantined", () => {
    expect(canTransition("executing", "quarantined")).toBe(true);
  });

  it("prevents invalid transition: executing → created", () => {
    expect(canTransition("executing", "created")).toBe(false);
  });

  it("prevents invalid transition: completed → executing (terminal state re-entry)", () => {
    expect(canTransition("completed", "executing")).toBe(false);
  });

  it("prevents invalid transition: rejected → approved", () => {
    expect(canTransition("rejected", "approved")).toBe(false);
  });

  it("prevents invalid transition: quarantined → executing", () => {
    expect(canTransition("quarantined", "executing")).toBe(false);
  });

  it("prevents invalid transition: failed → completed", () => {
    expect(canTransition("failed", "completed")).toBe(false);
  });

  it("all terminal states have no allowed transitions", () => {
    const terminals: EnvelopeStatus[] = ["approved", "completed", "rejected", "failed", "quarantined"];
    for (const state of terminals) {
      const allowed = ENVELOPE_STATUS_TRANSITIONS[state];
      expect(allowed.length, `${state} should be terminal (no allowed transitions)`).toBe(0);
    }
  });

  it("every status has an entry in the transition map", () => {
    const allStatuses: EnvelopeStatus[] = [
      "created", "leased", "planned", "executing",
      "awaiting_human", "approved", "completed", "rejected", "failed", "quarantined",
    ];
    for (const status of allStatuses) {
      expect(
        ENVELOPE_STATUS_TRANSITIONS[status],
        `${status} should have a transition entry`
      ).toBeDefined();
    }
  });
});
