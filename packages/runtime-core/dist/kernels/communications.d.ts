/**
 * Communications Kernel — Phase 2
 *
 * Persists to `protocol_messages` (legacy path).
 * Multi-agent parallel execution uses `execution_messages` via `us-message-engine.ts`
 * — both are valid; explorer lists `execution_messages` for the canonical #us# trail.
 *
 * Enforces strict #us# protocol. ONLY these 5 verbs are allowed:
 *   #us#.task.plan
 *   #us#.task.assign
 *   #us#.artifact.produce
 *   #us#.evaluation.score
 *   #us#.execution.complete
 *
 * Free-form messages and unrecognized verbs are REJECTED.
 * All messages MUST include envelope_id, step_id, identity_fingerprint, and lease_holder.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
import type { ProtocolMessage, ProtocolVerb } from "../types";
/**
 * Send a strictly validated #us# protocol message.
 * Throws if verb is not in the allowed list.
 */
export declare function sendMessage(params: {
    verb: ProtocolVerb;
    senderAgentId: string;
    envelopeId: string;
    stepId: string;
    identityFingerprint: string;
    leaseHolder: string;
    payload: Record<string, unknown>;
    targetAgentId?: string;
    metadata?: Record<string, unknown>;
}): Promise<ProtocolMessage>;
/**
 * Get all protocol messages for an envelope, ordered by time.
 */
export declare function getEnvelopeMessages(envelopeId: string): Promise<ProtocolMessage[]>;
/**
 * Check if a verb string is a recognized #us# protocol verb.
 */
export declare function isValidVerb(verb: string): verb is ProtocolVerb;
/**
 * Get human-readable label for a verb.
 */
export declare function getVerbLabel(verb: ProtocolVerb): string;
//# sourceMappingURL=communications.d.ts.map