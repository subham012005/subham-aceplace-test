/**
 * Per-agent authority leases on execution_envelopes.authority_leases[agent_id]
 * (ACEPLACE RUNTIME spec).
 *
 * AUDIT FIX P0#4:
 *   This module NEVER writes terminal envelope states (quarantined, failed, etc.).
 *   On fork detection it throws the domain error FORK_DETECTED.
 *   The caller (parallel-runner.ts) is responsible for routing that error
 *   through the state machine via transition().
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";
import { COLLECTIONS, STEP_EXECUTION_MIN_WINDOW_MS } from "./constants";
import { addTrace } from "./kernels/persistence";
import type { AgentAuthorityLease, ExecutionEnvelope } from "./types";

const LEASE_MS = 60_000;

export async function acquirePerAgentLease(
  envelopeId: string,
  agentId: string,
  instanceId: string,
  options?: { forceRenew?: boolean }
): Promise<AgentAuthorityLease> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const existing = envelope.authority_leases?.[agentId];
    const now = Date.now();
    const nowIso = new Date().toISOString();

    if (existing && existing.status !== "expired" && existing.status !== "revoked") {
      const exp = new Date(existing.lease_expires_at).getTime();
      if (exp > now && existing.current_instance_id === instanceId) {
        if (!options?.forceRenew && (exp - now) >= STEP_EXECUTION_MIN_WINDOW_MS) {
          return existing;
        }
        const expiresAt = new Date(now + LEASE_MS).toISOString();
        const lease: AgentAuthorityLease = {
          ...existing,
          lease_expires_at: expiresAt,
          last_renewed_at: nowIso,
          status: "active",
        };
        tx.update(ref, {
          [`authority_leases.${agentId}`]: lease,
          updated_at: nowIso,
        });
        return lease;
      }
      if (exp > now && existing.current_instance_id !== instanceId) {
        // AUDIT FIX P0#4: Do NOT write quarantined status directly from lease code.
        // Throw a pure domain error. parallel-runner.ts catches FORK_DETECTED
        // and calls transition(envelopeId, "quarantined", ...) via the state machine.
        throw new Error("FORK_DETECTED");
      }
    }

    const leaseId = `lease_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(now + LEASE_MS).toISOString();
    const lease: AgentAuthorityLease = {
      lease_id: leaseId,
      agent_id: agentId,
      current_instance_id: instanceId,
      lease_expires_at: expiresAt,
      acquired_at: nowIso,
      last_renewed_at: nowIso,
      status: "active",
    };
    const authority_leases = { ...(envelope.authority_leases || {}), [agentId]: lease };
    tx.update(ref, { authority_leases, updated_at: nowIso });

    // 🔬 Trace emission for audit trail
    await addTrace(
      envelopeId,
      "",
      agentId,
      envelope.identity_contexts?.[agentId]?.identity_fingerprint || "unknown",
      "LEASE_ACQUIRED",
      { lease_id: leaseId, instance_id: instanceId }
    );

    return lease;
  });
}

export function validatePerAgentLease(
  envelope: ExecutionEnvelope,
  agentId: string,
  instanceId: string
): void {
  const lease = envelope.authority_leases?.[agentId];
  if (!lease) throw new Error(`LEASE_MISSING:${agentId}`);
  if (lease.agent_id !== agentId) throw new Error(`LEASE_AGENT_MISMATCH:${agentId}`);
  if (lease.current_instance_id !== instanceId) throw new Error(`LEASE_INSTANCE_MISMATCH:${agentId}`);
  if (lease.status === "expired" || lease.status === "revoked") {
    throw new Error(`LEASE_NOT_ACTIVE:${agentId}`);
  }
  if (new Date(lease.lease_expires_at).getTime() < Date.now()) {
    throw new Error(`LEASE_EXPIRED:${agentId}`);
  }
}

/** Heartbeat / explicit renew — extends lease_expires_at for active same-instance holder. */
export async function renewPerAgentLease(
  envelopeId: string,
  agentId: string,
  instanceId: string
): Promise<AgentAuthorityLease> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data() as ExecutionEnvelope;
    const current = envelope.authority_leases?.[agentId];
    if (!current) throw new Error(`LEASE_MISSING:${agentId}`);
    if (current.current_instance_id !== instanceId) {
      throw new Error(`FORK_DETECTED:${agentId}`);
    }
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + LEASE_MS).toISOString();
    const lease: AgentAuthorityLease = {
      ...current,
      lease_expires_at: expiresAt,
      last_renewed_at: nowIso,
      status: "active",
    };
    tx.update(ref, {
      authority_leases: { ...(envelope.authority_leases || {}), [agentId]: lease },
      updated_at: nowIso,
    });
    return lease;
  });
}

export async function releasePerAgentLease(envelopeId: string, agentId: string): Promise<void> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const envelope = snap.data() as ExecutionEnvelope;
    const current = envelope.authority_leases?.[agentId];
    if (!current) return;
    const released: AgentAuthorityLease = {
      ...current,
      status: "expired",
      lease_expires_at: new Date().toISOString(),
      last_renewed_at: new Date().toISOString(),
    };
    tx.update(ref, {
      authority_leases: { ...(envelope.authority_leases || {}), [agentId]: released },
      updated_at: new Date().toISOString(),
    });
  });
}
