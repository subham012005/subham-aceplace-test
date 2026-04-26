import { adminDb } from "@/lib/firebase-admin";
import * as crypto from "crypto";
import { COLLECTIONS } from "@aceplace/runtime-core";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface CreateJobInput {
    user_id: string;
    requested_agent_id: string;
    job_type: string;
    prompt: string;
    job_id?: string;
    force_crash?: boolean;
}

export interface ApproveJobInput {
    job_id: string;
    user_id?: string;
}

export interface RejectJobInput {
    job_id: string;
    user_id?: string;
    reason?: string;
}

export interface ResurrectJobInput {
    job_id: string;
    user_id?: string;
    reason?: string;
}

export interface ForkSimulateInput {
    job_id: string;
    identity_id: string;
    attempted_by?: string;
    reason?: string;
}

export interface CreateAgentInput {
    agent_id: string;
    display_name?: string;
    agent_class?: string;
    owner_org_id: string;
    acelogic_id?: string;
    governance_profile: string;
    jurisdiction: string;
    mission: string;
    policy?: string;
    identity_version?: string;
    public_key?: string;
    continuity?: {
        status?: string;
        current_instance_id?: string;
        lease_expires_at?: string;
        last_seen_at?: string;
        resurrection_count?: number;
        fork_flag?: boolean;
    };
    anchors?: {
        covenant_hash?: string;
        cvr_polygon?: string;
        cvr_xrpl?: string;
    };
    created_at?: string;
}

// ─────────────────────────────────────────────
// Helper Utilities
// ─────────────────────────────────────────────

function sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
}

function hexFormat(value: string | null | undefined): string | null {
    if (!value) return null;
    const raw = String(value).trim().replace(/^hex:/i, "").replace(/^0x/i, "");
    return `hex:0x${raw}`;
}

/** Strip all hex prefixes ("hex:", "0x") and lowercase — for prefix-agnostic comparison. */
function normalizeFingerprint(value: string | null | undefined): string {
    if (!value) return "";
    return String(value).trim().replace(/^hex:/i, "").replace(/^0x/i, "").toLowerCase();
}

function ensureDb() {
    if (!adminDb) {
        throw new Error("ADMIN_NOT_INITIALIZED: Firebase Admin SDK is not configured.");
    }
    return adminDb;
}

// ─────────────────────────────────────────────
// Workflow Engine
// ─────────────────────────────────────────────

export const workflowEngine = {

    // ─── Create Job ───────────────────────────
    async createJob(input: CreateJobInput) {
        const db = ensureDb();
        const now = new Date().toISOString();

        // Validate required fields
        if (!input.user_id) throw new Error("missing_user_id");
        if (!input.requested_agent_id) throw new Error("missing_requested_agent_id");
        if (!input.job_type) throw new Error("missing_job_type");
        if (!input.prompt?.trim()) throw new Error("missing_prompt");

        const job_id = input.job_id || `job_${Date.now()}`;
        const agent_id = input.requested_agent_id;

        // Look up agent to get identity context
        let identity_fingerprint: string | null = null;
        let instance_id: string | null = null;

        try {
            const agentDoc = await db.collection("agents").doc(agent_id).get();
            if (agentDoc.exists) {
                const agentData = agentDoc.data();
                identity_fingerprint = agentData?.identity_fingerprint || null;
                instance_id = agentData?.continuity_current_instance_id || `inst_${agent_id}_${Date.now()}`;
            } else {
                instance_id = `inst_${agent_id}_${Date.now()}`;
            }
        } catch {
            instance_id = `inst_${agent_id}_${Date.now()}`;
        }

        // Create job record
        const jobData = {
            job_id,
            user_id: input.user_id,
            job_type: input.job_type,
            prompt: input.prompt,
            requested_agent_id: agent_id,
            requested_identity_fingerprint: identity_fingerprint,
            assigned_agent_id: agent_id,
            assigned_instance_id: instance_id,
            identity_id: identity_fingerprint,
            identity_fingerprint,
            status: "queued",
            retry_count: 0,
            created_at: now,
            updated_at: now,
            assigned_at: now,
        };

        await db.collection("jobs").doc(job_id).set(jobData, { merge: true });

        // Create execution trace
        const trace_id = `trace_${Date.now()}`;
        await db.collection("execution_traces").doc(trace_id).set({
            trace_id,
            job_id,
            agent_id,
            instance_id,
            identity_fingerprint,
            event_type: "JOB_ACCEPTED",
            event_status: "queued",
            timestamp: now,
        });

        return {
            success: true,
            job_id,
            status: "queued",
            agent_id,
            instance_id,
            created_at: now,
        };
    },

    // ─── Approve Job ──────────────────────────
    async approveJob(input: ApproveJobInput) {
        const db = ensureDb();
        const now = new Date().toISOString();

        if (!input.job_id) throw new Error("missing_job_id");

        // Find job
        const jobRef = db.collection("jobs").doc(input.job_id);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            // Try querying by job_id field
            const snapshot = await db.collection("jobs").where("job_id", "==", input.job_id).limit(1).get();
            if (snapshot.empty) throw new Error("JOB_NOT_FOUND");

            const doc = snapshot.docs[0];
            const jobData = doc.data();

            // Verify ownership
            if (input.user_id && jobData.user_id !== input.user_id) {
                throw new Error("UNAUTHORIZED");
            }

            // Accept any status that can reasonably have grading data.
            // Job status may lag behind envelope status (e.g. after resurrect),
            // so also check the envelope as source of truth.
            const validStates = ["AWAITING_APPROVAL", "GRADED", "GRADING", "EXECUTING", "COMPLETED", "IN_PROGRESS", "AWAITING_HUMAN", "QUEUED", "CREATED"];
            const jobStatus = String(jobData.status).toUpperCase();
            if (!validStates.includes(jobStatus)) {
                throw new Error(`INVALID_STATE: Approval not allowed in state '${jobData.status}'. Requires AWAITING_APPROVAL or AWAITING_HUMAN.`);
            }
            // For out-of-sync states, verify the envelope is actually ready for approval
            if (["QUEUED", "CREATED"].includes(jobStatus)) {
                const envelopeId = jobData.execution_id || jobData.envelope_id;
                if (envelopeId) {
                    const envDoc = await db.collection("execution_envelopes").doc(envelopeId).get();
                    if (envDoc.exists) {
                        const envStatus = String(envDoc.data()?.status || "").toUpperCase();
                        if (!["AWAITING_HUMAN", "COMPLETED", "AWAITING_APPROVAL"].includes(envStatus)) {
                            throw new Error(`INVALID_STATE: Job status is '${jobData.status}' and envelope is '${envStatus}'. Requires envelope in AWAITING_HUMAN.`);
                        }
                    }
                }
            }

            await doc.ref.update({
                status: "approved",
                approved_at: now,
                approved_by: "operator",
                updated_at: now,
            });

            const envelopeId = jobData.execution_id || jobData.envelope_id;
            if (envelopeId) {
                await db.collection("execution_envelopes").doc(envelopeId).update({
                    status: "approved",
                    updated_at: now
                }).catch(e => console.error("Envelope update failed:", e));
            }

            // Log trace
            await db.collection("job_traces").add({
                job_id: input.job_id,
                user_id: jobData.user_id,
                event_type: "OPERATOR_APPROVED",
                message: "Operator has approved the dimensional manifest.",
                created_at: now,
            });

            return { success: true, status: "approved" };
        }

        const jobData = jobDoc.data()!;

        if (input.user_id && jobData.user_id !== input.user_id) {
            throw new Error("UNAUTHORIZED");
        }

        // Accept any status that can reasonably have grading data:
        const validStates = ["AWAITING_APPROVAL", "GRADED", "GRADING", "EXECUTING", "COMPLETED", "IN_PROGRESS", "AWAITING_HUMAN"];
        if (!validStates.includes(String(jobData.status).toUpperCase())) {
            throw new Error(`INVALID_STATE: Approval not allowed in state '${jobData.status}'. Requires AWAITING_APPROVAL or AWAITING_HUMAN.`);
        }

        await jobRef.update({
            status: "approved",
            approved_at: now,
            approved_by: "operator",
            updated_at: now,
        });

        const envelopeId2 = jobData.execution_id || jobData.envelope_id;
        if (envelopeId2) {
            await db.collection("execution_envelopes").doc(envelopeId2).update({
                status: "approved",
                updated_at: now
            }).catch(e => console.error("Envelope update failed:", e));
        }

        await db.collection("job_traces").add({
            job_id: input.job_id,
            user_id: jobData.user_id,
            event_type: "OPERATOR_APPROVED",
            message: "Operator has approved the dimensional manifest.",
            created_at: now,
        });

        return { success: true, status: "approved" };
    },

    // ─── Reject Job ───────────────────────────
    async rejectJob(input: RejectJobInput) {
        const db = ensureDb();
        const now = new Date().toISOString();

        if (!input.job_id) throw new Error("missing_job_id");

        const reason = input.reason || "Rejected by operator";

        // Find job
        const snapshot = await db.collection("jobs").where("job_id", "==", input.job_id).limit(1).get();
        if (snapshot.empty) {
            // Try direct doc lookup
            const jobRef = db.collection("jobs").doc(input.job_id);
            const jobDoc = await jobRef.get();
            if (!jobDoc.exists) throw new Error("JOB_NOT_FOUND");

            const jobData = jobDoc.data()!;

            if (input.user_id && jobData.user_id !== input.user_id) {
                throw new Error("UNAUTHORIZED");
            }

            // Accept any status that can reasonably have grading data
            const validStates = ["AWAITING_APPROVAL", "GRADED", "GRADING", "EXECUTING", "COMPLETED", "IN_PROGRESS", "AWAITING_HUMAN", "QUEUED", "CREATED"];
            const rJobStatus = String(jobData.status).toUpperCase();
            if (!validStates.includes(rJobStatus)) {
                throw new Error(`INVALID_STATE: Rejection not allowed in state '${jobData.status}'. Requires AWAITING_APPROVAL or AWAITING_HUMAN.`);
            }
            if (["QUEUED", "CREATED"].includes(rJobStatus)) {
                const rEnvelopeId = jobData.execution_id || jobData.envelope_id;
                if (rEnvelopeId) {
                    const rEnvDoc = await db.collection("execution_envelopes").doc(rEnvelopeId).get();
                    if (rEnvDoc.exists) {
                        const rEnvStatus = String(rEnvDoc.data()?.status || "").toUpperCase();
                        if (!["AWAITING_HUMAN", "COMPLETED", "AWAITING_APPROVAL"].includes(rEnvStatus)) {
                            throw new Error(`INVALID_STATE: Job status is '${jobData.status}' and envelope is '${rEnvStatus}'. Requires envelope in AWAITING_HUMAN.`);
                        }
                    }
                }
            }

            await jobRef.update({
                status: "rejected",
                rejected_at: now,
                rejected_by: "operator",
                failure_reason: reason,
                updated_at: now,
            });

            const envelopeId = jobData.execution_id || jobData.envelope_id;
            if (envelopeId) {
                await db.collection("execution_envelopes").doc(envelopeId).update({
                    status: "rejected",
                    updated_at: now
                }).catch(e => console.error("Envelope update failed:", e));
            }

            await db.collection("job_traces").add({
                job_id: input.job_id,
                user_id: jobData.user_id,
                event_type: "OPERATOR_REJECTED",
                message: `Operator has rejected the manifest: ${reason}`,
                created_at: now,
            });

            return { success: true, status: "rejected" };
        }

        const doc = snapshot.docs[0];
        const jobData = doc.data();

        if (input.user_id && jobData.user_id !== input.user_id) {
            throw new Error("UNAUTHORIZED");
        }

        // Accept any status that can reasonably have grading data
        const validStates = ["AWAITING_APPROVAL", "GRADED", "GRADING", "EXECUTING", "COMPLETED", "IN_PROGRESS", "AWAITING_HUMAN"];
        if (!validStates.includes(String(jobData.status).toUpperCase())) {
            throw new Error(`INVALID_STATE: Rejection not allowed in state '${jobData.status}'. Requires AWAITING_APPROVAL or AWAITING_HUMAN.`);
        }

        await doc.ref.update({
            status: "rejected",
            rejected_at: now,
            rejected_by: "operator",
            failure_reason: reason,
            updated_at: now,
        });

        const envelopeId2 = jobData.execution_id || jobData.envelope_id;
        if (envelopeId2) {
            await db.collection("execution_envelopes").doc(envelopeId2).update({
                status: "rejected",
                updated_at: now
            }).catch(e => console.error("Envelope update failed:", e));
        }

        await db.collection("job_traces").add({
            job_id: input.job_id,
            user_id: jobData.user_id,
            event_type: "OPERATOR_REJECTED",
            message: `Operator has rejected the manifest: ${reason}`,
            created_at: now,
        });

        return { success: true, status: "rejected" };
    },

    // ─── Resurrect Job ────────────────────────
    async resurrectJob(input: ResurrectJobInput) {
        const db = ensureDb();
        const now = new Date().toISOString();

        if (!input.job_id) throw new Error("missing_job_id");

        const snapshot = await db.collection("jobs").where("job_id", "==", input.job_id).limit(1).get();
        
        let jobRef;
        let jobData;

        if (snapshot.empty) {
            jobRef = db.collection("jobs").doc(input.job_id);
            const jobDoc = await jobRef.get();
            if (!jobDoc.exists) throw new Error("JOB_NOT_FOUND");
            jobData = jobDoc.data()!;
        } else {
            jobRef = snapshot.docs[0].ref;
            jobData = snapshot.docs[0].data();
        }

        if (input.user_id && jobData.user_id !== input.user_id) {
            throw new Error("UNAUTHORIZED");
        }

        // Differentiate Restart (Rejected) vs Resume (Crashed/Stalled)
        const isRejected = String(jobData.status || "").toLowerCase() === "rejected";
        const restoreType = isRejected ? "restart" : "resume";

        // Increment resurrection count
        const currentCount = Number(jobData.resurrection_count || 0);

        let updates: any = {
            status: "queued",
            quarantine_reason: null,
            failure_reason: null,                 // Clear stale error messages
            restore_type: restoreType,           // tells Python engine: resume vs restart
            resurrection_count: currentCount + 1, // track how many times restored
            resurrected_at: now,
            updated_at: now,
        };

        let message = "Operator has resumed the job. Continuing from exact crash point.";

        // If rejected, force completely fresh restart — wipe all previous agent outputs
        if (isRejected) {
            updates.execution_id = null;
            updates.runtime_context = null;
            message = "Operator has restarted the rejected job. Full pipeline reset from COO Planning.";
        }

        await jobRef.update(updates);

        // ── Reset envelope so the Python runtime loop can re-enter ───────────────
        // BUG FIX: Without this, the Python engine sees a "failed" or mid-crash
        // envelope and immediately aborts. Steps stuck in "executing" are skipped
        // by get_next_ready_step (which only looks for "ready").
        const envelopeId = isRejected
            ? null
            : ((jobData.execution_id as string | undefined) ||
               (jobData.envelope_id as string | undefined) ||
               null);

        if (envelopeId) {
            try {
                const envRef = db.collection("execution_envelopes").doc(envelopeId);
                const envDoc = await envRef.get();
                if (envDoc.exists) {
                    const envData = envDoc.data()!;

                    // Reset the crash-point step back to "ready" so the worker
                    // can pick it up. Two cases need handling:
                    //   "executing" — server died mid-flight (step never finished)
                    //   "failed"    — step ran but threw (ECONNREFUSED when
                    //                 agent-engine was down, LLM timeout, etc.)
                    // Completed steps are always preserved — never re-run them.
                    const steps: any[] = envData.steps || [];
                    const resetSteps = steps.map((s: any) => {
                        if (s.status === "executing" || s.status === "failed") {
                            return { ...s, status: "ready" };
                        }
                        return s;
                    });

                    const envResurrectionCount = Number(envData.resurrection_count || 0);
                    
                    // 🛡️ IDENTITY PROPAGATION FIX: Ensure org_id is correctly mapped to user_id.
                    // If the envelope has 'default' org_id, it will fail strict Phase 2 LLM resolution.
                    const currentOrgId = envData.org_id || "default";
                    const targetOrgId = jobData.user_id || currentOrgId;

                    await envRef.update({
                        status: "created",
                        org_id: targetOrgId, // Auto-heal identity propagation
                        authority_lease: null,
                        authority_leases: {},
                        resurrection_count: envResurrectionCount + 1,
                        steps: resetSteps,
                        updated_at: now,
                    });
                }

                // ── BUG FIX #4: Reset the execution_queue entry ──────────────
                // After a crash, the worker calls finalizeQueueEntry("failed"),
                // setting execution_queue status to "failed".
                // claimNextEnvelope's terminal guard treats a "failed" envelope
                // as permanently dead and the worker NEVER picks it up again.
                // We must requeue it so the worker poll loop can claim it.
                const queueRef = db.collection(COLLECTIONS.EXECUTION_QUEUE).doc(envelopeId);
                const queueDoc = await queueRef.get();
                if (queueDoc.exists) {
                    await queueRef.update({
                        status: "queued",
                        claimed_by: null,
                        claimed_at: null,
                        error: null,
                        finalized_at: null,
                        updated_at: now,
                    });
                } else {
                    // Queue entry may not exist if the job was handled differently —
                    // create it fresh so the worker can pick it up.
                    await queueRef.set({
                        envelope_id: envelopeId,
                        status: "queued",
                        created_at: now,
                        updated_at: now,
                    });
                }
            } catch (envErr: any) {
                // Non-fatal: log and continue.
                console.warn("[RESURRECT] Envelope/queue reset failed:", envErr.message);
            }
        }

        await db.collection("job_traces").add({
            job_id: input.job_id,
            user_id: jobData.user_id,
            event_type: isRejected ? "OPERATOR_RESTARTED" : "OPERATOR_RESUMED",
            message: message,
            created_at: now,
        });

        return {
            success: true,
            status: "resumed",
            restore_type: restoreType,
            resurrection_count: currentCount + 1,
            prompt: jobData.prompt,
            /** Phase 2 envelope id on the job doc (null after full restart of a rejected job). */
            execution_id: isRejected ? null : (jobData.execution_id as string | undefined) || null,
            assigned_instance_id:
                (jobData.assigned_instance_id as string | undefined) || null,
            job_id: input.job_id,
            user_id: jobData.user_id as string,
            requested_agent_id:
                (jobData.requested_agent_id as string | undefined) ||
                (jobData.assigned_agent_id as string | undefined) ||
                null,
        };
    },

    // ─── Simulate Fork ────────────────────────
    async simulateFork(input: ForkSimulateInput) {
        const db = ensureDb();
        const now = new Date().toISOString();

        if (!input.job_id) throw new Error("missing_job_id");
        if (!input.identity_id) throw new Error("missing_identity_id");

        const attempted_by = input.attempted_by || "system_simulation";
        const reason = input.reason || "Automatic fork detection test";

        // Get canonical job
        const snapshot = await db.collection("jobs").where("job_id", "==", input.job_id).limit(1).get();
        let jobData: FirebaseFirestore.DocumentData;

        if (snapshot.empty) {
            const jobRef = db.collection("jobs").doc(input.job_id);
            const jobDoc = await jobRef.get();
            if (!jobDoc.exists) throw new Error("JOB_NOT_FOUND");
            jobData = jobDoc.data()!;
        } else {
            jobData = snapshot.docs[0].data();
        }

        if (!jobData.identity_id && !jobData.identity_fingerprint) {
            throw new Error("Canonical job missing identity_id");
        }

        const canonical_identity = jobData.identity_id || jobData.identity_fingerprint;
        const TERMINAL = ["completed", "rejected", "failed"];
        const isTerminal = TERMINAL.includes(String(jobData.status || "").toLowerCase());
        const identityMatches = String(input.identity_id) === String(canonical_identity);

        let fork_detected = false;
        let action_taken = "allowed";
        let block_reason = "";

        if (identityMatches && !isTerminal) {
            fork_detected = true;
            action_taken = "quarantined";
            block_reason = `Duplicate identity detected. Canonical job ${jobData.job_id} is still active (status=${jobData.status}).`;
        }

        const ts = now.replace(/[:.]/g, "-");
        const fork_event_id = `fork-${ts}-${jobData.job_id}`;

        // Store fork event
        await db.collection("fork_events").doc(fork_event_id).set({
            event_id: fork_event_id,
            job_id: jobData.job_id,
            user_id: jobData.user_id, // CRITICAL: Fix permission error
            identity_id: canonical_identity,
            attempted_by,
            reason,
            created_at: now,
            block_reason,
            action_taken,
            fork_detected,
            canonical_job_id: jobData.job_id,
            canonical_status: jobData.status,
            canonical_identity_id: canonical_identity,
            incoming_job_id: input.job_id,
            incoming_identity_id: input.identity_id,
        });

        return {
            event_id: fork_event_id,
            fork_detected,
            action_taken,
            block_reason,
            canonical_status: jobData.status,
        };
    },

    // ─── Dashboard Stats ──────────────────────
    async getDashboardStats(userId: string) {
        const db = ensureDb();

        // 1. Fetch data in parallel with timeouts/safety
        const isGlobal = userId === "all";
        let jobsQuery = db.collection("jobs").limit(100);
        
        if (!isGlobal && userId) {
            jobsQuery = db.collection("jobs").where("user_id", "==", userId).limit(100);
        }

        const [jobsSnap, agentIdSnap, resumedSnap, restartedSnap] = await Promise.all([
            jobsQuery.get().catch(() => ({ docs: [] })),
            db.collection("agent_identities").get().catch(() => ({ docs: [] })),
            db.collection("job_traces").where("event_type", "==", "OPERATOR_RESUMED").limit(50).get().catch(() => ({ docs: [] })),
            db.collection("job_traces").where("event_type", "==", "OPERATOR_RESTARTED").limit(50).get().catch(() => ({ docs: [] }))
        ]);

        const jobs = jobsSnap.docs.map(d => d.data());
        const totalJobs = jobs.length;

        // 2. Aggregate status
        const statusCounts: Record<string, number> = {};
        for (const job of jobs) {
            const status = String(job.status || "unknown").toLowerCase();
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }

        const completedJobs = (statusCounts["completed"] || 0) + (statusCounts["approved"] || 0);
        const passRate = totalJobs > 0 ? `${Math.round((completedJobs / totalJobs) * 100)}%` : "100%";

        // 3. Process Agents (Phase 2 Identities)
        const agentIdentities = agentIdSnap.docs.map(d => d.data());
        const displayAgents = agentIdentities.length > 0 
            ? agentIdentities.map(a => ({
                name: a.display_name?.split(' ').pop()?.toUpperCase() || a.agent_id.split('_').pop()?.toUpperCase(),
                intel: a.agent_class || "Agentic AI",
                gate: a.jurisdiction?.split('-').pop() || "Gate 1",
                color: a.agent_id.includes("coo") ? "text-cyan-400" : a.agent_id.includes("res") ? "text-blue-400" : a.agent_id.includes("wrk") ? "text-amber-400" : "text-emerald-400",
                status: a.continuity?.status === "ACTIVE" ? "Active" : "Standby"
            }))
            : [
                { name: "CLAUDE-OPS", intel: "Anthropic Claude", gate: "Gate 1", color: "text-cyan-400" },
                { name: "ORION-GPT", intel: "OpenAI GPT-4", gate: "Gate 1", color: "text-blue-400" },
                { name: "SENTINEL-X", intel: "Anthropic Claude", gate: "Gate 1", color: "text-amber-400", status: "Standby" },
                { name: "NEBULA-01", intel: "OpenAI GPT-4", gate: "Gate 1", color: "text-emerald-400" },
            ];

        const missionQueue = jobs
            .filter(j => ["queued", "in_progress", "assigned", "awaiting_approval", "resurrected", "created"].includes(String(j.status || "").toLowerCase()))
            .slice(0, 10)
            .map(j => ({
                job_id: j.job_id,
                prompt: j.prompt,
                status: j.status,
                created_at: j.created_at,
                assigned_agent_id: j.assigned_agent_id,
            }));

        const resurrectionEvents = (resumedSnap.docs?.length || 0) + (restartedSnap.docs?.length || 0);

        return {
            stats: {
                licensees: 1,
                totalAgents: agentIdentities.length || 4,
                resurrectionEvents,
                averagePassRate: passRate,
                identityLogs: String(totalJobs),
                lineageVerified: String(completedJobs),
            },
            missionQueue,
            agents: displayAgents,
            jobTypes: ["Data Analysis", "Research", "Security Audit", "Network Optimization", "Content Generation"],
            systemStatus: {
                licenseeCap: { current: 1, max: 40 },
                activeAgents: { current: agentIdSnap.docs?.length || 0, max: agentIdSnap.docs?.length || 4 },
                gateLevels: 1,
            },
        };
    },

    // ─── Create Agent ─────────────────────────
    async createAgent(input: CreateAgentInput) {
        const db = ensureDb();
        const now = new Date().toISOString();

        const s = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

        if (!s(input.agent_id)) throw new Error("missing_agent_id");
        if (!s(input.owner_org_id)) throw new Error("missing_owner_org_id");
        if (!s(input.governance_profile)) throw new Error("missing_governance_profile");
        if (!s(input.jurisdiction)) throw new Error("missing_jurisdiction");
        if (!s(input.mission)) throw new Error("missing_mission");

        const mission = s(input.mission);
        const policy = s(input.policy || "ACEPLACE_DEFAULT_POLICY");
        const identity_version = s(input.identity_version || "v1");
        const public_key = s(input.public_key || "");

        const mission_hash = hexFormat(sha256(mission));
        const policy_hash = hexFormat(sha256(policy));

        // Build canonical identity object (immutable fields only)
        const canonical_identity_json: Record<string, string | null> = {
            agent_id: s(input.agent_id),
            governance_profile: s(input.governance_profile),
            identity_version,
            jurisdiction: s(input.jurisdiction),
            mission_hash,
            owner_org_id: s(input.owner_org_id),
            policy_hash,
            public_key,
        };

        // Sorted-key canonical string
        const canonical_json_string = JSON.stringify(
            Object.keys(canonical_identity_json)
                .sort()
                .reduce((acc: Record<string, any>, key) => {
                    acc[key] = canonical_identity_json[key];
                    return acc;
                }, {})
        );

        const identity_fingerprint = hexFormat(sha256(canonical_json_string));

        const agentData = {
            agent_id: s(input.agent_id),
            display_name: s(input.display_name),
            agent_class: s(input.agent_class),
            owner_org_id: s(input.owner_org_id),
            acelogic_id: s(input.acelogic_id),
            identity_fingerprint,
            canonical_identity_json,
            mission_hash,
            policy_hash,
            identity_version,
            public_key,
            jurisdiction: s(input.jurisdiction),
            governance_profile: s(input.governance_profile),
            mission,
            continuity_status: s(input.continuity?.status ?? "ACTIVE"),
            continuity_current_instance_id: input.continuity?.current_instance_id ?? null,
            continuity_lease_expires_at: input.continuity?.lease_expires_at ?? null,
            continuity_last_seen_at: input.continuity?.last_seen_at ?? null,
            continuity_resurrection_count: Number(input.continuity?.resurrection_count ?? 0),
            continuity_fork_flag: Boolean(input.continuity?.fork_flag ?? false),
            covenant_hash: hexFormat(input.anchors?.covenant_hash ?? (identity_fingerprint || "")),
            cvr_polygon: input.anchors?.cvr_polygon ? hexFormat(input.anchors.cvr_polygon) : null,
            cvr_xrpl: input.anchors?.cvr_xrpl ? hexFormat(input.anchors.cvr_xrpl) : null,
            created_at: s(input.created_at ?? now),
        };

        await db.collection("agents").doc(s(input.agent_id)).set(agentData, { merge: true });

        return { success: true, agent_id: s(input.agent_id), identity_fingerprint };
    },

    // ─── Verify Identity ──────────────────────
    async verifyIdentity(agent_id: string) {
        const db = ensureDb();

        const agentDoc = await db.collection("agents").doc(agent_id).get();
        if (!agentDoc.exists) throw new Error("AGENT_NOT_FOUND");

        const agent = agentDoc.data()!;

        const required = [
            "agent_id", "owner_org_id", "jurisdiction",
            "governance_profile", "identity_fingerprint",
            "mission_hash", "policy_hash",
        ];

        for (const key of required) {
            if (!agent[key] || String(agent[key]).trim() === "") {
                throw new Error(`missing_agent_identity_field:${key}`);
            }
        }

        if (String(agent.continuity_status || "").toUpperCase() === "QUARANTINED") {
            throw new Error("agent_quarantined");
        }

        const s = (v: any) => (v === null || v === undefined ? "" : String(v).trim());

        const canonicalIdentity: Record<string, string> = {
            agent_id: s(agent.agent_id),
            governance_profile: s(agent.governance_profile),
            identity_version: s(agent.identity_version || "v1"),
            jurisdiction: s(agent.jurisdiction),
            mission_hash: s(agent.mission_hash),
            owner_org_id: s(agent.owner_org_id),
            policy_hash: s(agent.policy_hash),
            public_key: s(agent.public_key),
        };

        const canonicalJsonString = JSON.stringify(
            Object.keys(canonicalIdentity)
                .sort()
                .reduce((acc: Record<string, any>, key) => {
                    acc[key] = canonicalIdentity[key];
                    return acc;
                }, {})
        );

        const recomputedFingerprint = "hex:0x" + sha256(canonicalJsonString);
        const storedFingerprint = String(agent.identity_fingerprint).trim();
        // Normalize both sides before comparing to handle legacy agents stored
        // without the "hex:0x" prefix (raw SHA-256 hex) and new agents that have it.
        const identity_verified =
            normalizeFingerprint(recomputedFingerprint) === normalizeFingerprint(storedFingerprint);

        return {
            agent_id,
            identity_verified,
            recomputed_fingerprint: recomputedFingerprint,
            stored_fingerprint: storedFingerprint,
            verification_mode: "canonical_recompute",
            checked_at: new Date().toISOString(),
        };
    },

    // ─── Approve Fallback ─────────────────────
    async approveFallback(params: { jobId: string; userId?: string }) {
        const db = ensureDb();
        const now = new Date().toISOString();

        const jobRef = db.collection("jobs").doc(params.jobId);
        const jobDoc = await jobRef.get();
        if (!jobDoc.exists) throw new Error("JOB_NOT_FOUND");
        const jobData = jobDoc.data()!;

        const envId = jobData.envelope_id || jobData.execution_id;
        if (!envId) throw new Error("ENVELOPE_NOT_FOUND");

        const envRef = db.collection("execution_envelopes").doc(envId);
        const envDoc = await envRef.get();
        if (!envDoc.exists) throw new Error("ENVELOPE_NOT_FOUND");
        const envData = envDoc.data()!;

        const fallbackMetadata = envData.fallback_metadata;
        if (!fallbackMetadata) throw new Error("NO_FALLBACK_PENDING");

        const stepId = fallbackMetadata.step_id;

        // 1. Update the step to 'ready' and mark as 'fallback_approved'
        const updatedSteps = (envData.steps || []).map((s: any) => {
            if (s.step_id === stepId) {
                return { 
                    ...s, 
                    status: "ready", 
                    claimed_by_instance_id: null, 
                    claimed_at: null,
                    metadata: { ...(s.metadata || {}), fallback_approved: true }
                };
            }
            return s;
        });

        // 2. Resume the envelope
        await envRef.update({
            status: "executing",
            steps: updatedSteps,
            fallback_suggested: false,
            fallback_metadata: null,
            failure_reason: null, // Clear failure reason
            updated_at: now,
        });

        // 3. Reset job status so UI updates
        await jobRef.update({
            status: "executing",
            error: null,          // Clear low-level error
            failure_reason: null, // Clear human-readable error
            updated_at: now,
        });

        // 4. Reset queue entry so a worker can pick it up immediately
        await db.collection("execution_queue").doc(envId).update({
            status: "queued",
            claimed_by: null,
            claimed_at: null,
            updated_at: now,
        }).catch(async (err) => {
            // If the queue doc doesn't exist for some reason, create it
            if (err.code === 'not-found' || err.message?.includes('no document to update')) {
                await db.collection("execution_queue").doc(envId).set({
                    envelope_id: envId,
                    status: "queued",
                    updated_at: now,
                });
            }
        });

        // 5. Trace the approval
        await db.collection("execution_traces").add({
            envelope_id: envId,
            step_id: stepId,
            event_type: "FALLBACK_APPROVED",
            message: `Operator approved fallback to ${fallbackMetadata.suggested_action}.`,
            timestamp: now,
        });

        return { success: true };
    },

    // ─── Reject Fallback ──────────────────────
    async rejectFallback(params: { jobId: string; userId?: string; reason?: string }) {
        const db = ensureDb();
        const now = new Date().toISOString();

        const jobRef = db.collection("jobs").doc(params.jobId);
        const jobDoc = await jobRef.get();
        if (!jobDoc.exists) throw new Error("JOB_NOT_FOUND");
        const jobData = jobDoc.data()!;

        const envId = jobData.envelope_id || jobData.execution_id;
        if (!envId) throw new Error("ENVELOPE_NOT_FOUND");

        const envRef = db.collection("execution_envelopes").doc(envId);
        const envDoc = await envRef.get();
        if (!envDoc.exists) throw new Error("ENVELOPE_NOT_FOUND");
        const envData = envDoc.data()!;

        const fallbackMetadata = envData.fallback_metadata;
        const stepId = fallbackMetadata?.step_id;

        // 1. Mark envelope as failed
        await envRef.update({
            status: "failed",
            fallback_suggested: false,
            fallback_metadata: null,
            failure_reason: params.reason || "Fallback rejected by operator.",
            updated_at: now,
        });

        // 2. Update job
        await jobRef.update({
            status: "failed",
            error: params.reason || "Fallback rejected by operator.",
            updated_at: now,
        });

        // 3. Trace
        await db.collection("execution_traces").add({
            envelope_id: envId,
            step_id: stepId || "",
            event_type: "FALLBACK_REJECTED",
            message: `Operator rejected fallback. Task failed.`,
            timestamp: now,
        });

        return { success: true };
    }
};
