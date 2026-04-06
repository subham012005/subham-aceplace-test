/**
 * State Machine — Phase 2
 *
 * Enforces strict envelope status transitions.
 * All transitions are atomic (Firestore transaction).
 * No state can be skipped.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { EnvelopeStatus } from "./types";
/**
 * Transition an envelope to a new status.
 * Throws if the transition is not valid from the current state.
 * Uses Firestore transaction for atomicity.
 */
export declare function transition(envelopeId: string, newStatus: EnvelopeStatus, metadata?: Record<string, unknown>): Promise<void>;
/**
 * Validate that a transition is legal WITHOUT performing it.
 * Use for preflight checks.
 */
export declare function canTransition(currentStatus: EnvelopeStatus, newStatus: EnvelopeStatus): boolean;
//# sourceMappingURL=state-machine.d.ts.map