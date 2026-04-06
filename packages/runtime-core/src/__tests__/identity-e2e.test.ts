/**
 * Identity & Runtime — End-to-End Integration Test
 *
 * Proves the critical identity invariant through a complete execution path:
 *
 *   1.  Register agent identity  (agents collection)
 *   2.  Build envelope with correct fingerprint
 *   3.  Persist envelope to execution_envelopes
 *   4.  Add entry to execution_queue
 *   5.  Worker claims the queue entry (status: queued → claimed)
 *   6.  verifyIdentity()           — fingerprint verified against stored agent record
 *   7.  acquirePerAgentLease()     — per-agent lease written to envelope
 *   8.  claimEnvelopeStep()        — step status: ready → executing
 *   9.  finalizeEnvelopeStep()     — step status: executing → completed
 *   10. Assert execution_traces contains an IDENTITY_VERIFIED event
 *
 * Also verifies the mismatch path:
 *   - tampered fingerprint in identity_context → verifyIdentity returns verified:false
 *   - envelope status transitions to "quarantined"
 *
 * Uses an in-memory Firestore mock — no live connection required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeFingerprint } from "../kernels/identity";
import { buildEnvelope } from "../envelope-builder";
import { planEnvelopeSteps } from "../step-planner";
import { COLLECTIONS } from "../constants";
import type { AgentIdentity, ExecutionEnvelope, IdentityContext } from "../types";

// ── In-memory Firestore mock ──────────────────────────────────────────────────

type DocData = Record<string, unknown>;

class MockFirestore {
  private store: Map<string, DocData> = new Map();
  public traces: DocData[] = [];

  private key(col: string, id: string) {
    return `${col}/${id}`;
  }

  read(col: string, id: string): { exists: boolean; data: () => DocData | undefined } {
    const d = this.store.get(this.key(col, id));
    return { exists: d !== undefined, data: () => (d ? { ...d } : undefined) };
  }

  write(col: string, id: string, data: DocData, merge = false) {
    const k = this.key(col, id);
    const base = merge ? (this.store.get(k) ?? {}) : {};
    this.store.set(k, { ...base, ...data });
    if (col === COLLECTIONS.EXECUTION_TRACES) {
      this.traces.push({ ...data });
    }
  }

  patch(col: string, id: string, updates: DocData) {
    const k = this.key(col, id);
    const existing: DocData = { ...(this.store.get(k) ?? {}) };
    for (const [field, val] of Object.entries(updates)) {
      if (field.includes(".")) {
        // Handle dot-notation keys e.g. "authority_leases.agent_coo"
        const parts = field.split(".");
        let cursor: any = existing;
        for (let i = 0; i < parts.length - 1; i++) {
          if (cursor[parts[i]] == null || typeof cursor[parts[i]] !== "object") {
            cursor[parts[i]] = {};
          }
          cursor = cursor[parts[i]];
        }
        cursor[parts[parts.length - 1]] = val;
      } else {
        existing[field] = val;
      }
    }
    this.store.set(k, existing);
    if (col === COLLECTIONS.EXECUTION_TRACES) {
      this.traces.push({ ...existing });
    }
  }

  reset() {
    this.store.clear();
    this.traces = [];
  }
}

const mockFs = new MockFirestore();

function buildMockDb(fs: MockFirestore) {
  function docRef(col: string, id: string) {
    return {
      get: async () => fs.read(col, id),
      set: async (data: DocData, opts?: { merge?: boolean }) =>
        fs.write(col, id, data, opts?.merge),
      update: async (patch: DocData) => fs.patch(col, id, patch),
    };
  }

  return {
    collection: (col: string) => ({
      doc: (id: string) => docRef(col, id),
      where: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ empty: true, docs: [] }),
          }),
        }),
      }),
    }),
    /**
     * Minimal transaction: buffers tx.update / tx.set ops, flushes after fn resolves.
     * tx.get reads directly from the store so the callback sees current state.
     */
    runTransaction: async (fn: (tx: any) => Promise<unknown>) => {
      const deferred: Array<() => Promise<void>> = [];
      const tx = {
        get: async (ref: ReturnType<typeof docRef>) => ref.get(),
        update: (ref: ReturnType<typeof docRef>, patch: DocData) => {
          deferred.push(() => ref.update(patch));
        },
        set: (
          ref: ReturnType<typeof docRef>,
          data: DocData,
          opts?: { merge?: boolean }
        ) => {
          deferred.push(() => ref.set(data, opts));
        },
      };
      const result = await fn(tx);
      for (const op of deferred) await op();
      return result;
    },
  };
}

vi.mock("../db", () => ({
  getDb: () => buildMockDb(mockFs),
}));

// ── Import modules under test AFTER mock is in place ─────────────────────────
// Dynamic imports ensure the vi.mock hoisting has taken effect.
const { verifyIdentity } = await import("../kernels/identity");
const { acquirePerAgentLease } = await import("../per-agent-authority");
const { claimEnvelopeStep, finalizeEnvelopeStep } = await import("../parallel-runner");

// ── Helpers ───────────────────────────────────────────────────────────────────

const AGENT_ID = "agent_coo_e2e";
const INSTANCE_ID = "worker_instance_e2e_001";

function makeAgentRecord(): AgentIdentity {
  const canonical = JSON.stringify({
    agent_id: AGENT_ID,
    display_name: "COO E2E",
    role: "coordinator",
    mission: "Orchestrate tasks deterministically",
    org_id: "org_test",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  const fingerprint = computeFingerprint(canonical);
  return {
    agent_id: AGENT_ID,
    display_name: "COO E2E",
    canonical_identity_json: canonical,
    identity_fingerprint: fingerprint,
    fingerprint,
    agent_class: "coordinator",
    jurisdiction: "NXQ-AGENTSPACE",
    mission: "Orchestrate tasks deterministically",
    tier: 1 as any,
    created_at: "2026-01-01T00:00:00.000Z",
    last_verified_at: null as any,
  };
}

function makeIdentityContext(agent: AgentIdentity): IdentityContext {
  return {
    agent_id: agent.agent_id,
    identity_fingerprint: agent.identity_fingerprint,
    fingerprint: agent.identity_fingerprint,
    verified: true,
    verified_at: new Date().toISOString(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Identity + Runtime — End-to-End: happy path", () => {
  let envelope: ExecutionEnvelope;
  let agent: AgentIdentity;

  beforeEach(() => {
    mockFs.reset();

    // Step 1: Register agent in agents collection
    agent = makeAgentRecord();
    mockFs.write(COLLECTIONS.AGENTS, AGENT_ID, agent as unknown as DocData);

    // Step 2: Build envelope with correct fingerprint
    const idCtx = makeIdentityContext(agent);
    const steps = planEnvelopeSteps({
      require_human_approval: false,
      role_assignments: {
        COO: AGENT_ID,
        Researcher: AGENT_ID,
        Worker: AGENT_ID,
        Grader: AGENT_ID,
      },
    });

    // Single-agent envelope so all steps share the same agent
    envelope = buildEnvelope({
      orgId: "org_test",
      prompt: "E2E identity test task",
      identityContext: idCtx,
      identity_contexts: { [AGENT_ID]: idCtx },
      steps,
    });

    // Step 3: Persist envelope
    mockFs.write(
      COLLECTIONS.EXECUTION_ENVELOPES,
      envelope.envelope_id,
      envelope as unknown as DocData
    );

    // Step 4: Add to execution_queue
    mockFs.write(COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id, {
      envelope_id: envelope.envelope_id,
      status: "queued",
      created_at: new Date().toISOString(),
    });
  });

  it("step 5 — worker claims the queue entry", () => {
    // Simulate worker claim: queued → claimed
    mockFs.patch(COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id, {
      status: "claimed",
      claimed_by: INSTANCE_ID,
      claimed_at: new Date().toISOString(),
    });

    const entry = mockFs.read(COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id);
    expect(entry.exists).toBe(true);
    expect((entry.data() as any).status).toBe("claimed");
    expect((entry.data() as any).claimed_by).toBe(INSTANCE_ID);
  });

  it("step 6 — verifyIdentity succeeds with correct fingerprint", async () => {
    const result = await verifyIdentity(
      envelope.envelope_id,
      AGENT_ID,
      envelope
    );

    expect(result.verified).toBe(true);
    expect(result.agent_id).toBe(AGENT_ID);
    expect(result.verified_at).toBeTruthy();

    // last_verified_at must be written back to the agent record
    const updatedAgent = mockFs.read(COLLECTIONS.AGENTS, AGENT_ID);
    expect((updatedAgent.data() as any).last_verified_at).toBeTruthy();
  });

  it("step 6 — verifyIdentity writes IDENTITY_VERIFIED trace", async () => {
    await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);

    const verifiedTrace = mockFs.traces.find(
      (t) => t["event_type"] === "IDENTITY_VERIFIED"
    );
    expect(verifiedTrace).toBeDefined();
    expect(verifiedTrace!["envelope_id"]).toBe(envelope.envelope_id);
    expect(verifiedTrace!["agent_id"]).toBe(AGENT_ID);
    expect((verifiedTrace!["identity_fingerprint"] as string).length).toBe(64);
  });

  it("step 7 — acquirePerAgentLease writes lease to envelope", async () => {
    const lease = await acquirePerAgentLease(
      envelope.envelope_id,
      AGENT_ID,
      INSTANCE_ID
    );

    expect(lease.agent_id).toBe(AGENT_ID);
    expect(lease.current_instance_id).toBe(INSTANCE_ID);
    expect(lease.status).toBe("active");

    const envDoc = mockFs.read(
      COLLECTIONS.EXECUTION_ENVELOPES,
      envelope.envelope_id
    );
    const stored = envDoc.data() as any;
    expect(stored.authority_leases?.[AGENT_ID]).toBeDefined();
    expect(stored.authority_leases[AGENT_ID].current_instance_id).toBe(INSTANCE_ID);
  });

  it("steps 8+9 — claimEnvelopeStep then finalizeEnvelopeStep updates step status", async () => {
    const firstStep = envelope.steps[0];
    expect(firstStep.status).toBe("ready");

    // Step 8: claim
    await claimEnvelopeStep({
      envelope_id: envelope.envelope_id,
      step_id: firstStep.step_id,
      instance_id: INSTANCE_ID,
    });

    let envDoc = mockFs.read(COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
    let steps = (envDoc.data() as any).steps as any[];
    let claimed = steps.find((s: any) => s.step_id === firstStep.step_id);
    expect(claimed.status).toBe("executing");
    expect(claimed.claimed_by_instance_id).toBe(INSTANCE_ID);

    // Step 9: finalize
    await finalizeEnvelopeStep({
      envelope_id: envelope.envelope_id,
      step_id: firstStep.step_id,
      status: "completed",
      output_ref: { artifact_id: "artifact_e2e_001" },
    });

    envDoc = mockFs.read(COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
    steps = (envDoc.data() as any).steps as any[];
    const finalized = steps.find((s: any) => s.step_id === firstStep.step_id);
    expect(finalized.status).toBe("completed");
    expect((finalized.output_ref as any).artifact_id).toBe("artifact_e2e_001");
  });

  it("full flow — identity verify + lease acquire + step claim/finalize in sequence", async () => {
    // Claim queue entry
    mockFs.patch(COLLECTIONS.EXECUTION_QUEUE, envelope.envelope_id, {
      status: "claimed",
      claimed_by: INSTANCE_ID,
    });

    // Identity verify
    const idResult = await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);
    expect(idResult.verified).toBe(true);

    // Acquire lease
    const lease = await acquirePerAgentLease(
      envelope.envelope_id,
      AGENT_ID,
      INSTANCE_ID
    );
    expect(lease.status).toBe("active");

    // Claim step
    const step = envelope.steps[0];
    await claimEnvelopeStep({
      envelope_id: envelope.envelope_id,
      step_id: step.step_id,
      instance_id: INSTANCE_ID,
    });

    // Finalize step
    await finalizeEnvelopeStep({
      envelope_id: envelope.envelope_id,
      step_id: step.step_id,
      status: "completed",
    });

    // Assert trace was written
    const identityTrace = mockFs.traces.find(
      (t) => t["event_type"] === "IDENTITY_VERIFIED"
    );
    expect(identityTrace).toBeDefined();
    expect(identityTrace!["envelope_id"]).toBe(envelope.envelope_id);

    // Assert final step state
    const envDoc = mockFs.read(COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id);
    const finalStep = (envDoc.data() as any).steps.find(
      (s: any) => s.step_id === step.step_id
    );
    expect(finalStep.status).toBe("completed");
  });
});

describe("Identity + Runtime — End-to-End: mismatch path", () => {
  let envelope: ExecutionEnvelope;

  beforeEach(() => {
    mockFs.reset();

    const agent = makeAgentRecord();
    mockFs.write(COLLECTIONS.AGENTS, AGENT_ID, agent as unknown as DocData);

    // Build envelope with a TAMPERED fingerprint
    const tamperedCtx: IdentityContext = {
      agent_id: AGENT_ID,
      identity_fingerprint: computeFingerprint(
        JSON.stringify({ agent_id: "agent_evil", role: "attacker" })
      ),
      verified: false,
      verified_at: new Date().toISOString(),
    };

    const steps = planEnvelopeSteps({
      require_human_approval: false,
      role_assignments: {
        COO: AGENT_ID,
        Researcher: AGENT_ID,
        Worker: AGENT_ID,
        Grader: AGENT_ID,
      },
    });

    envelope = buildEnvelope({
      orgId: "org_test",
      prompt: "Tampered identity test",
      identityContext: tamperedCtx,
      identity_contexts: { [AGENT_ID]: tamperedCtx },
      steps,
    });

    mockFs.write(
      COLLECTIONS.EXECUTION_ENVELOPES,
      envelope.envelope_id,
      { ...envelope, status: "leased" } as unknown as DocData
    );
  });

  it("verifyIdentity returns verified:false on fingerprint mismatch", async () => {
    const result = await verifyIdentity(
      envelope.envelope_id,
      AGENT_ID,
      envelope
    );

    expect(result.verified).toBe(false);
    expect(result.reason).toBe("IDENTITY_FINGERPRINT_MISMATCH");
  });

  it("fingerprint mismatch transitions envelope to quarantined", async () => {
    await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);

    const envDoc = mockFs.read(
      COLLECTIONS.EXECUTION_ENVELOPES,
      envelope.envelope_id
    );
    expect((envDoc.data() as any).status).toBe("quarantined");
  });

  it("fingerprint mismatch writes IDENTITY_FINGERPRINT_MISMATCH trace", async () => {
    await verifyIdentity(envelope.envelope_id, AGENT_ID, envelope);

    const mismatchTrace = mockFs.traces.find(
      (t) => t["event_type"] === "IDENTITY_FINGERPRINT_MISMATCH"
    );
    expect(mismatchTrace).toBeDefined();
    expect(mismatchTrace!["envelope_id"]).toBe(envelope.envelope_id);
  });
});

describe("Identity + Runtime — End-to-End: FORK_DETECTED", () => {
  let envelope: ExecutionEnvelope;

  beforeEach(() => {
    mockFs.reset();

    const agent = makeAgentRecord();
    mockFs.write(COLLECTIONS.AGENTS, AGENT_ID, agent as unknown as DocData);

    const idCtx = makeIdentityContext(agent);
    const steps = planEnvelopeSteps({
      require_human_approval: false,
      role_assignments: {
        COO: AGENT_ID,
        Researcher: AGENT_ID,
        Worker: AGENT_ID,
        Grader: AGENT_ID,
      },
    });

    envelope = buildEnvelope({
      orgId: "org_test",
      prompt: "Fork detection test",
      identityContext: idCtx,
      identity_contexts: { [AGENT_ID]: idCtx },
      steps,
    });

    // Persist envelope with an active lease already held by a DIFFERENT instance
    const existingLease = {
      lease_id: "lease_existing_001",
      agent_id: AGENT_ID,
      current_instance_id: "worker_other_instance",
      lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      acquired_at: new Date().toISOString(),
      last_renewed_at: new Date().toISOString(),
      status: "active",
    };

    mockFs.write(COLLECTIONS.EXECUTION_ENVELOPES, envelope.envelope_id, {
      ...(envelope as unknown as DocData),
      authority_leases: { [AGENT_ID]: existingLease },
    });
  });

  it("acquirePerAgentLease throws FORK_DETECTED when another instance holds the lease", async () => {
    await expect(
      acquirePerAgentLease(envelope.envelope_id, AGENT_ID, INSTANCE_ID)
    ).rejects.toThrow("FORK_DETECTED");
  });
});
