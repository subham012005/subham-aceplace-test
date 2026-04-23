"use strict";
/**
 * Communications Kernel — Phase 2
 *
 * Persists to `execution_messages` (Phase 2 Canonical Path).
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessage = sendMessage;
exports.getEnvelopeMessages = getEnvelopeMessages;
exports.isValidVerb = isValidVerb;
exports.getVerbLabel = getVerbLabel;
const db_1 = require("../db");
const constants_1 = require("../constants");
const hash_1 = require("../hash");
/**
 * Send a strictly validated #us# protocol message.
 * Throws if verb is not in the allowed list.
 */
async function sendMessage(params) {
    // Strict verb enforcement
    if (!isValidVerb(params.verb)) {
        throw new Error(`[#us#] Rejected: "${params.verb}" is not a valid #us# protocol verb. ` +
            `Allowed: ${constants_1.ALLOWED_PROTOCOL_VERBS.join(", ")}`);
    }
    const message = {
        message_id: (0, hash_1.generateMessageId)(),
        protocol: "#us#",
        version: "1.0",
        message_type: params.verb,
        execution: {
            envelope_id: params.envelopeId,
            step_id: params.stepId,
        },
        identity: {
            agent_id: params.senderAgentId,
            identity_fingerprint: params.identityFingerprint,
        },
        authority: {
            lease_holder: params.leaseHolder,
        },
        payload: params.payload ?? {},
        metadata: params.metadata ?? {},
        timestamp: new Date().toISOString(),
    };
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_MESSAGES)
        .doc(message.message_id)
        .set(message);
    return message;
}
/**
 * Get all protocol messages for an envelope, ordered by time.
 */
async function getEnvelopeMessages(envelopeId) {
    const snapshot = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.EXECUTION_MESSAGES)
        .where("execution.envelope_id", "==", envelopeId)
        .get();
    const messages = snapshot.docs.map((doc) => doc.data());
    // 🔐 Sort in-memory to avoid FAILED_PRECONDITION (missing index) error
    messages.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeA - timeB;
    });
    return messages;
}
/**
 * Check if a verb string is a recognized #us# protocol verb.
 */
function isValidVerb(verb) {
    return constants_1.ALLOWED_PROTOCOL_VERBS.includes(verb);
}
/**
 * Get human-readable label for a verb.
 */
function getVerbLabel(verb) {
    return constants_1.PROTOCOL_VERB_LABELS[verb] ?? verb;
}
//# sourceMappingURL=communications.js.map