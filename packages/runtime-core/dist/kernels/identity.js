"use strict";
/**
 * Identity Kernel — Phase 2
 *
 * Verifies agent identity by:
 * 1. Loading agent from agents/{agent_id}
 * 2. Recomputing SHA-256 fingerprint from canonical_identity_json
 * 3. Comparing with envelope.identity_context.identity_fingerprint
 *
 * On mismatch → set envelope.status = "quarantined", stop execution.
 *
 * Phase 2 | Envelope-Driven Runtime
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyIdentityForAgent = verifyIdentityForAgent;
exports.verifyIdentity = verifyIdentity;
exports.buildIdentityContext = buildIdentityContext;
exports.computeFingerprint = computeFingerprint;
exports.registerAgentIdentity = registerAgentIdentity;
exports.deleteAgentIdentity = deleteAgentIdentity;
const crypto_1 = require("crypto");
const db_1 = require("../db");
const constants_1 = require("../constants");
const hash_1 = require("../hash");
// Lazy import to avoid circular dep — state-machine imports db, not identity
let _transition = null;
async function getTransition() {
    if (!_transition) {
        const sm = await Promise.resolve().then(() => __importStar(require("../state-machine")));
        _transition = sm.transition;
    }
    return _transition;
}
/**
 * Resolve identity_context for a step agent (multi-agent envelopes), then verify.
 */
async function verifyIdentityForAgent(envelopeId, envelope, agentId) {
    const ctx = envelope.multi_agent && envelope.identity_contexts?.[agentId]
        ? envelope.identity_contexts[agentId]
        : envelope.identity_context.agent_id === agentId
            ? envelope.identity_context
            : null;
    if (!ctx) {
        return {
            verified: false,
            agent_id: agentId,
            reason: "IDENTITY_CONTEXT_MISSING",
            verified_at: new Date().toISOString(),
        };
    }
    const synthetic = {
        ...envelope,
        identity_context: {
            ...ctx,
            agent_id: ctx.agent_id || agentId,
            verified: ctx.verified ?? true,
        },
    };
    return verifyIdentity(envelopeId, agentId, synthetic);
}
/** Verify a single agent against envelope.identity_context (quarantines on mismatch). */
async function verifyIdentity(envelopeId, agentId, envelope) {
    const now = new Date().toISOString();
    // Load agent from agents collection
    const agentDoc = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.AGENTS)
        .doc(agentId)
        .get();
    if (!agentDoc.exists) {
        // AUDIT FIX P0#3: No silent bypass — AGENT_NOT_FOUND always quarantines in prod.
        await quarantineEnvelope(envelopeId, "AGENT_NOT_FOUND");
        await logIdentityTrace(envelopeId, agentId, "", "IDENTITY_AGENT_NOT_FOUND");
        return { verified: false, agent_id: agentId, reason: "AGENT_NOT_FOUND", verified_at: now };
    }
    const agent = agentDoc.data();
    if (!agent.canonical_identity_json) {
        await quarantineEnvelope(envelopeId, "IDENTITY_DATA_MISSING");
        return { verified: false, agent_id: agentId, reason: "IDENTITY_DATA_MISSING", verified_at: now };
    }
    // Recompute fingerprint from canonical_identity_json
    const canonicalRaw = agent.canonical_identity_json;
    const canonicalStr = typeof canonicalRaw === "string" ? canonicalRaw : JSON.stringify(canonicalRaw);
    const recomputedFingerprint = computeFingerprint(canonicalStr);
    // Compare with envelope's expected fingerprint
    const expectedFingerprint = envelope.identity_context.identity_fingerprint;
    // AUDIT FIX P0#3: pending_verification is NOT a valid production fingerprint.
    // Gate behind env flag — fail CLOSED in prod (ALLOW_PENDING_IDENTITY not set).
    if (expectedFingerprint === "pending_verification") {
        if (process.env.ALLOW_PENDING_IDENTITY === "true") {
            console.warn(`[IDENTITY] WARNING: pending_verification allowed for ${agentId} — dev mode only. ` +
                `Set ALLOW_PENDING_IDENTITY=false for production.`);
            // continue to success path below
        }
        else {
            await quarantineEnvelope(envelopeId, "IDENTITY_NOT_VERIFIED");
            await logIdentityTrace(envelopeId, agentId, "", "IDENTITY_PENDING_REJECTED");
            return {
                verified: false,
                agent_id: agentId,
                reason: "IDENTITY_NOT_VERIFIED",
                verified_at: now,
            };
        }
    }
    else if (recomputedFingerprint !== expectedFingerprint) {
        await quarantineEnvelope(envelopeId, "IDENTITY_FINGERPRINT_MISMATCH");
        await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_FINGERPRINT_MISMATCH");
        return {
            verified: false,
            agent_id: agentId,
            reason: "IDENTITY_FINGERPRINT_MISMATCH",
            verified_at: now,
        };
    }
    // Update last_verified_at on agent record
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.AGENTS)
        .doc(agentId)
        .update({ last_verified_at: now });
    await logIdentityTrace(envelopeId, agentId, recomputedFingerprint, "IDENTITY_VERIFIED");
    return { verified: true, agent_id: agentId, verified_at: now };
}
/**
 * Build an IdentityContext from a stored agent record.
 * Used when creating a new envelope.
 */
async function buildIdentityContext(agentId) {
    const doc = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.AGENTS)
        .doc(agentId)
        .get();
    if (!doc.exists)
        return null;
    const agent = doc.data();
    if (!agent.canonical_identity_json)
        return null;
    const canonicalRaw = agent.canonical_identity_json;
    const canonicalStr = typeof canonicalRaw === "string" ? canonicalRaw : JSON.stringify(canonicalRaw);
    const fingerprint = computeFingerprint(canonicalStr);
    return {
        agent_id: agent.agent_id,
        identity_fingerprint: fingerprint,
        verified: true,
        verified_at: new Date().toISOString(),
    };
}
/**
 * Compute SHA-256 fingerprint of canonical_identity_json.
 */
function computeFingerprint(canonicalJson) {
    return (0, crypto_1.createHash)("sha256").update(canonicalJson, "utf8").digest("hex");
}
/**
 * Register a new agent identity.
 * Handles canonical JSON generation, fingerprinting, and persistence.
 */
async function registerAgentIdentity(params) {
    const { display_name, role, mission, org_id, tier = "builder" } = params;
    // 1. Generate or validate agent_id
    const slug = display_name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 32);
    const suffix = (0, crypto_1.randomBytes)(3).toString("hex");
    const agent_id = params.agent_id || `agent_${slug}_${suffix}`;
    // 2. Build canonical JSON (the source of truth for the hash)
    const canonical_identity = {
        agent_id,
        display_name,
        role,
        mission,
        org_id,
        created_at: new Date().toISOString(),
    };
    const canonical_identity_json = JSON.stringify(canonical_identity);
    // 3. Compute Fingerprint
    const identity_fingerprint = computeFingerprint(canonical_identity_json);
    // 4. Persist to Firestore
    const agentData = {
        agent_id,
        display_name,
        canonical_identity_json,
        identity_fingerprint,
        fingerprint: identity_fingerprint, // UI compat alias
        agent_class: role,
        jurisdiction: "ACEPLACE-AGENTSPACE",
        mission,
        tier: tier, // Compat with existing schema
        created_at: new Date().toISOString(),
        last_verified_at: null,
    };
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.AGENTS)
        .doc(agent_id)
        .set(agentData);
    return { agent_id, identity_fingerprint };
}
/**
 * Remove an agent identity record and its associated data.
 */
async function deleteAgentIdentity(agentId) {
    const { deleteAgent } = await Promise.resolve().then(() => __importStar(require("../kernels/persistence")));
    await deleteAgent(agentId);
}
/**
 * Quarantine an envelope — routes THROUGH the state machine so that:
 *   1. The transition is validated (legal from current state)
 *   2. A STATUS_TRANSITION_QUARANTINED trace is always written
 *
 * AUDIT FIX P0#4: Never write quarantined status directly — always via state machine.
 */
async function quarantineEnvelope(envelopeId, reason) {
    try {
        const transitionFn = await getTransition();
        await transitionFn(envelopeId, "quarantined", { reason });
    }
    catch (smErr) {
        // If state machine rejects the transition (e.g. already terminal),
        // fall back to direct write to guarantee the record is marked quarantined.
        // This is the ONLY acceptable direct-write path.
        console.warn(`[IDENTITY] State machine rejected quarantine transition for ${envelopeId} (${smErr?.message}). ` +
            `Applying direct fallback.`);
        await (0, db_1.getDb)()
            .collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES)
            .doc(envelopeId)
            .update({
            status: "quarantined",
            updated_at: new Date().toISOString(),
            quarantine_reason: reason,
        });
        // Still write an explicit trace for the fallback path
        const traceId = (0, hash_1.generateTraceId)("QUARANTINED_FALLBACK");
        await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
            trace_id: traceId,
            envelope_id: envelopeId,
            agent_id: "system",
            identity_fingerprint: "",
            event_type: "ENVELOPE_QUARANTINED",
            timestamp: new Date().toISOString(),
            metadata: { reason, fallback: true },
        });
    }
}
/**
 * Log an identity event to execution_traces.
 */
async function logIdentityTrace(envelopeId, agentId, fingerprint, eventType) {
    const traceId = (0, hash_1.generateTraceId)(eventType);
    await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
        trace_id: traceId,
        envelope_id: envelopeId,
        agent_id: agentId,
        identity_fingerprint: fingerprint,
        event_type: eventType,
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=identity.js.map