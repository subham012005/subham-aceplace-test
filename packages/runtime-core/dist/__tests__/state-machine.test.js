"use strict";
/**
 * State Machine — Unit Tests
 *
 * Validates that the state machine enforces legal transitions and rejects illegal ones.
 * Uses mocked Firestore (no real DB needed for unit tests).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const state_machine_1 = require("../state-machine");
const constants_1 = require("../constants");
(0, vitest_1.describe)("State Machine — transition legality", () => {
    (0, vitest_1.it)("allows valid transition: created → leased", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("created", "leased")).toBe(true);
    });
    (0, vitest_1.it)("allows valid transition: leased → planned", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("leased", "planned")).toBe(true);
    });
    (0, vitest_1.it)("allows valid transition: planned → executing", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("planned", "executing")).toBe(true);
    });
    (0, vitest_1.it)("allows valid transition: executing → completed", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("executing", "completed")).toBe(true);
    });
    (0, vitest_1.it)("allows valid transition: executing → quarantined", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("executing", "quarantined")).toBe(true);
    });
    (0, vitest_1.it)("prevents invalid transition: executing → created", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("executing", "created")).toBe(false);
    });
    (0, vitest_1.it)("prevents invalid transition: completed → executing (terminal state re-entry)", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("completed", "executing")).toBe(false);
    });
    (0, vitest_1.it)("prevents invalid transition: rejected → approved", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("rejected", "approved")).toBe(false);
    });
    (0, vitest_1.it)("prevents invalid transition: quarantined → executing", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("quarantined", "executing")).toBe(false);
    });
    (0, vitest_1.it)("prevents invalid transition: failed → completed", () => {
        (0, vitest_1.expect)((0, state_machine_1.canTransition)("failed", "completed")).toBe(false);
    });
    (0, vitest_1.it)("all terminal states have no allowed transitions", () => {
        const terminals = ["approved", "completed", "rejected", "failed", "quarantined"];
        for (const state of terminals) {
            const allowed = constants_1.ENVELOPE_STATUS_TRANSITIONS[state];
            (0, vitest_1.expect)(allowed.length, `${state} should be terminal (no allowed transitions)`).toBe(0);
        }
    });
    (0, vitest_1.it)("every status has an entry in the transition map", () => {
        const allStatuses = [
            "created", "leased", "planned", "executing",
            "awaiting_human", "approved", "completed", "rejected", "failed", "quarantined",
        ];
        for (const status of allStatuses) {
            (0, vitest_1.expect)(constants_1.ENVELOPE_STATUS_TRANSITIONS[status], `${status} should have a transition entry`).toBeDefined();
        }
    });
});
//# sourceMappingURL=state-machine.test.js.map