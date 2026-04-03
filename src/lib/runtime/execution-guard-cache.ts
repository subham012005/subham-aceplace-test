/**
 * Per-process execution guard cache (ACEPLACE spec) — TTL tied to lease expiry or 10s fallback.
 */

import type { ExecutionGuardResult } from "./types";

type Cached = { result: ExecutionGuardResult; expiresAt: number };

const guardCache = new Map<string, Cached>();

function keyOf(p: {
  agent_id: string;
  instance_id: string;
  license_id: string;
}) {
  return `${p.agent_id}:${p.instance_id}:${p.license_id}`;
}

export function getCachedGuard(params: {
  agent_id: string;
  instance_id: string;
  license_id: string;
}): ExecutionGuardResult | null {
  const k = keyOf(params);
  const e = guardCache.get(k);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    guardCache.delete(k);
    return null;
  }
  return e.result;
}

export function setCachedGuard(
  params: {
    agent_id: string;
    instance_id: string;
    license_id: string;
  },
  result: ExecutionGuardResult
): void {
  const leaseExpiry = result.lease?.lease_expires_at
    ? new Date(result.lease.lease_expires_at).getTime()
    : Date.now() + 10_000;
  guardCache.set(keyOf(params), {
    result,
    expiresAt: Math.min(leaseExpiry, Date.now() + 60_000),
  });
}

export function invalidateGuard(params: {
  agent_id: string;
  instance_id: string;
  license_id: string;
}): void {
  guardCache.delete(keyOf(params));
}
