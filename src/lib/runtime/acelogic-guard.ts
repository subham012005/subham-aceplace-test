/**
 * Thin client to ACELOGIC control plane (identity verify + optional lease acquire).
 * When ACELOGIC_API_URL is unset, verifies locally via envelope identity only.
 */

import type { ExecutionGuardResult } from "./types";

function inferGateFromLease(
  lease: ExecutionGuardResult["lease"]
): number {
  if (!lease) return 1;
  if (lease.status === "active") return 5;
  return 1;
}

function isCapabilityDenied(status: number, body: unknown): boolean {
  if (status !== 403) return false;
  const err = (body as { error?: string })?.error;
  return err === "CAPABILITY_DENIED" || err === "GATE_DENIED";
}

export async function acelogicExecutionGuard(params: {
  agent_id: string;
  identity_fingerprint: string;
  instance_id: string;
  org_id: string;
  license_id: string;
}): Promise<ExecutionGuardResult> {
  const base = process.env.ACELOGIC_API_URL?.replace(/\/+$/, "");
  if (!base) {
    return {
      allowed: true,
      identity_context: {
        agent_id: params.agent_id,
        identity_fingerprint: params.identity_fingerprint,
        instance_id: params.instance_id,
        gate_level: 1,
      },
      lease: null,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-license-id": params.license_id,
    "x-org-id": params.org_id,
  };

  const identityRes = await fetch(`${base}/acelogic/identity/verify`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      agent_id: params.agent_id,
      identity_fingerprint: params.identity_fingerprint,
      instance_id: params.instance_id,
    }),
  });
  const identityJson = (await identityRes.json()) as { valid?: boolean };
  if (!identityRes.ok || !identityJson.valid) {
    return {
      allowed: false,
      identity_context: {
        agent_id: params.agent_id,
        identity_fingerprint: params.identity_fingerprint,
        instance_id: params.instance_id,
        gate_level: 0,
      },
      lease: null,
    };
  }

  let lease: ExecutionGuardResult["lease"] = null;
  try {
    const leaseRes = await fetch(`${base}/acelogic/authority/lease/acquire`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        agent_id: params.agent_id,
        instance_id: params.instance_id,
      }),
    });
    const leaseJson = (await leaseRes.json()) as {
      lease_id?: string;
      lease_expires_at?: string;
      status?: "active" | "expired" | "revoked";
    };
    if (leaseRes.ok && leaseJson.lease_id) {
      lease = {
        lease_id: leaseJson.lease_id,
        lease_expires_at:
          leaseJson.lease_expires_at ||
          new Date(Date.now() + 60_000).toISOString(),
        status: leaseJson.status ?? "active",
      };
    } else if (isCapabilityDenied(leaseRes.status, leaseJson)) {
      lease = null;
    } else if (!leaseRes.ok) {
      throw new Error(`ACELOGIC_LEASE_HTTP_${leaseRes.status}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("ACELOGIC_LEASE_HTTP_")) throw e;
    lease = null;
  }

  return {
    allowed: true,
    identity_context: {
      agent_id: params.agent_id,
      identity_fingerprint: params.identity_fingerprint,
      instance_id: params.instance_id,
      gate_level: inferGateFromLease(lease),
    },
    lease,
  };
}
