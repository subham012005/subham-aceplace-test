/**
 * Prime guard cache for a batch of steps before parallel execution (deduped per agent).
 */

import { acelogicExecutionGuard } from "./acelogic-guard";

export async function batchPrimeExecutionGuards(
  agents: {
    agent_id: string;
    identity_fingerprint: string;
    instance_id: string;
    org_id: string;
    license_id: string;
  }[]
): Promise<void> {
  const seen = new Set<string>();
  const unique: typeof agents = [];
  for (const a of agents) {
    const k = `${a.agent_id}:${a.instance_id}:${a.license_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(a);
  }
  await Promise.all(unique.map((a) => acelogicExecutionGuard(a)));
}
