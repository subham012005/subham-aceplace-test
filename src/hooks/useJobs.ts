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
import { nxqApi } from "@/lib/api-client";

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
    status: "created" | "in_progress" | "completed" | "graded" | "approved" | "rejected" | "failed" | "resurrected" | "awaiting_approval";
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
    token_usage?: number;
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
    resurrection_reason?: string;
    resurrected_by?: string;
    resurrected_at?: string;
    // New fields from n8n
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
    // Direct from n8n result
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
        if (!userId) return;
        setRefreshing(true);
        try {
            const jobsData = await nxqApi.getAllJobs(userId);
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

        refresh();

        setJobs([]);
        setLoading(true);

        const q = query(
            collection(db, "jobs"),
            where("user_id", "==", userId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobsData = snapshot.docs.map(doc => parseJobFields({
                id: doc.id,
                ...doc.data()
            })) as Job[];

            jobsData.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

            setJobs(jobsData);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to jobs:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId]);

    return { jobs, loading, refreshing, refresh, updateJobInList };
}

export function useJob(jobId: string | null, userId: string | undefined, onUpdate?: (j: Job) => void) {
    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        if (!jobId) return;
        setRefreshing(true);
        try {
            const jobData = await nxqApi.getJob(jobId, userId);
            if (jobData) {
                const mappedJob = parseJobFields({ ...jobData, id: jobData.id || jobData.job_id });
                setJob(mappedJob);
                if (onUpdate) onUpdate(mappedJob);
            }
        } catch (error: any) {
            // Silently ignore configuration errors in dev
            const isUnconfigured =
                error.message?.includes("ADMIN_NOT_INITIALIZED") ||
                error.message?.includes("Backend not configured");

            if (!isUnconfigured && !error.message?.includes("Job not found")) {
                console.error("Job refresh failed:", error);
            }
        } finally {
            setRefreshing(false);
        }
    }, [jobId, onUpdate]);

    useEffect(() => {
        if (!jobId || !userId) {
            return;
        }

        refresh();

        const q = query(
            collection(db, "jobs"),
            where("job_id", "==", jobId),
            where("user_id", "==", userId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docData = snapshot.docs[0].data();
                const mappedJob = parseJobFields({ id: snapshot.docs[0].id, ...docData }) as Job;
                setJob(mappedJob);
                if (onUpdate) onUpdate(mappedJob);
            } else {
                setJob(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to job:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [jobId, userId, onUpdate, refresh]);

    return { job, loading, refreshing, refresh };
}

export function useForkProtection(jobId: string | null) {
    const [events, setEvents] = useState<ForkEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!jobId) {
            setEvents([]);
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, "fork_events"),
            where("job_id", "==", jobId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ForkEvent[];

            eventsData.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

            setEvents(eventsData);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to fork events:", error);
            setLoading(false);
        });

        return () => unsubscribe();
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

        setLoading(true);
        const q = query(
            collection(db, "job_traces"),
            where("job_id", "==", jobId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tracesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as TraceEntry[];

            tracesData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            setTraces(tracesData);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to job traces:", error);
            setLoading(false);
        });

        return () => unsubscribe();
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

        setLoading(true);
        const q = query(
            collection(db, "artifacts"),
            where("job_id", "==", jobId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const artifactsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Artifact[];

            artifactsData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setArtifacts(artifactsData);
            setLoading(false);
        }, (error) => {
            console.error("Error subscribing to artifacts:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [jobId]);

    return { artifacts, loading };
}
