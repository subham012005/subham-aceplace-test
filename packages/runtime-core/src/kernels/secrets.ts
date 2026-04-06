/**
 * Secrets Kernel — Phase 2
 *
 * Manages agent-specific credentials and environment variables.
 * Note: While currently stored in Firestore, these are restricted to 
 * server-side runtime functions.
 *
 * Phase 2 | Secrets Management
 */

import { getDb } from "../db";
import { COLLECTIONS } from "../constants";

export interface AgentSecrets {
  agent_id: string;
  secrets: Record<string, string>;
  updated_at: string;
}

/**
 * Store or update secrets for an agent.
 */
export async function setAgentSecrets(
  agent_id: string,
  secrets: Record<string, string>
): Promise<void> {
  await getDb()
    .collection(COLLECTIONS.SECRETS)
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
export async function getAgentSecrets(
  agent_id: string
): Promise<Record<string, string> | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.SECRETS)
    .doc(agent_id)
    .get();
    
  if (!doc.exists) return null;
  return (doc.data() as AgentSecrets).secrets;
}

/**
 * List secret names (keys only) for an agent.
 * Use this for UI display to avoid leaking values.
 */
export async function listSecretNames(
  agent_id: string
): Promise<string[]> {
  const secrets = await getAgentSecrets(agent_id);
  if (!secrets) return [];
  return Object.keys(secrets);
}

/**
 * Remove a specific secret key for an agent.
 */
export async function removeAgentSecret(
  agent_id: string,
  key: string
): Promise<void> {
  const secrets = await getAgentSecrets(agent_id);
  if (!secrets) return;
  
  delete secrets[key];
  
  await getDb()
    .collection(COLLECTIONS.SECRETS)
    .doc(agent_id)
    .update({ 
      secrets, 
      updated_at: new Date().toISOString() 
    });
}
