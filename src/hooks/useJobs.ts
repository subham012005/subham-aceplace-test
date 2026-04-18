import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot,
    doc
} from "firebase/firestore";
import { aceApi } from "@/lib/api-client";

// Parse stringified JSON fields that Firestore may store as strings
function parseJobFields(job: any): any {
    const parsed = { ...job };
    // runtime_context is often stored as a JSON string
    if (typeof parsed.runtime_context === 'string') {
        try { parsed.runtime_context = JSON.parse(parsed.runtime_context); } catch (e) { /* keep as string */ }
    }
    // grading_result may also be stringified
    if (typeof parsed.grading_result === 'string') {
        try { parsed.grading_result = JSON.parse(parsed.grading_result); } catch (e) { /* keep as string */ }
    }
    return parsed;
}

export interface Job {
    id: string;
    job_id: string;
    user_id: string;
    job_type: "coo" | "research" | "worker";
    prompt: string;
    status: "created" | "queued" | "lease_check" | "in_progress" | "executing" | "coo_planning" | "research_execution" | "worker_execution" | "grading" | "completed" | "graded" | "approved" | "rejected" | "failed" | "resurrected" | "awaiting_approval" | "quarantined";
    created_at: string;
    updated_at: string;
    completed_at?: string;
    assigned_instance_id?: string;
    runtime_context?: {
        plan?: any;
        research_result?: any;
        worker_result?: any;
        final_result?: any;
        grading_result?: any;
        active_stage?: string;
        token_usage?: {
            total_tokens?: number;
            cost?: number;
        };
    };
    grading_summary?: string;
    grading_result?: any;
    governance_recommendation?: string;
    compliance_score?: number;
    risk_flags?: string;
    artifact?: string;
    agent_role?: string;
    model_provider?: string;
    model_used?: string;
    token_usage?: number | { total_tokens?: number; input_tokens?: number; output_tokens?: number; cost?: number };
    cost?: number;
    retry_count?: number;
    last_retry_at?: string;
    provider?: string;
    // Governance
    approved_at?: string;
    approved_by?: string;
    rejected_at?: string;
    rejected_by?: string;
    failure_reason?: string;
    last_error_at?: string;
    execution_message?: string;
    // Grader
    grader_params?: {
        score: number;
        pass_fail: "pass" | "fail";
        risk_flags: string[];
        reasoning_summary: string;
    };
    // Continuity Restore
    resurrection_count?: number;
    resurrection_reason?: string;
    resurrected_by?: string;
    resurrected_at?: string;
    // Agent pipeline fields
    grade_score?: number;
    pass_fail?: string;
    output?: any[];
    // Fork Protection
    identity_id?: string;
    canonical_job_id?: string;
    fork_attempted?: boolean;
    fork_last_event_id?: string;
    // Agent Identity & Governance
    agent_id?: string;
    requested_agent_id?: string;
    identity_fingerprint?: string;
    acelogic_id?: string;
    jurisdiction?: string;
    mission?: string;
    governance_profile?: string;
    identity_version?: string;
    public_key?: string;
    assigned_agent_id?: string;
    assigned_agent_role?: string;
    fork_last_at?: string;
    // Direct from result
    event_id?: string;
    action_taken?: string;
    block_reason?: string;
    attempted_by?: string;
    reason?: string;
    // Governance v2
    policy_version?: string;
    gate_level?: string;
    grader_model?: string;
    assigned_at?: string;
    graded_at?: string;
    // Quarantine & Resume
    quarantine_reason?: string;
    last_safe_step?: string;
    resume_allowed?: boolean;
    grade_status?: string;
    execution_id?: string;
    envelope_id?: string;
}

export interface ForkEvent {
    id: string;
    job_id: string;
    identity_id: string;
    attempted_by: string;
    reason: string;
    action_taken: "quarantined" | "blocked" | "allowed";
    block_reason?: string;
    created_at: string;
}

export interface TraceEntry {
    id: string;
    job_id: string;
    timestamp: string;
    event_type: string;
    agent_id?: string;
    agent_name?: string;
    instance_id?: string;
    identity_fingerprint?: string;
    message: string;
    metadata?: any;
    payload?: any;
    step_type?: string;
    status?: string;
}

export interface Artifact {
    id: string;
    job_id: string;
    artifact_id: string;
    artifact_type: string;
    produced_by_agent: string;
    created_at: string;
    artifact_content: any;
    title?: string;
    description?: string;
}

export function useJobs(userId: string | undefined) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const updateJobInList = useCallback((updatedJob: Job) => {
        setJobs(prev => {
            const exists = prev.some(j => (j.job_id === updatedJob.job_id || j.id === updatedJob.id));
            if (exists) {
                return prev.map(j => (j.job_id === updatedJob.job_id || j.id === updatedJob.id) ? { ...j, ...updatedJob } : j);
            }
            return [updatedJob, ...prev];
        });
    }, []);

    const refresh = useCallback(async () => {
        try {
            if (!userId) return;

            const jobsData = await aceApi.getAllJobs(userId);
            if (Array.isArray(jobsData)) {
                setJobs(prev => {
                    let mappedJobs: Job[] = [];

                    if (jobsData.length > 0 && Array.isArray((jobsData[0] as any).job_ids)) {
                        const summary = jobsData[0] as any;
                        const allJobIds = summary.job_ids as string[];

                        mappedJobs = allJobIds.map(jid => {
                            const existing = prev.find(j => (j.job_id === jid || j.id === jid));
                            if (existing) return existing;

                            return {
                                id: jid,
                                job_id: jid,
                                user_id: userId,
                                status: "in_progress",
                                prompt: "Syncing dimensional node...",
                                updated_at: new Date().toISOString()
                            } as Job;
                        });
                    } else {
                        mappedJobs = jobsData
                            .filter((j: any) => j.user_id === userId || !j.user_id)
                            .map((j: any) => parseJobFields({
                                ...j,
                                id: j.id || j.job_id
                            })) as Job[];
                    }
                    return mappedJobs;
                });
            }
        } catch (error: any) {
            // Silently ignore configuration errors in dev
            const isUnconfigured =
                error.message?.includes("ADMIN_NOT_INITIALIZED") ||
                error.message?.includes("Backend not configured");

            if (!isUnconfigured) {
                console.error("Failed to refresh jobs:", error);
            }
        } finally {
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setJobs([]);
            setLoading(false);
            return;
        }

        let isMounted = true;
        
        const jobsRef = collection(db, "jobs");
        const q = query(jobsRef, orderBy("created_at", "desc"));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!isMounted) return;
            const fetched = snapshot.docs.map(doc => {
                return parseJobFields({
                    ...doc.data(),
                    id: doc.id,
                    job_id: doc.id
                });
            });
            const filtered = fetched.filter(j => j.user_id === userId || !j.user_id);
            setJobs(filtered as Job[]);
            setLoading(false);
        }, (err) => {
            console.warn("[useJobs] Live sync failed:", err);
            // Fallback to polling if onSnapshot fails (e.g. index issue / permission)
            const fetchData = async () => {
                try {
                    const jobsData = await aceApi.getSecureJobs();
                    if (isMounted) {
                        setJobs(jobsData.map((j: any) => parseJobFields(j)));
                        setLoading(false);
                    }
                } catch (error: any) {
                    if (!error.message?.includes("ADMIN_NOT_INITIALIZED")) {
                        console.error("Error fetching jobs:", error);
                    }
                    if (isMounted) setLoading(false);
                }
            };
            fetchData();
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [userId]);

    return { jobs, loading, refreshing, refresh, updateJobInList };
}

export function useJob(jobId: string | null, userId: string | undefined, onUpdate?: (j: Job) => void) {
    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        if (!jobId || !userId) return;
        setRefreshing(true);
        try {
            const jobData = await aceApi.getSecureJobDetail(jobId);
            if (jobData && !jobData.error) {
                const mappedJob = parseJobFields(jobData);
                setJob(mappedJob);
                if (onUpdate) onUpdate(mappedJob);
            }
        } catch (error: any) {
             const message = error.message || "";
             if (!message.includes("Job not found")) {
                console.error("Job refresh failed:", error);
            }
            // Explicitly set null to indicate non-existence
            setJob(null);
        } finally {
            setRefreshing(false);
            setLoading(false);
        }
    }, [jobId, userId, onUpdate]);

    // ── Live Firestore snapshot for instant updates ──────────────────────────
    useEffect(() => {
        if (!jobId) {
            setLoading(false);
            return;
        }

        setLoading(true);

        // Subscribe to the jobs document directly for instant status updates
        const jobRef = doc(db, "jobs", jobId);
        const unsubscribe = onSnapshot(
            jobRef,
            (snap) => {
                if (snap.exists()) {
                    const data = parseJobFields({ ...snap.data(), id: snap.id, job_id: snap.id });
                    setJob(data as Job);
                    if (onUpdate) onUpdate(data as Job);
                }
                setLoading(false);
            },
            (err) => {
                console.warn("[useJob] Snapshot error, falling back to polling:", err.message);
                // Fallback: poll via API
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [jobId]);

    const [isStalled, setIsStalled] = useState(false);

    useEffect(() => {
        const checkStalled = () => {
            if (!job || !job.updated_at) {
                setIsStalled(false);
                return;
            }

            const updated = new Date(job.updated_at).getTime();
            const now = Date.now();
            const ACTIVE_STATUSES = [
                "created",
                "queued",
                "in_progress",
                "executing",
                "coo_planning",
                "research_execution",
                "worker_execution",
                "grading",
                "assigned"
            ];

            const status = String(job.status || "").toLowerCase();

            // "created"/"queued" with no worker means nothing will ever pick it up —
            // flag quickly (60s). Active execution statuses get a longer window (5m)
            // since LLM calls legitimately take time.
            const PRE_EXECUTION = ["created", "queued"];
            const timeout = PRE_EXECUTION.includes(status) ? 60_000 : 300_000;
            if (ACTIVE_STATUSES.includes(status) && (now - updated) > timeout) {
                setIsStalled(true);
            } else {
                setIsStalled(false);
            }
        };

        const timer = setInterval(checkStalled, 10000);
        checkStalled();
        return () => clearInterval(timer);
    }, [job]);

    return { job, loading, refreshing, refresh, isStalled };
}

export function useForkProtection(jobId: string | null) {
    const [events, setEvents] = useState<ForkEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!jobId) {
            setEvents([]);
            return;
        }

        let isMounted = true;
        const fetchData = async () => {
            try {
                // For now, fork events are often embedded in job traces or handled by the engine
                // If there's a specific fork_events collection, we'd need a route for it.
                // For Phase 2, we'll allow this to be empty or stub it.
                setLoading(false);
            } catch (error) {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
    }, [jobId]);

    const latestEvent = events.length > 0 ? events[0] : null;

    return { events, latestEvent, loading, attemptsCount: events.length };
}

export function useJobTraces(jobId: string | null) {
    const [traces, setTraces] = useState<TraceEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!jobId) {
            setTraces([]);
            return;
        }

        let isMounted = true;
        const fetchData = async () => {
            try {
                const data = await aceApi.getSecureJobTraces(jobId);
                if (isMounted && Array.isArray(data)) {
                    setTraces(data);
                    setLoading(false);
                }
            } catch (error) {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [jobId]);

    return { traces, loading };
}

export function useJobArtifacts(jobId: string | null) {
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!jobId) {
            setArtifacts([]);
            return;
        }

        let isMounted = true;
        const fetchData = async () => {
            try {
                const data = await aceApi.getSecureJobArtifacts(jobId);
                if (isMounted && Array.isArray(data)) {
                    setArtifacts(data);
                    setLoading(false);
                }
            } catch (error) {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [jobId]);

    return { artifacts, loading };
}
