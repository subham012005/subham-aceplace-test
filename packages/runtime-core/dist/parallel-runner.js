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
const guards_1 = require("./runtime/guards");
const resolution_1 = require("./runtime/resolution");
const persistence_1 = require("./kernels/persistence");
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
    let agentId;
    let fingerprint = "00000000";
    let instanceId = runtime_instance_id;
    try {
        // 1. Resolution
        agentId = (0, resolution_1.resolveAssignedAgentId)(envelope, step);
        // 2. Pre-Identity Guards
        (0, guards_1.assertEnvelopeNotTerminal)(envelope);
        (0, guards_1.assertIdentityContext)(envelope);
        (0, guards_1.assertAgentIdentityContext)(envelope, agentId);
        (0, guards_1.assertStepNotCompleted)(step);
        // 3. Identity Verification
        const ident = await (0, identity_1.verifyIdentityForAgent)(envelope_id, envelope, agentId);
        fingerprint = ident.identity_fingerprint || "00000000";
        if (!ident.verified) {
            await (0, persistence_1.addTrace)(envelope_id, step.step_id, agentId, fingerprint, "IDENTITY_FAILED", {
                reason: ident.reason,
            });
            throw new Error(`IDENTITY_FAILED:${ident.reason}`);
        }
        // 4. Identity Verified Guard
        (0, guards_1.assertAgentIdentityVerified)(envelope, agentId);
        await (0, persistence_1.addTrace)(envelope_id, step.step_id, agentId, fingerprint, "IDENTITY_VERIFIED", {
            agent_id: agentId,
            verified_at: ident.verified_at || new Date().toISOString(),
        });
        // 5. Execution Guard
        instanceId = resolveInstanceId(envelope, agentId, runtime_instance_id);
        const licenseId = envelope.license_id || "dev_license";
        const guard = await (0, acelogic_guard_1.acelogicExecutionGuard)({
            agent_id: agentId,
            identity_fingerprint: fingerprint,
            instance_id: instanceId,
            org_id: envelope.org_id,
            license_id: licenseId,
        });
        if (!guard.allowed) {
            throw new Error(`EXECUTION_BLOCKED:${agentId}`);
        }
        // 6. Lease Acquisition
        const forceRenew = step.step_type === "complete";
        await (0, per_agent_authority_1.acquirePerAgentLease)(envelope_id, agentId, instanceId, { forceRenew });
        await (0, persistence_1.addTrace)(envelope_id, step.step_id, agentId, fingerprint, "LEASE_ACQUIRED", {
            instance_id: instanceId,
        });
        await emitSafe({
            event_type: "LEASE_ACQUIRED",
            envelope_id,
            step_id: step.step_id,
            agent_id: agentId,
            org_id: envelope.org_id,
        });
        // 7. Lease Validation Guard
        const refreshed = (await ref.get()).data();
        (0, per_agent_authority_1.validatePerAgentLease)(refreshed, agentId, instanceId);
        (0, guards_1.assertAgentLease)(refreshed, agentId, instanceId);
    }
    catch (err) {
        const msg = err.message || String(err);
        console.error(`[RUNTIME] Preflight failed for step ${step.step_id}: ${msg}`);
        // Explicitly trace the failure
        await (0, persistence_1.addTrace)(envelope_id, step.step_id, "runtime_worker", "00000000", "PREFLIGHT_FAILED", {
            error: msg,
            step_id: step.step_id,
            role: step.role,
        });
        // Deterministic state machine transition
        if (msg.includes("AGENT_NOT_FOUND") || msg.includes("IDENTITY_FAILED") || msg.includes("LEASE_")) {
            await (0, state_machine_1.transition)(envelope_id, "quarantined", {
                reason: msg,
                step_id: step.step_id,
            });
        }
        else {
            await (0, state_machine_1.transition)(envelope_id, "failed", {
                reason: msg,
                step_id: step.step_id,
            });
        }
        throw err;
    }
    const refreshedLeaseEnv = (await ref.get()).data();
    const leaseRow = refreshedLeaseEnv.authority_leases?.[agentId];
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
        // 🔬 Trace emission for audit trail
        await (0, persistence_1.addTrace)(envelope_id, step.step_id, agentId, fingerprint, "STEP_COMPLETED", { duration_ms: duration, message_id: messageId });
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
        await (0, persistence_1.addTrace)(envelope_id, step.step_id, agentId, fingerprint, "LEASE_RELEASED", {
            instance_id: instanceId,
        });
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
 * Audit all 'executing' steps and resolve them to 'completed' (if evidence exists)
 * or 'ready' (if stale/dead owner) to allow resumption.
 */
async function recoverInterruptedSteps(params) {
    const { envelope_id, instance_id, envelope } = params;
    const db = (0, db_1.getDb)();
    const executingSteps = (envelope.steps || []).filter(s => s.status === "executing");
    if (!executingSteps.length)
        return;
    console.log(`[RUNTIME:RECOVER] Checking ${executingSteps.length} executing steps for envelope ${envelope_id}...`);
    for (const step of executingSteps) {
        const owner = step.claimed_by_instance_id;
        if (owner === instance_id)
            continue; // We already own it
        // Evidence check: did it actually finish?
        const evidence = await (0, persistence_1.findStepCompletionEvidence)(envelope_id, step.step_id, step.step_type);
        if (evidence) {
            console.log(`[RUNTIME:RECOVER] Step ${step.step_id} has completion evidence. Auto-healing to 'completed'.`);
            await (0, persistence_1.updateEnvelopeStep)(envelope_id, step.step_id, {
                status: "completed",
                claimed_by_instance_id: null,
                claimed_at: null,
            });
            continue;
        }
        // No evidence. Is the owner dead?
        // In Phase 2, if we have the queue claim, the previous worker is by definition 'dead' for this envelope.
        console.warn(`[RUNTIME:RECOVER] Step ${step.step_id} (owner: ${owner}) stalled with no evidence. Resetting to 'ready'.`);
        await (0, persistence_1.updateEnvelopeStep)(envelope_id, step.step_id, {
            status: "ready",
            claimed_by_instance_id: null,
            claimed_at: null,
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
    // Hard guard: envelope must have steps before we attempt execution.
    (0, guards_1.assertEnvelopeHasSteps)(first);
    // Hard guard: assert that this instance actually owns the queue claim
    const qSnap = await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envelope_id).get();
    if (qSnap.exists) {
        const qData = qSnap.data();
        if (qData?.status === "claimed") {
            (0, guards_1.assertClaimOwnership)(envelope_id, qData.claimed_by, instance_id);
        }
    }
    // 🛡️ RECLAIM_DEBUG block
    const stepStats = {
        total: first.steps.length,
        completed: first.steps.filter(s => s.status === "completed").length,
        runnable: getRunnableSteps(first).length,
        executing: first.steps.filter(s => s.status === "executing").length
    };
    console.log(`[RECLAIM_DEBUG] Envelope: ${envelope_id}`);
    console.log(`[RECLAIM_DEBUG] Queue Status: claimed by ${instance_id}`);
    console.log(`[RECLAIM_DEBUG] Step Counts: total=${stepStats.total}, completed=${stepStats.completed}, executing=${stepStats.executing}, ready=${stepStats.runnable}`);
    // 🔬 RECOVERY: Resolve stale steps before starting the loop
    await recoverInterruptedSteps({ envelope_id, instance_id, envelope: first });
    if (first.status === "created") {
        try {
            await (0, state_machine_1.transition)(envelope_id, "planned");
        }
        catch (e) {
            console.error(`[RUNTIME] Transition to planned failed: ${e.message}`);
        }
    }
    const s1 = (await ref.get()).data();
    if (s1.status === "planned") {
        try {
            await (0, state_machine_1.transition)(envelope_id, "leased");
        }
        catch (e) {
            console.error(`[RUNTIME] Transition to leased failed: ${e.message}`);
        }
    }
    const s2 = (await ref.get()).data();
    if (s2.status === "leased") {
        try {
            await (0, state_machine_1.transition)(envelope_id, "executing");
        }
        catch (e) {
            console.error(`[RUNTIME] Transition to executing failed: ${e.message}`);
        }
    }
    while (true) {
        const snap = await ref.get();
        if (!snap.exists)
            throw new Error("ENVELOPE_NOT_FOUND");
        const envelope = snap.data();
        // 💓 Queue Heartbeat: Signal that this worker is alive and owns the claim
        try {
            await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_QUEUE).doc(envelope_id).update({
                updated_at: new Date().toISOString()
            });
        }
        catch {
            /* ignore heartbeat failures in tests/transient issues */
        }
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
        const runnableSteps = getRunnableSteps(envelope);
        if (!runnableSteps.length) {
            const allSteps = envelope.steps || [];
            const hasRunning = allSteps.some((s) => s.status === "executing");
            const hasPending = allSteps.some((s) => s.status === "pending" || s.status === "ready");
            if (!hasRunning && !hasPending) {
                // HARD GUARD: Envelope may become completed ONLY if every step.status === "completed"
                const everyStepCompleted = allSteps.every((s) => s.status === "completed");
                const anyFailed = allSteps.some((s) => s.status === "failed");
                const anyQuarantined = envelope.status === "quarantined";
                if (anyQuarantined) {
                    await (0, persistence_1.addTrace)(envelope_id, "", "runtime_worker", "00000000", "STATUS_TRANSITION_QUARANTINED", {
                        reason: "Step failure or resolution error triggered quarantine",
                    });
                    return;
                }
                try {
                    if (everyStepCompleted) {
                        // 🛡️ HITL HARDENING: Never auto-complete. Transition to awaiting_human for operator sign-off.
                        await (0, state_machine_1.transition)(envelope_id, "awaiting_human");
                        await (0, persistence_1.addTrace)(envelope_id, "", "runtime_worker", "00000000", "STATUS_TRANSITION_AWAITING_HUMAN", {
                            reason: "All steps finished. Verification required."
                        });
                        // Sync grader score to job doc for dashboard display
                        if (envelope.job_id) {
                            try {
                                const evalStep = allSteps.find(s => s.step_type === "evaluate" || s.step_type === "evaluation");
                                const evalArtifactId = evalStep?.output_ref &&
                                    typeof evalStep.output_ref === "object" &&
                                    evalStep.output_ref.artifact_id;
                                if (evalArtifactId) {
                                    const artDoc = await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.ARTIFACTS).doc(evalArtifactId).get();
                                    if (artDoc.exists) {
                                        let content = artDoc.data()?.artifact_content;
                                        if (typeof content === "string") {
                                            try {
                                                content = JSON.parse(content);
                                            }
                                            catch { /* keep raw */ }
                                        }
                                        if (content && typeof content === "object") {
                                            await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.JOBS).doc(envelope.job_id).set({
                                                grading_result: content,
                                                updated_at: new Date().toISOString(),
                                            }, { merge: true });
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                console.warn(`[RUNTIME] Failed to sync grader score to job: ${e.message}`);
                            }
                        }
                        await emitSafe({
                            event_type: "ENVELOPE_COMPLETED",
                            envelope_id,
                            agent_id: envelope.coordinator_agent_id || envelope.identity_context.agent_id,
                            org_id: envelope.org_id,
                        });
                    }
                    else if (anyFailed) {
                        await (0, state_machine_1.transition)(envelope_id, "failed");
                        await (0, persistence_1.addTrace)(envelope_id, "", "runtime_worker", "00000000", "STATUS_TRANSITION_FAILED", {
                            reason: "Partial step failure",
                        });
                        await emitSafe({
                            event_type: "ENVELOPE_FAILED",
                            envelope_id,
                            org_id: envelope.org_id,
                        });
                    }
                    else {
                        // This should not be reachable if state machine and guards are correct.
                        // But if we have blocked/skipped steps, we might need manual quarantine.
                        console.warn(`[RUNTIME] Envelope ${envelope_id} has neither all completed nor failed steps. Quarantining.`);
                        await (0, state_machine_1.transition)(envelope_id, "quarantined", { reason: "INCOMPLETE_STEP_GRAPH" });
                    }
                }
                catch (e) {
                    console.error(`[RUNTIME] Final transition failed: ${e.message}`);
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