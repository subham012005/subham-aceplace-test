"use strict";
/**
 * Parallel envelope runner — per-agent leases, step claims, #us# message engine
 * (ACEPLACE RUNTIME + State Machine spec).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRunnableSteps = getRunnableSteps;
exports.selectParallelStepBatch = selectParallelStepBatch;
exports.claimEnvelopeStep = claimEnvelopeStep;
exports.finalizeEnvelopeStep = finalizeEnvelopeStep;
exports.runEnvelopeParallel = runEnvelopeParallel;
const identity_1 = require("./kernels/identity");
const state_machine_1 = require("./state-machine");
const constants_1 = require("./constants");
const db_1 = require("./db");
const per_agent_authority_1 = require("./per-agent-authority");
const us_message_engine_1 = require("./us-message-engine");
const acelogic_guard_1 = require("./acelogic-guard");
const batch_execution_guard_1 = require("./batch-execution-guard");
const lease_heartbeat_1 = require("./lease-heartbeat");
const emitRuntimeMetric_1 = require("./telemetry/emitRuntimeMetric");
async function emitSafe(p) {
    try {
        await (0, emitRuntimeMetric_1.emitRuntimeMetric)(p);
    }
    catch {
        /* telemetry must not block execution */
    }
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function dependencySatisfied(step, steps) {
    const deps = step.depends_on || [];
    if (!deps.length)
        return true;
    const map = new Map(steps.map((s) => [s.step_id, s]));
    return deps.every((id) => map.get(id)?.status === "completed");
}
function getRunnableSteps(envelope) {
    return (envelope.steps || []).filter((step) => {
        if (step.status !== "ready" && step.status !== "pending")
            return false;
        return dependencySatisfied(step, envelope.steps || []);
    });
}
function selectParallelStepBatch(params) {
    const max = params.maxParallelSteps ?? 20;
    const selected = [];
    const usedAgents = new Set();
    for (const step of params.runnableSteps) {
        const aid = step.assigned_agent_id;
        if (!aid) {
            selected.push(step);
            if (selected.length >= max)
                break;
            continue;
        }
        if (usedAgents.has(aid))
            continue;
        usedAgents.add(aid);
        selected.push(step);
        if (selected.length >= max)
            break;
    }
    return selected;
}
async function claimEnvelopeStep(params) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(params.envelope_id);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const steps = envelope.steps || [];
        let claimed = false;
        const nextSteps = steps.map((step) => {
            if (step.step_id !== params.step_id)
                return step;
            if (step.status !== "ready" && step.status !== "pending") {
                throw new Error(`STEP_NOT_CLAIMABLE:${step.step_id}`);
            }
            claimed = true;
            return {
                ...step,
                status: "executing",
                claimed_by_instance_id: params.instance_id,
                claimed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        });
        if (!claimed)
            throw new Error("STEP_NOT_FOUND");
        tx.update(ref, { steps: nextSteps, updated_at: new Date().toISOString() });
    });
}
async function finalizeEnvelopeStep(params) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(params.envelope_id);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const steps = envelope.steps || [];
        const nextSteps = steps.map((step) => {
            if (step.step_id !== params.step_id)
                return step;
            const baseOut = typeof step.output_ref === "object" && step.output_ref
                ? { ...step.output_ref }
                : {};
            let mergedOut = step.output_ref;
            if (params.output_ref !== undefined) {
                mergedOut =
                    typeof params.output_ref === "object"
                        ? { ...baseOut, ...params.output_ref }
                        : params.output_ref;
            }
            return {
                ...step,
                status: params.status,
                retry_count: params.retry_count ?? step.retry_count ?? 0,
                output_ref: mergedOut,
                claimed_by_instance_id: null,
                claimed_at: null,
                updated_at: new Date().toISOString(),
            };
        });
        tx.update(ref, { steps: nextSteps, updated_at: new Date().toISOString() });
    });
}
async function pauseForHumanApproval(envelopeId, stepId, coordinatorId) {
    const db = (0, db_1.getDb)();
    const ref = db.collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelopeId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const nextSteps = (envelope.steps || []).map((step) => step.step_id === stepId
            ? { ...step, status: "awaiting_human", updated_at: new Date().toISOString() }
            : step);
        tx.update(ref, { steps: nextSteps, updated_at: new Date().toISOString() });
    });
    await (0, state_machine_1.transition)(envelopeId, "awaiting_human", { step_id: stepId, agent_id: coordinatorId });
}
function resolveInstanceId(envelope, agentId, fallback) {
    const ctx = envelope.multi_agent
        ? envelope.identity_contexts?.[agentId]
        : envelope.identity_context;
    return ctx?.instance_id || fallback;
}
async function executeClaimedStep(params) {
    const { envelope_id, runtime_instance_id, step } = params;
    const ref = (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id);
    const snap = await ref.get();
    if (!snap.exists)
        throw new Error("ENVELOPE_NOT_FOUND");
    const envelope = snap.data();
    if (step.step_type === "human_approval") {
        throw new Error("HUMAN_APPROVAL_USE_PAUSE");
    }
    const agentId = step.assigned_agent_id;
    if (!agentId)
        throw new Error(`STEP_AGENT_MISSING:${step.step_id}`);
    const ident = await (0, identity_1.verifyIdentityForAgent)(envelope_id, envelope, agentId);
    if (!ident.verified) {
        throw new Error(`IDENTITY_FAILED:${ident.reason}`);
    }
    const instanceId = resolveInstanceId(envelope, agentId, runtime_instance_id);
    const licenseId = envelope.license_id || "dev_license";
    const guard = await (0, acelogic_guard_1.acelogicExecutionGuard)({
        agent_id: agentId,
        identity_fingerprint: envelope.multi_agent && envelope.identity_contexts?.[agentId]
            ? envelope.identity_contexts[agentId].identity_fingerprint
            : envelope.identity_context.identity_fingerprint,
        instance_id: instanceId,
        org_id: envelope.org_id,
        license_id: licenseId,
    });
    if (!guard.allowed) {
        throw new Error(`EXECUTION_BLOCKED:${agentId}`);
    }
    await (0, per_agent_authority_1.acquirePerAgentLease)(envelope_id, agentId, instanceId);
    await emitSafe({
        event_type: "LEASE_ACQUIRED",
        envelope_id,
        step_id: step.step_id,
        agent_id: agentId,
        org_id: envelope.org_id,
    });
    const refreshed = (await ref.get()).data();
    (0, per_agent_authority_1.validatePerAgentLease)(refreshed, agentId, instanceId);
    const fingerprint = refreshed.multi_agent && refreshed.identity_contexts?.[agentId]
        ? refreshed.identity_contexts[agentId].identity_fingerprint
        : refreshed.identity_context.identity_fingerprint;
    const leaseRow = refreshed.authority_leases?.[agentId];
    const hbKey = `${envelope_id}:${step.step_id}:${agentId}`;
    lease_heartbeat_1.leaseHeartbeatManager.start(hbKey, {
        envelope_id,
        agent_id: agentId,
        instance_id: instanceId,
    });
    try {
        const startTime = Date.now();
        await emitSafe({
            event_type: "STEP_STARTED",
            envelope_id,
            step_id: step.step_id,
            agent_id: agentId,
            org_id: envelope.org_id,
        });
        const message = (0, us_message_engine_1.createUSMessage)({
            message_type: (0, us_message_engine_1.mapStepTypeToUSMessage)(step.step_type),
            execution: { envelope_id, step_id: step.step_id },
            identity: { agent_id: agentId, identity_fingerprint: fingerprint },
            authority: { lease_id: leaseRow?.lease_id },
            payload: {
                role: step.role,
                work_unit: typeof step.input_ref === "object" && step.input_ref && "work_unit" in step.input_ref
                    ? step.input_ref.work_unit
                    : null,
            },
        });
        const messageId = await (0, us_message_engine_1.storeUSMessage)(message);
        let follow = await (0, us_message_engine_1.handleUSMessage)(message);
        let depth = 0;
        while (follow && depth < 5) {
            await (0, us_message_engine_1.storeUSMessage)(follow);
            follow = await (0, us_message_engine_1.handleUSMessage)(follow);
            depth++;
        }
        const duration = Date.now() - startTime;
        await finalizeEnvelopeStep({
            envelope_id,
            step_id: step.step_id,
            status: "completed",
            output_ref: { message_id: messageId },
        });
        await emitSafe({
            event_type: "STEP_COMPLETED",
            envelope_id,
            step_id: step.step_id,
            agent_id: agentId,
            org_id: envelope.org_id,
            value: duration,
            metadata: { duration_ms: duration },
        });
    }
    finally {
        lease_heartbeat_1.leaseHeartbeatManager.stop(hbKey);
        await (0, per_agent_authority_1.releasePerAgentLease)(envelope_id, agentId).catch(() => undefined);
        await emitSafe({
            event_type: "LEASE_RELEASED",
            envelope_id,
            step_id: step.step_id,
            agent_id: agentId,
            org_id: envelope.org_id,
        });
    }
}
/**
 * Entry: multi-agent deterministic runtime loop with bounded parallelism.
 */
async function runEnvelopeParallel(params) {
    const { envelope_id, instance_id, max_parallel_steps = 20 } = params;
    const ref = (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id);
    const boot = await ref.get();
    if (!boot.exists)
        throw new Error("ENVELOPE_NOT_FOUND");
    const first = boot.data();
    if (first.status === "created") {
        try {
            await (0, state_machine_1.transition)(envelope_id, "leased");
        }
        catch {
            /* ignore */
        }
    }
    const s1 = (await ref.get()).data();
    if (s1.status === "leased") {
        try {
            await (0, state_machine_1.transition)(envelope_id, "planned");
        }
        catch {
            /* ignore */
        }
    }
    const s2 = (await ref.get()).data();
    if (s2.status === "planned") {
        try {
            await (0, state_machine_1.transition)(envelope_id, "executing");
        }
        catch {
            /* ignore */
        }
    }
    while (true) {
        const snap = await ref.get();
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        const terminal = [
            "approved",
            "completed",
            "rejected",
            "failed",
            "quarantined",
            "awaiting_human",
        ];
        if (terminal.includes(envelope.status))
            return;
        const humanApprovalStep = (envelope.steps || []).find((s) => s.step_type === "human_approval" &&
            (s.status === "pending" || s.status === "ready") &&
            dependencySatisfied(s, envelope.steps || []));
        if (humanApprovalStep) {
            await pauseForHumanApproval(envelope_id, humanApprovalStep.step_id, envelope.coordinator_agent_id || envelope.identity_context.agent_id);
            return;
        }
        const runnableSteps = getRunnableSteps(envelope).filter((s) => s.step_type !== "human_approval");
        if (!runnableSteps.length) {
            const hasRunning = (envelope.steps || []).some((s) => s.status === "executing");
            const hasPending = (envelope.steps || []).some((s) => s.status === "pending" || s.status === "ready");
            if (!hasRunning && !hasPending) {
                const anyFailed = (envelope.steps || []).some((s) => s.status === "failed");
                try {
                    await (0, state_machine_1.transition)(envelope_id, anyFailed ? "failed" : "completed");
                    if (!anyFailed) {
                        await emitSafe({
                            event_type: "ENVELOPE_COMPLETED",
                            envelope_id,
                            agent_id: envelope.coordinator_agent_id || envelope.identity_context.agent_id,
                            org_id: envelope.org_id,
                        });
                    }
                    else {
                        await emitSafe({
                            event_type: "ENVELOPE_FAILED",
                            envelope_id,
                            org_id: envelope.org_id,
                        });
                    }
                }
                catch {
                    /* */
                }
                return;
            }
            await sleep(400);
            continue;
        }
        const batch = selectParallelStepBatch({ runnableSteps, maxParallelSteps: max_parallel_steps });
        const claimed = [];
        for (const step of batch) {
            try {
                await claimEnvelopeStep({
                    envelope_id,
                    step_id: step.step_id,
                    instance_id: params.instance_id,
                });
                claimed.push(step);
            }
            catch {
                /* race */
            }
        }
        if (!claimed.length) {
            await sleep(250);
            continue;
        }
        const envForPrime = (await ref.get()).data();
        await (0, batch_execution_guard_1.batchPrimeExecutionGuards)(claimed.map((s) => ({
            agent_id: s.assigned_agent_id,
            identity_fingerprint: envForPrime.multi_agent && envForPrime.identity_contexts?.[s.assigned_agent_id]
                ? envForPrime.identity_contexts[s.assigned_agent_id].identity_fingerprint
                : envForPrime.identity_context.identity_fingerprint,
            instance_id: resolveInstanceId(envForPrime, s.assigned_agent_id, instance_id),
            org_id: envForPrime.org_id,
            license_id: envForPrime.license_id || "dev_license",
        })));
        const results = await Promise.allSettled(claimed.map((step) => executeClaimedStep({
            envelope_id,
            runtime_instance_id: instance_id,
            step,
        })));
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const step = claimed[i];
            if (result.status === "fulfilled")
                continue;
            const err = result.reason;
            console.error(`[RUNTIME] Step ${step.step_id} execution failed:`, err);
            // AUDIT FIX P0#4: FORK_DETECTED must flow through state machine — not raw crash.
            // per-agent-authority now throws this as a pure domain error.
            // We catch it here and perform the canonical quarantine transition.
            if (err?.message === "FORK_DETECTED") {
                console.warn(`[RUNTIME] FORK_DETECTED for step ${step.step_id} — quarantining envelope ${envelope_id}`);
                try {
                    await (0, state_machine_1.transition)(envelope_id, "quarantined", {
                        reason: "FORK_DETECTED",
                        step_id: step.step_id,
                        agent_id: step.assigned_agent_id,
                    });
                }
                catch {
                    /* if already quarantined, ignore */
                }
                return; // Stop runner — envelope is in a terminal state
            }
            const maxR = step.max_retries ?? 2;
            const curR = step.retry_count ?? 0;
            const nextRetry = curR + 1;
            const canRetry = nextRetry < maxR;
            if (canRetry) {
                await finalizeEnvelopeStep({
                    envelope_id,
                    step_id: step.step_id,
                    status: "ready",
                    retry_count: nextRetry,
                });
                const envRetry = (await ref.get()).data();
                await emitSafe({
                    event_type: "STEP_RETRY_SCHEDULED",
                    envelope_id,
                    step_id: step.step_id,
                    agent_id: step.assigned_agent_id || null,
                    org_id: envRetry?.org_id,
                });
            }
            else {
                await finalizeEnvelopeStep({
                    envelope_id,
                    step_id: step.step_id,
                    status: "failed",
                    retry_count: nextRetry,
                });
                const envSnap = await ref.get();
                const orgId = envSnap.exists
                    ? envSnap.data().org_id
                    : undefined;
                await emitSafe({
                    event_type: "STEP_FAILED",
                    envelope_id,
                    step_id: step.step_id,
                    agent_id: step.assigned_agent_id || null,
                    org_id: orgId,
                });
                try {
                    await (0, state_machine_1.transition)(envelope_id, "failed", {
                        step_id: step.step_id,
                        error: String(err?.message || err),
                    });
                }
                catch {
                    /* */
                }
                throw err;
            }
        }
    }
}
//# sourceMappingURL=parallel-runner.js.map