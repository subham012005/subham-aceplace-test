/**
 * Authority Kernel — Phase 2
 *
 * Lease is EMBEDDED inside execution_envelopes.authority_lease.
 * No separate leases collection.
 *
 * Rules:
 * - If no lease → acquire
 * - If lease expired → acquire (replace)
 * - If lease active AND different instance → STOP (quarantine = fork detected)
 * - Lease MUST be checked before EVERY step
 *
 * Phase 2 | Envelope-Driven Runtime
 */

import { getDb } from "../db";
import { COLLECTIONS, DEFAULT_LEASE_DURATION_SECONDS, MAX_LEASE_DURATION_SECONDS } from "../constants";
import { generateTraceId } from "../hash";
import type { ExecutionEnvelope, AuthorityLease, LeaseAcquireResult } from "../types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Acquire a time-bound execution lease embedded in the envelope.
 * Uses Firestore transaction to prevent race conditions.
 *
 * @param envelopeId  - ID of the envelope to lease
 * @param instanceId  - Unique ID for this runtime instance
 * @param durationSeconds - Lease duration (clamped to MAX_LEASE_DURATION_SECONDS)
 */
export async function acquireLease(
  envelopeId: string,
  instanceId: string,
  durationSeconds: number = DEFAULT_LEASE_DURATION_SECONDS
): Promise<LeaseAcquireResult> {
  const db = getDb();
  const envelopeRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
  const duration = Math.min(durationSeconds, MAX_LEASE_DURATION_SECONDS);
  const now = new Date();

  return db.runTransaction(async (tx) => {
    console.log(`[AUTHORITY] Starting transaction for envelope: ${envelopeId}`);
    const snap = await tx.get(envelopeRef);
    if (!snap.exists) {
      console.error(`[AUTHORITY] Envelope ${envelopeId} not found in Firestore.`);
      throw new Error(`Envelope ${envelopeId} not found`);
    }

    const envelope = snap.data() as ExecutionEnvelope;
    const existing = envelope.authority_lease;

    console.log(`[AUTHORITY] Envelope status: ${envelope.status}, Existing lease:`, existing);

    // Check for fork: active lease held by DIFFERENT instance
    if (existing && new Date(existing.expires_at) > now) {
      if (existing.holder_instance_id !== instanceId) {
        console.warn(`[AUTHORITY] FORK DETECTED for ${envelopeId}. Current holder: ${existing.holder_instance_id}, New instance: ${instanceId}`);
        // FORK DETECTED — quarantine immediately
        tx.update(envelopeRef, {
          status: "quarantined",
          updated_at: now.toISOString(),
        });
        await logAuthorityTrace(envelopeId, instanceId, "LEASE_FORK_DETECTED", {
          conflicting_instance: existing.holder_instance_id,
        });
        return {
          acquired: false,
          authority_lease: null,
          reason: "fork_detected",
        } as LeaseAcquireResult;
      }
      console.log(`[AUTHORITY] Lease already held by instance: ${instanceId}`);
      // Same instance — lease already held, return existing
      return {
        acquired: true,
        authority_lease: existing,
        reason: "already_held",
      } as LeaseAcquireResult;
    }

    // No lease or lease expired — acquire new lease
    const expiresAt = new Date(now.getTime() + duration * 1000).toISOString();
    const newLease: AuthorityLease = {
      holder_instance_id: instanceId,
      leased_at: now.toISOString(),
      expires_at: expiresAt,
    };

    console.log(`[AUTHORITY] Acquiring new lease for ${envelopeId}, instance: ${instanceId}, expires at: ${expiresAt}`);

    tx.update(envelopeRef, {
      authority_lease: newLease,
      status: "leased",
      updated_at: now.toISOString(),
    });

    await logAuthorityTrace(envelopeId, instanceId, "LEASE_ACQUIRED", {
      expires_at: expiresAt,
      duration_seconds: duration,
    });

    console.log(`[AUTHORITY] Lease acquired successfully for ${envelopeId}`);

    return {
      acquired: true,
      authority_lease: newLease,
      reason: "ok",
    } as LeaseAcquireResult;
  });
}

/**
 * Release the lease embedded in the envelope.
 * Clears authority_lease field.
 */
export async function releaseLease(
  envelopeId: string,
  instanceId: string
): Promise<boolean> {
  const db = getDb();
  const envelopeRef = db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);

  const snap = await envelopeRef.get();
  if (!snap.exists) return false;

  const envelope = snap.data() as ExecutionEnvelope;
  if (!envelope.authority_lease) return false;

  // Only the holder can release
  if (envelope.authority_lease.holder_instance_id !== instanceId) {
    return false;
  }

  await envelopeRef.update({
    authority_lease: null,
    updated_at: new Date().toISOString(),
  });

  await logAuthorityTrace(envelopeId, instanceId, "LEASE_RELEASED", {});
  return true;
}

/**
 * Check if the envelope has a valid (non-expired) lease for a given instance.
 * Must be called BEFORE every step execution.
 */
export function hasValidLease(
  envelope: ExecutionEnvelope,
  instanceId: string
): boolean {
  const lease = envelope.authority_lease;
  if (!lease) return false;
  if (lease.holder_instance_id !== instanceId) return false;
  return new Date(lease.expires_at) > new Date();
}

/**
 * Log an authority event to execution_traces.
 */
async function logAuthorityTrace(
  envelopeId: string,
  instanceId: string,
  eventType: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const traceId = generateTraceId(eventType);
  await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
    trace_id: traceId,
    envelope_id: envelopeId,
    agent_id: instanceId,
    identity_fingerprint: "",
    event_type: eventType,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

/**
 * Phase 2 stub — stale lease cleanup is performed directly by the cron route
 * by scanning execution_envelopes with expired embedded leases.
 * Kept here for backward-compat; returns 0 (no-op).
 */
export async function expireStaleLeases(): Promise<number> {
  // No-op: Phase 2 cleanup in /api/cron/lease-cleanup/route.ts
  return 0;
}
