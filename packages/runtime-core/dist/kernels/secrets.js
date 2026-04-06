"use strict";
/**
 * Secrets Kernel — Phase 2
 *
 * Manages agent-specific credentials and environment variables.
 * Note: While currently stored in Firestore, these are restricted to
 * server-side runtime functions.
 *
 * Phase 2 | Secrets Management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setAgentSecrets = setAgentSecrets;
exports.getAgentSecrets = getAgentSecrets;
exports.listSecretNames = listSecretNames;
exports.removeAgentSecret = removeAgentSecret;
const db_1 = require("../db");
const constants_1 = require("../constants");
/**
 * Store or update secrets for an agent.
 */
async function setAgentSecrets(agent_id, secrets) {
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.SECRETS)
        .doc(agent_id)
        .set({
        agent_id,
        secrets,
        updated_at: new Date().toISOString(),
    }, { merge: true });
}
/**
 * Retrieve all secrets for an agent.
 */
async function getAgentSecrets(agent_id) {
    const doc = await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.SECRETS)
        .doc(agent_id)
        .get();
    if (!doc.exists)
        return null;
    return doc.data().secrets;
}
/**
 * List secret names (keys only) for an agent.
 * Use this for UI display to avoid leaking values.
 */
async function listSecretNames(agent_id) {
    const secrets = await getAgentSecrets(agent_id);
    if (!secrets)
        return [];
    return Object.keys(secrets);
}
/**
 * Remove a specific secret key for an agent.
 */
async function removeAgentSecret(agent_id, key) {
    const secrets = await getAgentSecrets(agent_id);
    if (!secrets)
        return;
    delete secrets[key];
    await (0, db_1.getDb)()
        .collection(constants_1.COLLECTIONS.SECRETS)
        .doc(agent_id)
        .update({
        secrets,
        updated_at: new Date().toISOString()
    });
}
//# sourceMappingURL=secrets.js.map