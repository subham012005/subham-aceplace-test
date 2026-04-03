"use client";

import React, { use, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    useJob,
    useJobTraces,
    useJobArtifacts
} from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useEnvelope } from "@/hooks/useEnvelope";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { AgentLogPanel } from "@/components/AgentLogPanel";
import { EnvelopeInspector } from "@/components/EnvelopeInspector";
import { EnvelopeStepCard } from "@/components/EnvelopeStepCard";
import { KernelStatusBadge } from "@/components/KernelStatusBadge";
import { aceApi } from "@/lib/api-client";
import {
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    RefreshCcw,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Activity,
    Search,
    Cpu,
    GraduationCap,
    FileText,
    ShieldCheck,
    AlertTriangle,
    Target,
    ExternalLink,
    Code,
    Terminal,
    Fingerprint,
    Calendar,
    User,
    ClipboardList,
    Award,
    Lock,
    Zap,
    Key,
    Database,
    Check,
    RotateCw,
    AlertCircle,
    Layers,
    ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HUDFrame } from "@/components/HUDFrame";
import { SciFiFrame } from "@/components/SciFiFrame";
import { MarkdownReport } from "@/components/MarkdownReport";
import { DeliverableItem } from "@/components/DeliverableItem";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const parseFirestoreDate = (date: any) => {
    if (!date) return null;
    // Handle Firestore Timestamp structure {_seconds, _nanoseconds}
    if (typeof date === 'object' && typeof date._seconds === 'number') {
        return new Date(date._seconds * 1000);
    }
    // Handle ISO strings or other date formats
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const formatDate = (dateValue?: any) => {
    const date = parseFirestoreDate(dateValue);
    if (!date) return "N/A";
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
};

const formatTime = (dateValue?: any) => {
    const date = parseFirestoreDate(dateValue);
    if (!date) return "00:00:00.000";
    return new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date) + "." + date.getMilliseconds().toString().padStart(3, '0');
};

export default function JobDetailsPage() {
    const params = useParams();
    const jobId = params.jobId as string;
    const { user } = useAuth();
    const router = useRouter();

    const extractOutputData = (j: any) => {
        if (!j) return null;

        // 1. Check for known nested results
        const nestedResult = j?.runtime_context?.final_result || j?.runtime_context?.worker_result || j?.runtime_context?.research_result || j?.runtime_context?.plan;
        if (nestedResult) return nestedResult;

        // 2. Check for output array
        if (j.output && Array.isArray(j.output) && j.output.length > 0) {
            const item = j.output[0];
            if (item?.content?.[0]?.text) return item.content[0].text;
            if (item?.text) return item.text;
            if (item?.data) return item.data;
            if (item?.result) return item.result;
            if (item?.output) return item.output;
            if (typeof item === 'string') return item;
            return item;
        }

        // 3. Check for top-level result
        if (j.result) {
            if (typeof j.result === 'object') {
                if (j.result.output) return j.result.output;
                if (j.result.text) return j.result.text;
                if (j.result.data) return j.result.data;
                return j.result;
            }
            return j.result;
        }

        // 4. Check for direct delivery fields
        return j.strategic_plan || j.strategicPlan || j.research_intelligence || j.researchIntelligence || j.artifact || j.final_result || j.finalResult || j.worker_result || j.workerResult;
    };

    const { job, loading: jobLoading, refresh: refreshJob, isStalled } = useJob(jobId, user?.uid);
    const { traces, loading: tracesLoading } = useJobTraces(jobId);
    const { artifacts, loading: artifactsLoading } = useJobArtifacts(jobId);
    // Resolve envelope_id from job — engine.ts writes envelope_id directly to job doc
    const envelopeId = (job as any)?.envelope_id || job?.execution_id || null;
    const { envelope, steps, loading: envelopeLoading } = useEnvelope(envelopeId);
    const { logs: agentLogs, loading: agentLogsLoading } = useAgentLogs(envelopeId);

    // Unified Governance Logic — also check agent logs as fallback
    const graderLogSummary = agentLogs.find(l => l.agent_role === 'grader' && l.event === 'COMPLETE')?.output_summary || "";
    // Parse "Grade: A (90/100)" from log summary
    const graderScoreFromLog = (() => {
        const match = graderLogSummary.match(/\((\d+)\/100\)/);
        if (match) return parseInt(match[1]);
        return null;
    })();
    const graderRecommendationFromLog = graderLogSummary.toLowerCase().includes('approve') ? 'pass' : null;

    const evaluationArtifact = artifacts.find(a => ['evaluation', 'grading', 'evaluate'].includes(a.artifact_type || ''));
    // artifact_content is stored as a JSON string by the agent engine — parse it
    const evaluationContent: any = (() => {
        const raw = evaluationArtifact?.artifact_content;
        if (!raw) return null;
        if (typeof raw === 'object') return raw;
        try { return JSON.parse(raw as string); } catch { return null; }
    })();

    // The grader outputs: { overall_score: 0-100, grade, recommendation: "approve|reject|revise",
    //                       criteria_scores, feedback, summary }
    // Priority: evaluation artifact > job.grading_result (if synced) > agent log fallback
    const govScoreRaw =
        evaluationContent?.overall_score ??
        evaluationContent?.score ??
        evaluationContent?.compliance_score ??
        job?.runtime_context?.grading_result?.compliance_score ??
        job?.runtime_context?.grading_result?.score ??
        job?.runtime_context?.grading_result?.overall_score ??
        job?.grading_result?.compliance_score ??
        job?.grading_result?.score ??
        job?.grading_result?.overall_score ??
        job?.compliance_score ??
        job?.grade_score ??
        (job as any)?.score ??
        job?.grader_params?.score ??
        graderScoreFromLog ?? 0;

    let governanceScore = typeof govScoreRaw === 'object' ? ((govScoreRaw as any).value || 0) : Number(govScoreRaw);
    // Normalize score if it's on a 100-point scale
    if (governanceScore > 10) governanceScore = governanceScore / 10;

    // recommendation field: "approve" → pass, "reject"/"revise" → fail
    const evalRecommendation = evaluationContent?.recommendation;
    const evalPassFail = evalRecommendation
        ? (String(evalRecommendation).toLowerCase() === 'approve' ? 'pass' : 'fail')
        : null;

    const passFailRaw =
        evalPassFail ??
        job?.runtime_context?.grading_result?.pass_fail ??
        job?.grading_result?.pass_fail ??
        evaluationContent?.pass_fail ??
        evaluationContent?.status ??
        job?.pass_fail ??
        job?.grade_status ??
        job?.grader_params?.pass_fail ??
        graderRecommendationFromLog;

    const isActuallyPending = governanceScore === 0 && !passFailRaw;
    const isActuallyPass = String(passFailRaw).toLowerCase() === 'pass';
    const isPass = isActuallyPass;
    const finalGovStatus = isActuallyPending ? 'PENDING' : (isActuallyPass ? 'PASS' : 'FAIL');

    const [actionLoading, setActionLoading] = useState(false);
    const [isResurrecting, setIsResurrecting] = useState(false);
    const [viewingArtifact, setViewingArtifact] = useState<{ title: string; content: any } | null>(null);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [activeTab, setActiveTab] = useState<'plan' | 'research' | 'worker' | 'grader'>('plan');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const maxIndexRef = useRef<number>(0);
    const [staleSinceSeconds, setStaleSinceSeconds] = useState<number>(0);

    // Live countdown: how long since the last update (used in crash banner)
    useEffect(() => {
        if (!isStalled) { setStaleSinceSeconds(0); return; }
        const tick = () => {
            const updatedAt = parseFirestoreDate(job?.updated_at);
            if (!updatedAt) return;
            setStaleSinceSeconds(Math.floor((Date.now() - updatedAt.getTime()) / 1000));
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [isStalled, job?.updated_at]);

    // Clear the "resurrecting" banner once the pipeline actually starts running
    // (job status moves away from "queued" meaning the agent engine picked it up)
    useEffect(() => {
        if (!isResurrecting) return;
        const status = String(job?.status || "").toLowerCase();
        if (status !== "queued") {
            setIsResurrecting(false);
        }
    }, [job?.status, isResurrecting]);

    const scrollTimeline = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 400;
            const targetScroll = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
            scrollContainerRef.current.scrollTo({
                left: targetScroll,
                behavior: 'smooth'
            });
        }
    };

    const getActiveIndex = () => {
        const status = job?.status?.toLowerCase();

        // Data-based transition checks — now includes artifacts collection check
        const hasPlan = artifacts.some(a => (a.artifact_type || '').includes('plan')) || job?.runtime_context?.plan || (job as any)?.plan;
        const hasResearch = artifacts.some(a => ['assign', 'research', 'intelligence'].includes(a.artifact_type || '')) || job?.runtime_context?.research_result || (job as any)?.research_intelligence;
        const hasWorker = artifacts.some(a => ['artifact_produce', 'report', 'final', 'worker_result', 'worker'].includes(a.artifact_type || '')) || job?.runtime_context?.worker_result || (job as any)?.final_result;
        const hasGrading = artifacts.some(a => ['evaluation', 'grading', 'evaluate'].includes(a.artifact_type || '')) || job?.runtime_context?.grading_result || job?.grade_status;

        let calculated = 0;

        if (status === 'completed' || status === 'approved') calculated = 10;
        else if (hasGrading || status === 'graded' || status === 'awaiting_approval') calculated = 9;
        else if (hasWorker || status === 'grading' || status === 'worker_execution') calculated = 8;
        else if (hasResearch || status === 'research_execution') calculated = 7;
        else if (hasPlan || status === 'coo_planning' || status === 'planning') calculated = 6;
        else if (status === 'queued' || status === 'created' || envelope?.execution_context?.status === "running") calculated = 5;
        else {
            // Trace-based heuristics for system stages
            if (envelope?.execution_context?.status === "completed") calculated = 10;
            else if (envelope?.identity_context?.verified) calculated = 2;
            else if (envelope?.authority_context?.lease_id) calculated = 3;
            else {
                const traceMessages = traces.map(t => t?.message?.toLowerCase() ?? '').join(' ');
                if (traceMessages.includes('ready') || traceMessages.includes('environment ready')) calculated = 4;
                else if (job?.assigned_instance_id) calculated = 3;
                else calculated = 0;
            }
        }

        if (calculated > maxIndexRef.current) {
            maxIndexRef.current = calculated;
        }
        return maxIndexRef.current;
    };

    const currentActiveIndex = getActiveIndex();

    const derivedStatus = (() => {
        // ── 0. Manual governance states are absolute ─────────────────
        if (job?.approved_at) return 'approved';
        if (job?.rejected_at) return 'rejected';

        let rawStatus = String(job?.status || 'queued').toLowerCase();
        
        // Translate awaiting_approval to graded conceptually
        if (rawStatus === 'awaiting_approval' || rawStatus === 'graded') {
            return 'graded';
        }

        // ── 1. Envelope-based logic ──────────────────────────────────
        if (envelope) {
            const envStatus = envelope.status;
            if (envStatus === 'approved') return 'approved';
            if (envStatus === 'rejected') {
                // If we have grading data but no manual rejected_at, it's still 'graded'
                const hasGradeData = governanceScore > 0 || !!evaluationArtifact;
                if (hasGradeData && !job?.rejected_at) {
                    return 'graded';
                }
                return 'rejected';
            }
            if (envStatus === 'awaiting_human') return 'graded';
        }

        // ── 2. Structural Heuristics ──────────────────────────────────
        // If we have grading data and we haven't reached a terminal state, force graded
        const hasGradingData = governanceScore > 0 || !!evaluationArtifact;
        const terminalStates = ['approved', 'rejected', 'failed', 'completed', 'quarantined'];
        if (hasGradingData && !terminalStates.includes(rawStatus)) {
            return 'graded';
        }

        // Since backend now emits accurate status like "coo_planning", we trust it first.
        // If it's a legacy "executing", we loosely fallback to index calculation.
        if (rawStatus === 'executing') {
            if (currentActiveIndex >= 10) return 'completed';
            if (currentActiveIndex >= 9) return 'graded'; // was 'grading', mapping to graded for consistency
            if (currentActiveIndex >= 8) return 'worker_execution';
            if (currentActiveIndex >= 7) return 'research_execution';
            if (currentActiveIndex >= 6) return 'coo_planning';
            if (currentActiveIndex >= 5) return 'lease_check';
            if (currentActiveIndex >= 1) return 'initializing';
        }
        
        return rawStatus;
    })();

    // Auto-scroll to active node
    useEffect(() => {
        if (scrollContainerRef.current) {
            const activeNode = scrollContainerRef.current.querySelector('[data-active="true"]');
            if (activeNode) {
                const timeout = setTimeout(() => {
                    activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }, 500);
                return () => clearTimeout(timeout);
            }
        }
    }, [currentActiveIndex]);


    if (jobLoading && !job) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCcw className="w-12 h-12 text-cyan-500 animate-spin" />
                    <span className="text-cyan-500 font-mono tracking-widest animate-pulse">SYNCHRONIZING DIMENSIONAL NODE...</span>
                </div>
            </div>
        );
    }

    if (!job && !jobLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-6">
                <HUDFrame className="max-w-md w-full p-8 text-center space-y-6">
                    <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter">Job Not Found</h1>
                    <p className="text-slate-400 text-sm">The requested job record does not exist or you do not have permission to view it.</p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest hover:bg-white/10 transition-all scifi-clip"
                    >
                        Return to Dashboard
                    </button>
                </HUDFrame>
            </div>
        );
    }

    const handleResurrect = async () => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await aceApi.resurrectJob(jobId, "Operator Manual Continuity Restore");
            setIsResurrecting(true);
            maxIndexRef.current = 0;
            refreshJob();
        } catch (error) {
            console.error("Resurrection failed:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await aceApi.approveJob(jobId);
            refreshJob();
        } catch (error) {
            console.error("Approve failed:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!user || actionLoading || !rejectionReason.trim()) return;

        setActionLoading(true);
        try {
            await aceApi.rejectJob(jobId, rejectionReason || "Operator Manual Rejection");
            setIsRejectModalOpen(false);
            setRejectionReason("");
            refreshJob();
        } catch (error) {
            console.error("Reject failed:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const statusColors: Record<string, string> = {
        queued: "text-slate-500 border-slate-500/50 bg-slate-500/10",
        created: "text-slate-400 border-slate-400/50 bg-slate-400/10",
        lease_check: "text-indigo-400 border-indigo-400/50 bg-indigo-400/10",
        initializing: "text-slate-400 border-slate-400/50 bg-slate-400/10",
        executing: "text-cyan-400 border-cyan-400/50 bg-cyan-400/10",
        in_progress: "text-amber-400 border-amber-400/50 bg-amber-400/10",
        coo_planning: "text-blue-400 border-blue-400/50 bg-blue-400/10",
        research_execution: "text-cyan-400 border-cyan-400/50 bg-cyan-400/10",
        worker_execution: "text-purple-400 border-purple-400/50 bg-purple-400/10",
        grading: "text-pink-400 border-pink-400/50 bg-pink-400/10",
        graded: "text-orange-400 border-orange-400/50 bg-orange-400/10",
        awaiting_approval: "text-orange-400 border-orange-400/50 bg-orange-400/10",
        completed: "text-emerald-400 border-emerald-400/50 bg-emerald-400/10",
        approved: "text-emerald-500 border-emerald-500/50 bg-emerald-500/10",
        rejected: "text-red-400 border-red-400/50 bg-red-400/10",
        failed: "text-red-500 border-red-500/50 bg-red-500/10",
        quarantined: "text-red-600 border-red-600/50 bg-red-600/10",
    };

    const getStatusColor = (status?: string) => {
        if (!status) return statusColors.created;
        const s = status.toLowerCase();
        return statusColors[s] || statusColors.created;
    };

    return (
        <div className="w-full relative">
            {/* background decorations */}
            <div className="fixed top-0 right-0 w-1/3 h-1/3 bg-cyan-500/5 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-1/4 h-1/4 bg-purple-500/5 blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-4 lg:space-y-8 relative z-10 p-4 lg:p-8 pb-20">

                {/* ── MISSION COMMAND HEADER ────────────────────────────────────────── */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-white/5">
                    <div className="space-y-4">
                        <button
                            onClick={() => router.back()}
                            className="group flex items-center gap-2 text-slate-600 hover:text-cyan-400 transition-all text-[10px] font-black uppercase tracking-[0.3em]"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                            Return to Dashboard
                        </button>
                        
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <Activity className="w-5 h-5 text-cyan-500 animate-pulse" />
                                <span className="text-[10px] font-black text-cyan-500/50 uppercase tracking-[0.4em]">Operational Node / {job?.job_type || 'STANDARD'}</span>
                            </div>
                            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-baseline gap-4">
                                Mission Profile
                                <span className="text-sm font-mono text-slate-500 not-italic tracking-normal opacity-50">#{jobId.slice(0, 8)}</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        <div className={cn(
                            "px-4 py-2 border-2 font-black text-xs uppercase tracking-[0.2em] scifi-clip-sm flex items-center gap-3 shadow-[0_0_20px_rgba(0,0,0,0.5)]",
                            getStatusColor(derivedStatus)
                        )}>
                            <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                            {derivedStatus.replace('_', ' ')}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => refreshJob()}
                                disabled={jobLoading}
                                className="p-3 glass border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-target flex justify-center group"
                                title="Refresh Data"
                            >
                                <RefreshCcw className={cn("w-5 h-5 group-hover:rotate-180 transition-transform duration-500", jobLoading && "animate-spin")} />
                            </button>

                            {(() => {
                                const status = String(job?.status || "").toLowerCase();
                                const isPostGrading = ['graded', 'awaiting_approval', 'approved', 'completed'].includes(derivedStatus);
                                const canResurrect = (["failed", "rejected"].includes(status) || isStalled || job?.status?.toLowerCase() === 'quarantined' || job?.quarantine_reason) && !isPostGrading;
                                if (!canResurrect) return null;
                                return (
                                    <button
                                        onClick={handleResurrect}
                                        disabled={actionLoading}
                                        className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-bold uppercase tracking-widest hover:bg-cyan-500/20 transition-all scifi-clip flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                    >
                                        <RefreshCw className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                                        Restore Continuity
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* ── CRASH / STALL ALERT BANNER ─────────────────────────── */}
                {isStalled && !['graded', 'awaiting_approval', 'approved', 'completed'].includes(derivedStatus) && (
                    <div className="relative overflow-hidden border border-amber-500/60 bg-amber-500/5 animate-pulse-slow">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 sm:p-6">
                            <div className="flex items-start gap-4">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full animate-ping opacity-30 bg-amber-400" />
                                        <Zap className="w-5 h-5 text-amber-400 relative z-10" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-black text-amber-400 uppercase tracking-[0.3em]">⚡ SERVER CRASH DETECTED</span>
                                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-widest scifi-clip">
                                            PIPELINE STALLED
                                        </span>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                                        The agent-engine process stopped responding during job execution. No updates have been received for{" "}
                                        <span className="text-amber-400 font-bold font-mono">{staleSinceSeconds}s</span>.
                                        The job can be restored from its last safe checkpoint.
                                    </p>
                                    <div className="flex items-center gap-3 pt-1">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                                                Last heartbeat: {formatDate(job?.updated_at)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
                                <button
                                    onClick={handleResurrect}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-amber-500/10 border border-amber-500/50 text-amber-400 font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all scifi-clip flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.15)] w-full md:w-auto"
                                >
                                    <RefreshCw className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                                    Continuity Restore
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── CONTINUITY RESTORE IN PROGRESS BANNER ─────────────────────────── */}
                {isResurrecting && (
                    <div className="relative overflow-hidden border border-cyan-500/60 bg-cyan-500/5">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                        <div className="flex items-center gap-5 p-4 sm:p-6">
                            <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center">
                                    <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-cyan-400" />
                                    <RefreshCw className="w-5 h-5 text-cyan-400 relative z-10 animate-spin" />
                                </div>
                            </div>
                            <div className="flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black text-cyan-400 uppercase tracking-[0.3em]">⟳ CONTINUITY RESTORE TRIGGERED</span>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                                    The agent engine has been signalled. The pipeline will resume momentarily.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── MISSION INTELLIGENCE SUMMARY ───────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                        <HUDFrame title="MISSION BRIEFING" variant="glass">
                            <div className="p-6 space-y-8">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                            <ShieldCheck className="w-3 h-3 text-cyan-500" /> Active Agency
                                        </label>
                                        <p className="text-white font-bold uppercase italic text-sm">{String(job?.assigned_agent_id || job?.assigned_agent_role || 'AWAITING')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-black text-slate-400 tracking-[0.2em] flex items-center gap-2">
                                            <Activity className="w-3 h-3 text-cyan-400" /> Current Stage
                                        </label>
                                        <p className="text-cyan-400 font-bold uppercase text-sm truncate">{derivedStatus.replace(/_/g, ' ')}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                            <Calendar className="w-3 h-3" /> Timestamp
                                        </label>
                                        <p className="text-slate-300 font-mono text-xs">{formatDate(job?.created_at || job?.updated_at)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-black text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                            <Layers className="w-3 h-3" /> Kernel Status
                                        </label>
                                        <div className="flex gap-1">
                                            <div className={cn("w-1.5 h-1.5 rounded-full", envelope?.identity_context?.verified ? "bg-emerald-500 shadow-[0_0_5px_#10b981]" : "bg-slate-700")} />
                                            <div className={cn("w-1.5 h-1.5 rounded-full", envelope?.authority_context?.lease_id ? "bg-cyan-500 shadow-[0_0_5px_#06b6d4]" : "bg-slate-700")} />
                                            <div className={cn("w-1.5 h-1.5 rounded-full", envelope?.execution_context?.status === "running" ? "bg-amber-500 shadow-[0_0_5px_#f59e0b] animate-pulse" : "bg-slate-700")} />
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                                <div className="space-y-3">
                                    <label className="text-[9px] uppercase font-black text-slate-600 tracking-[0.3em] block">Subject Directive</label>
                                    <div className="p-6 bg-black/40 border border-white/5 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20 group-hover:bg-cyan-500/50 transition-colors" />
                                        <p className="text-slate-200 text-lg leading-relaxed italic font-light tracking-wide">
                                            “{typeof job?.prompt === 'object' ? JSON.stringify(job.prompt) : String(job?.prompt || "No input prompt provided.")}”
                                        </p>
                                    </div>
                                </div>

                                {steps && steps.length > 0 && (
                                    <>
                                        <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent pt-4" />
                                        <div className="space-y-3">
                                            <label className="text-[9px] uppercase font-black text-slate-600 tracking-[0.3em] flex items-center gap-2">
                                                <Layers className="w-3 h-3 text-cyan-500" /> Pipeline Operations
                                            </label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {steps.map((step) => (
                                                    <EnvelopeStepCard
                                                        key={"step-" + step.step_id}
                                                        step={step as any}
                                                        artifacts={artifacts}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </HUDFrame>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <HUDFrame title="GOVERNANCE SCORE" variant="glass" className={cn(
                            "transition-all border-l-4",
                            isPass ? "border-l-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.05)]" : (finalGovStatus === 'FAIL' ? "border-l-red-500" : "border-l-slate-700")
                        )}>
                            <div className="p-6 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black italic tracking-tighter text-white">{governanceScore.toFixed(1)}</span>
                                        <span className="text-xs font-black text-slate-600">/10</span>
                                    </div>
                                    <div className={cn(
                                        "px-2 py-0.5 text-[10px] font-black uppercase tracking-widest inline-block scifi-clip-sm",
                                        isPass ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/30" : (finalGovStatus === 'FAIL' ? "bg-red-500/10 text-red-500 border border-red-500/30" : "bg-slate-500/10 text-slate-500")
                                    )}>
                                        {finalGovStatus}
                                    </div>
                                </div>
                                <div className="relative w-16 h-16">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                                        <circle
                                            cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="4"
                                            strokeDasharray={176} strokeDashoffset={176 - (176 * governanceScore) / 10}
                                            className={cn(isPass ? "text-emerald-500" : (finalGovStatus === 'FAIL' ? "text-red-500" : "text-slate-600"))}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </HUDFrame>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 glass border border-white/5 space-y-2">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Neural Strength</label>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-emerald-400">98.4%</span>
                                    <div className="flex-1 h-1 bg-white/5 overflow-hidden rounded-full">
                                        <div className="h-full bg-emerald-500" style={{ width: '98.4%' }} />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 glass border border-white/5 space-y-2">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Runtime Cost</label>
                                <p className="font-mono text-cyan-400 font-bold">$0.0024</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── GOVERNANCE ACTION BAR ─────────────────────────────────────────── */}
                {(() => {
                    const status = String(job?.status || '').toLowerCase();
                    const hasGradingData = governanceScore > 0 || !!evaluationArtifact;
                    const needsDecision = ['grading', 'graded', 'awaiting_approval'].includes(derivedStatus) && hasGradingData;
                    const isDecided = ['approved', 'rejected'].includes(status);

                    if (!needsDecision && !isDecided) return null;

                    if (isDecided) {
                        const approved = status === 'approved';
                        return (
                            <div className={cn(
                                "relative overflow-hidden border flex items-center gap-5 p-5",
                                approved
                                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.06)]"
                                    : "border-red-500/40 bg-red-500/5 shadow-[0_0_30px_rgba(239,68,68,0.06)]"
                            )}>
                                <div className={cn("absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent", approved ? "via-emerald-400/60" : "via-red-400/60")} />
                                <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center border shrink-0",
                                    approved ? "bg-emerald-500/10 border-emerald-500/40" : "bg-red-500/10 border-red-500/40"
                                )}>
                                    {approved
                                        ? <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                        : <XCircle className="w-5 h-5 text-red-500" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-[10px] font-black uppercase tracking-[0.3em]", approved ? "text-emerald-400" : "text-red-400")}>
                                        Governance Decision Logged
                                    </p>
                                    <p className="text-white font-bold text-sm mt-0.5">
                                        Artifact <span className={approved ? "text-emerald-400" : "text-red-400"}>{approved ? "Approved" : "Rejected"}</span>
                                        {job?.failure_reason ? ` — ${String(job.failure_reason)}` : ''}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Final Score</p>
                                    <p className={cn("text-2xl font-black italic", approved ? "text-emerald-400" : "text-red-400")}>
                                        {governanceScore.toFixed(1)}<span className="text-sm text-slate-600">/10</span>
                                    </p>
                                </div>
                            </div>
                        );
                    }

                    // needsDecision = true
                    return (
                        <div className="relative overflow-hidden border border-orange-500/50 bg-orange-500/5 shadow-[0_0_40px_rgba(249,115,22,0.08)]">
                            {/* animated top border */}
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

                            <div className="p-5 sm:p-7 space-y-5">
                                {/* Header row */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-10 h-10 shrink-0">
                                            <div className="absolute inset-0 rounded-full bg-orange-500/10 border border-orange-500/40 flex items-center justify-center">
                                                <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-orange-400" />
                                                <AlertTriangle className="w-4 h-4 text-orange-400 relative z-10" />
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-400/70">Action Required</p>
                                            <h2 className="text-lg font-black text-white italic tracking-tighter uppercase leading-tight">
                                                Governance Review Pending
                                            </h2>
                                        </div>
                                    </div>

                                    {/* Score + grade chips */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        {evaluationContent?.grade && (
                                            <div className="text-center">
                                                <p className="text-[8px] uppercase font-black text-slate-600 tracking-widest mb-0.5">Grade</p>
                                                <div className={cn(
                                                    "w-12 h-12 flex items-center justify-center border-2 text-2xl font-black italic scifi-clip",
                                                    isPass ? "border-emerald-500/60 text-emerald-400 bg-emerald-500/10" : "border-amber-500/60 text-amber-400 bg-amber-500/10"
                                                )}>
                                                    {String(evaluationContent.grade)}
                                                </div>
                                            </div>
                                        )}
                                        <div className="text-right">
                                            <p className="text-[8px] uppercase font-black text-slate-600 tracking-widest mb-0.5">Grader Score</p>
                                            <p className={cn(
                                                "text-4xl font-black italic tracking-tighter",
                                                isPass ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" : "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                                            )}>
                                                {governanceScore.toFixed(1)}
                                                <span className="text-base text-slate-600 ml-1">/10</span>
                                            </p>
                                            {evaluationContent?.recommendation && (
                                                <div className={cn(
                                                    "mt-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest inline-block scifi-clip-sm border",
                                                    String(evaluationContent.recommendation).toLowerCase() === 'approve'
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                )}>
                                                    AI: ↳ {String(evaluationContent.recommendation)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Summary line */}
                                {(evaluationContent?.summary) && (
                                    <div className="flex items-start gap-2 py-3 border-y border-white/5">
                                        <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                        <p className="text-slate-400 text-xs leading-relaxed italic">
                                            {String(evaluationContent.summary)}
                                        </p>
                                    </div>
                                )}

                                {/* Action buttons */}
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={handleApprove}
                                        disabled={actionLoading}
                                        className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 text-emerald-500 font-black uppercase tracking-[0.15em] transition-all cursor-target flex items-center justify-center gap-2 scifi-clip shadow-[0_0_20px_rgba(16,185,129,0.12)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-50 text-sm"
                                    >
                                        {actionLoading
                                            ? <RotateCw className="w-4 h-4 animate-spin" />
                                            : <ShieldCheck className="w-5 h-5" />}
                                        Approve Artifact
                                    </button>
                                    <button
                                        onClick={() => setIsRejectModalOpen(true)}
                                        disabled={actionLoading}
                                        className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 font-black uppercase tracking-[0.15em] transition-all cursor-target flex items-center justify-center gap-2 scifi-clip hover:shadow-[0_0_20px_rgba(239,68,68,0.15)] disabled:opacity-50 text-sm"
                                    >
                                        <XCircle className="w-5 h-5" /> Reject Artifact
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── UNIFIED MISSION TIMELINE ──────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                        {envelopeId && <EnvelopeInspector executionId={envelopeId} />}

                        <HUDFrame title="OPERATIONAL FEED" variant="dark">
                            <div className="p-0">
                                <Accordion type="multiple" defaultValue={["coo", "researcher", "worker", "grader"]} className="w-full">
                                    {/* 1. STRATEGY STAGE */}
                                    <AccordionItem value="coo" className="border-b border-white/5 px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center border scifi-clip bg-blue-500/10",
                                                        (job?.runtime_context?.plan || artifacts.some(a => a.artifact_type === 'plan')) ? "border-emerald-500 text-emerald-500" : "border-blue-500/40 text-blue-400"
                                                    )}>
                                                        <Activity className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-white uppercase italic tracking-widest text-sm block">Mission Strategy</span>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Primary: Strategic Planning Unit (COO)</span>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 text-[8px] font-black uppercase tracking-widest scifi-clip-sm",
                                                    (job?.runtime_context?.plan || artifacts.some(a => a.artifact_type === 'plan')) ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-blue-500/10 text-blue-500 border border-blue-500/30"
                                                )}>
                                                    {(job?.runtime_context?.plan || artifacts.some(a => a.artifact_type === 'plan')) ? "COMPLETE" : "OPERATING"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(() => {
                                                const artifact = artifacts.find(a => a.artifact_type === 'plan');
                                                const plan = job?.runtime_context?.plan || (job as any)?.plan;
                                                let rawContent = artifact?.artifact_content || plan;
                                                if (!rawContent) return <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting strategy formulation...</div>;

                                                // Parse plan content to extract tasks/assignments
                                                let planData: any = rawContent;
                                                if (typeof rawContent === 'string') {
                                                    try { planData = JSON.parse(rawContent); } catch(e) { planData = rawContent; }
                                                }

                                                // Extract tasks/assignments from plan structure
                                                const tasks: any[] = [];
                                                if (typeof planData === 'object' && planData !== null) {
                                                    const taskList = planData.tasks || planData.assignments || planData.roadmap || planData.steps || [];
                                                    if (Array.isArray(taskList)) {
                                                        taskList.forEach((t: any) => tasks.push(t));
                                                    }
                                                }

                                                const summaryText = typeof planData === 'object' && planData !== null
                                                    ? (planData.strategic_objective || planData.objective || planData.summary || planData.description || planData.mission || '')
                                                    : '';

                                                return (
                                                    <div className="space-y-6">
                                                        {/* Strategic objective */}
                                                        {summaryText && (
                                                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-sm">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-blue-400 mb-2">Strategic Objective</p>
                                                                <p className="text-sm text-slate-300 leading-relaxed">{String(summaryText)}</p>
                                                            </div>
                                                        )}

                                                        {/* Task grid */}
                                                        {tasks.length > 0 ? (
                                                            <div className="space-y-3">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-1">Assigned Tasks</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {tasks.map((task: any, idx: number) => {
                                                                        const taskName = task.task_name || task.name || task.title || task.id || `Task ${idx + 1}`;
                                                                        const taskDesc = task.task || task.description || task.detail || task.objective || (typeof task === 'string' ? task : '');
                                                                        const assignedTo = task.assigned_to || task.agent || task.assignee || task.executor || 'Unassigned';
                                                                        const priority = task.priority || task.urgency || '';
                                                                        return (
                                                                            <div key={idx} className="p-4 bg-white/[0.03] border border-white/10 scifi-clip hover:bg-white/[0.06] transition-colors group">
                                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">
                                                                                        {typeof taskName === 'object' ? JSON.stringify(taskName) : String(taskName)}
                                                                                    </span>
                                                                                    {priority && (
                                                                                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                                                                                            {String(priority)}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-xs text-slate-300 leading-relaxed mb-3">
                                                                                    {typeof taskDesc === 'object' ? JSON.stringify(taskDesc) : String(taskDesc || 'No description provided.')}
                                                                                </p>
                                                                                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                                                                    <User className="w-3 h-3 text-slate-600" />
                                                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                                                                        {typeof assignedTo === 'object' ? JSON.stringify(assignedTo) : String(assignedTo)}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // Fallback: render raw text if no structured tasks found
                                                            <div className="p-4 bg-black/40 border border-white/5 rounded-sm">
                                                                <MarkdownReport content={typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2)} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 2. INTELLIGENCE STAGE */}
                                    <AccordionItem value="researcher" className="border-b border-white/5 px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center border scifi-clip bg-emerald-500/10",
                                                        (job?.runtime_context?.research_result || artifacts.some(a => ['research', 'intelligence'].includes(a.artifact_type || ''))) ? "border-emerald-500 text-emerald-500" : "border-emerald-500/40 text-emerald-400"
                                                    )}>
                                                        <Search className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-white uppercase italic tracking-widest text-sm block">Intelligence Report</span>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Primary: Research Intelligence Unit</span>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 text-[8px] font-black uppercase tracking-widest scifi-clip-sm",
                                                    (job?.runtime_context?.research_result || artifacts.some(a => ['research', 'intelligence'].includes(a.artifact_type || ''))) ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-white/5 text-slate-600 border border-white/10"
                                                )}>
                                                    {(job?.runtime_context?.research_result || artifacts.some(a => ['research', 'intelligence'].includes(a.artifact_type || ''))) ? "COMPLETE" : "IDLE"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(() => {
                                                const artifact = artifacts.find(a => ['assign', 'research', 'intelligence'].includes(a.artifact_type || ''));
                                                const res = job?.runtime_context?.research_result || (job as any)?.research_intelligence;
                                                const content = artifact?.artifact_content || res;
                                                if (!content) return <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting research retrieval...</div>;
                                                return <DeliverableItem type="research" title={artifact?.title || "Intelligence Synthesis"} subtitle="Deep Data Retrieval" content={typeof content === 'string' ? content : JSON.stringify(content, null, 2)} />;
                                            })()}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 3. EXECUTION STAGE */}
                                    <AccordionItem value="worker" className="border-b border-white/5 px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center border scifi-clip bg-orange-500/10",
                                                        (job?.runtime_context?.final_result || artifacts.some(a => ['final', 'artifact_produce', 'worker_result'].includes(a.artifact_type || ''))) ? "border-emerald-500 text-emerald-500" : "border-orange-500/40 text-orange-400"
                                                    )}>
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-white uppercase italic tracking-widest text-sm block">Final Deliverable</span>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Primary: Autonomous Worker Unit</span>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 text-[8px] font-black uppercase tracking-widest scifi-clip-sm",
                                                    (job?.runtime_context?.final_result || artifacts.some(a => ['final', 'artifact_produce', 'worker_result'].includes(a.artifact_type || ''))) ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-white/5 text-slate-600 border border-white/10"
                                                )}>
                                                    {(job?.runtime_context?.final_result || artifacts.some(a => ['final', 'artifact_produce', 'worker_result'].includes(a.artifact_type || ''))) ? "COMPLETE" : "IDLE"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(() => {
                                                const artifact = artifacts.find(a => ['artifact_produce', 'report', 'final', 'worker_result', 'worker'].includes(a.artifact_type || ''));
                                                const result = job?.runtime_context?.worker_result || job?.runtime_context?.final_result || job?.artifact || extractOutputData(job);
                                                let rawContent = artifact?.artifact_content || result;
                                                if (!rawContent) return <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting final execution...</div>;

                                                // Flatten nested object - extract the best text representation
                                                let displayContent: string;

                                                const formatObjectAsMarkdown = (obj: any): string => {
                                                    // Recursively try to parse if obj is a string
                                                    if (typeof obj === 'string') {
                                                        try {
                                                            let cleanStr = obj.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim();
                                                            const parsed = JSON.parse(cleanStr);
                                                            if (typeof parsed === 'object' && parsed !== null) {
                                                                return formatObjectAsMarkdown(parsed);
                                                            }
                                                        } catch(e) {
                                                            return obj;
                                                        }
                                                    }

                                                    if (typeof obj !== 'object' || obj === null) return String(obj);

                                                    if (obj.sections && Array.isArray(obj.sections)) {
                                                        return obj.sections.map((s: any) => `## ${s.title || s.name || ''}\n\n${s.content || s.text || s.body || ''}`).join('\n\n');
                                                    }
                                                    
                                                    // Deep check if any key contains sections
                                                    for (const key of Object.keys(obj)) {
                                                        if (obj[key] && obj[key].sections && Array.isArray(obj[key].sections)) {
                                                            return obj[key].sections.map((s: any) => `## ${s.title || s.name || ''}\n\n${s.content || s.text || s.body || ''}`).join('\n\n');
                                                        }
                                                    }

                                                    const bestField = obj.final_output || obj.content || obj.report || obj.article || obj.text ||
                                                        obj.analysis || obj.deliverable || obj.result ||
                                                        obj.mission_synthesis || obj.executive_summary;
                                                        
                                                    if (bestField) {
                                                        return typeof bestField === 'object' ? formatObjectAsMarkdown(bestField) : bestField;
                                                    }
                                                        
                                                    return JSON.stringify(obj, null, 2);
                                                };

                                                displayContent = formatObjectAsMarkdown(rawContent);

                                                const title = artifact?.title || (typeof rawContent === 'object' && (rawContent as any)?.title) || 'Mission Synthesis';

                                                return (
                                                    <div className="space-y-4">
                                                        {/* Header */}
                                                        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                                                            <FileText className="w-5 h-5 text-purple-400" />
                                                            <div>
                                                                <span className="text-[9px] uppercase font-black tracking-widest text-purple-400 block">Final Tactical Output</span>
                                                                <h3 className="text-lg font-black text-white uppercase tracking-tight">{typeof title === 'object' ? JSON.stringify(title) : String(title)}</h3>
                                                            </div>
                                                        </div>

                                                        {/* Full Content */}
                                                        <div className="p-6 bg-purple-500/5 border border-purple-500/15 rounded-sm">
                                                            <MarkdownReport content={typeof displayContent === 'string' ? displayContent : JSON.stringify(displayContent, null, 2)} className="text-sm" />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 4. CERTIFICATION STAGE */}
                                    <AccordionItem value="grader" className="border-none px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center border scifi-clip bg-purple-500/10",
                                                        (governanceScore > 0 || evaluationArtifact) ? "border-emerald-500 text-emerald-500" : "border-purple-500/40 text-purple-400"
                                                    )}>
                                                        <ShieldCheck className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <span className="font-black text-white uppercase italic tracking-widest text-sm block">Governance Grading</span>
                                                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-600">Primary: Quality Assurance Grader (QA)</span>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 text-[8px] font-black uppercase tracking-widest scifi-clip-sm",
                                                    (governanceScore > 0 || evaluationArtifact) ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-white/5 text-slate-600 border border-white/10"
                                                )}>
                                                    {(governanceScore > 0 || evaluationArtifact) ? "GRADED" : "IDLE"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(governanceScore > 0 || evaluationArtifact) ? (
                                                <div className="space-y-5">
                                                    {/* Score Display */}
                                                    <div className="flex items-center gap-6 p-5 bg-black/50 border border-white/5 rounded-sm relative overflow-hidden">
                                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/3 to-transparent pointer-events-none" />
                                                        {/* Radial gauge */}
                                                        <div className="relative w-20 h-20 shrink-0">
                                                            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                                                                <circle cx="40" cy="40" r="34" fill="transparent" stroke="currentColor" strokeWidth="5" className="text-white/5" />
                                                                <circle
                                                                    cx="40" cy="40" r="34" fill="transparent" stroke="currentColor" strokeWidth="5"
                                                                    strokeDasharray={213.6}
                                                                    strokeDashoffset={213.6 - (213.6 * governanceScore) / 10}
                                                                    className={cn(
                                                                        "transition-all duration-1000",
                                                                        isPass ? "text-emerald-500" : (finalGovStatus === 'FAIL' ? "text-red-500" : "text-amber-500")
                                                                    )}
                                                                    strokeLinecap="round"
                                                                />
                                                            </svg>
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                                <span className={cn("text-base font-black italic leading-none", isPass ? "text-emerald-400" : (finalGovStatus === 'FAIL' ? "text-red-400" : "text-amber-400"))}>
                                                                    {governanceScore.toFixed(1)}
                                                                </span>
                                                                <span className="text-[8px] text-slate-600 font-bold">/10</span>
                                                            </div>
                                                        </div>

                                                        {/* Labels */}
                                                        <div className="flex-1 space-y-2">
                                                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Governance Score</p>
                                                            <p className={cn("text-3xl font-black italic tracking-tighter leading-none", isPass ? "text-emerald-400" : (finalGovStatus === 'FAIL' ? "text-red-400" : "text-amber-400"))}>
                                                                {governanceScore.toFixed(1)}<span className="text-sm text-slate-600 ml-1">/10</span>
                                                            </p>
                                                            <div className="flex items-center gap-2 flex-wrap pt-1">
                                                                <div className={cn(
                                                                    "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest scifi-clip-sm border",
                                                                    isPass ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : (finalGovStatus === 'FAIL' ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-amber-500/10 text-amber-500 border-amber-500/30")
                                                                )}>
                                                                    {finalGovStatus}
                                                                </div>
                                                                {evaluationContent?.grade && (
                                                                    <div className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest scifi-clip-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                                                                        Grade: {String(evaluationContent.grade)}
                                                                    </div>
                                                                )}
                                                                {evaluationContent?.recommendation && (
                                                                    <div className={cn(
                                                                        "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest scifi-clip-sm border",
                                                                        String(evaluationContent.recommendation).toLowerCase() === 'approve'
                                                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                                    )}>
                                                                        ↳ {String(evaluationContent.recommendation)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* ── Criteria Score Bars ────────────────────────────── */}
                                                    {evaluationContent?.criteria_scores && Object.keys(evaluationContent.criteria_scores).length > 0 && (
                                                        <div className="p-4 bg-black/30 border border-white/5 rounded-sm space-y-3">
                                                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-4">Evaluation Criteria Breakdown</p>
                                                            {Object.entries(evaluationContent.criteria_scores as Record<string, number>).map(([criterion, score]) => {
                                                                const pct = Math.min(100, Math.max(0, Number(score)));
                                                                const barColor = pct >= 80 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                                                    : pct >= 60 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                                                    : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
                                                                const textColor = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';
                                                                return (
                                                                    <div key={criterion} className="group space-y-1.5">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 capitalize">
                                                                                {criterion.replace(/_/g, ' ')}
                                                                            </span>
                                                                            <span className={cn("text-[10px] font-black tabular-nums", textColor)}>
                                                                                {pct}<span className="text-slate-600">/100</span>
                                                                            </span>
                                                                        </div>
                                                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                                            <div
                                                                                className={cn("h-full rounded-full transition-all duration-1000 ease-out", barColor)}
                                                                                style={{ width: `${pct}%` }}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* ── One-line Summary Callout ───────────────────────── */}
                                                    {(evaluationContent?.summary || evaluationContent?.grading_summary) && (
                                                        <div className="flex items-start gap-3 p-4 bg-purple-500/5 border-l-2 border-purple-500/60 border border-purple-500/10 rounded-sm">
                                                            <GraduationCap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-purple-400 mb-1.5">Evaluation Summary</p>
                                                                <p className="text-slate-200 text-sm leading-relaxed italic">
                                                                    "{String(evaluationContent?.summary || evaluationContent?.grading_summary || '')}"
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ── Full Detailed Feedback ─────────────────────────── */}
                                                    {(evaluationContent?.feedback || evaluationContent?.reasoning) && (
                                                        <div className="space-y-2">
                                                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Detailed Feedback</p>
                                                            <div className="relative p-5 bg-black/40 border border-white/5 rounded-sm overflow-hidden">
                                                                <div className="absolute top-0 left-0 w-0.5 h-full bg-gradient-to-b from-purple-500/0 via-purple-500/50 to-purple-500/0" />
                                                                <div className="absolute top-2 right-2 flex gap-1 opacity-40">
                                                                    <div className="w-1 h-1 rounded-full bg-purple-400" />
                                                                    <div className="w-1 h-1 rounded-full bg-purple-400/60" />
                                                                    <div className="w-1 h-1 rounded-full bg-purple-400/30" />
                                                                </div>
                                                                <p className="text-slate-300 text-sm leading-relaxed pl-3 whitespace-pre-wrap">
                                                                    {String(evaluationContent?.feedback || evaluationContent?.reasoning || '')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ── Fallback if no parsed artifact ─────────────────── */}
                                                    {!evaluationContent && (
                                                        <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-sm">
                                                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3">Automated Grading Result</h4>
                                                            <p className="text-slate-300 text-sm leading-relaxed">
                                                                {String(job?.runtime_context?.grading_result?.grading_summary ?? job?.grading_summary ?? job?.grading_result?.grading_summary ?? "No automated summary available.")}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* ── Approve / Reject ───────────────────────────────── */}
                                                    {['grading', 'graded', 'awaiting_approval'].includes(derivedStatus) && (
                                                        <div className="space-y-3 pt-2 border-t border-white/5">
                                                            <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Operator Decision Required</p>
                                                            <div className="flex gap-3">
                                                                <button
                                                                    onClick={handleApprove}
                                                                    disabled={actionLoading}
                                                                    className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-500 font-black uppercase tracking-widest transition-all cursor-target flex items-center justify-center gap-2 scifi-clip shadow-[0_0_20px_rgba(16,185,129,0.1)] disabled:opacity-50"
                                                                >
                                                                    {actionLoading ? <RotateCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                                                    Approve Artifact
                                                                </button>
                                                                <button
                                                                    onClick={() => setIsRejectModalOpen(true)}
                                                                    disabled={actionLoading}
                                                                    className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 font-black uppercase tracking-widest transition-all cursor-target flex items-center justify-center gap-2 scifi-clip disabled:opacity-50"
                                                                >
                                                                    <XCircle className="w-4 h-4" /> Reject Artifact
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ── Decision confirmed ─────────────────────────────── */}
                                                    {(job?.status?.toLowerCase() === 'approved' || job?.status?.toLowerCase() === 'rejected') && (
                                                        <div className={cn(
                                                            "p-4 border rounded-sm flex items-center gap-3",
                                                            job?.status?.toLowerCase() === 'approved' ? "bg-emerald-500/5 border-emerald-500/30" : "bg-red-500/5 border-red-500/30"
                                                        )}>
                                                            {job?.status?.toLowerCase() === 'approved'
                                                                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                                                : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                                                            <div>
                                                                <p className={cn("text-[10px] font-black uppercase tracking-widest", job?.status?.toLowerCase() === 'approved' ? "text-emerald-400" : "text-red-400")}>
                                                                    Artifact {job?.status?.toLowerCase() === 'approved' ? 'Approved' : 'Rejected'}
                                                                </p>
                                                                {job?.failure_reason && <p className="text-xs text-slate-500 mt-1">{String(job.failure_reason)}</p>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting certification review...</div>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        </HUDFrame>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        <HUDFrame title="OPERATIONAL LOGS" className="max-h-[600px] flex flex-col">
                           <div className="p-4 flex-1 overflow-hidden flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                     <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live Agent Stream</span>
                                     </div>
                                     <span className="text-[8px] font-mono text-slate-700">{agentLogs.length} EVENTS</span>
                                </div>
                                <div className="flex-1 overflow-auto custom-scroll pr-2">
                                     <AgentLogPanel logs={agentLogs} loading={agentLogsLoading && agentLogs.length === 0} />
                                </div>
                           </div>
                        </HUDFrame>

                        <HUDFrame title="DATA ARTIFACTS">
                            <div className="p-4 space-y-3">
                                {artifacts.length > 0 ? artifacts.map((artifact, i) => (
                                    <div 
                                        key={artifact.id || i} 
                                        className="p-3 bg-white/[0.03] border border-white/5 flex items-center gap-3 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                                        onClick={() => setViewingArtifact({ title: artifact.title || artifact.artifact_type, content: artifact.artifact_content })}
                                    >
                                         <div className="w-8 h-8 flex items-center justify-center border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 scifi-clip-sm">
                                            <FileText className="w-4 h-4" />
                                         </div>
                                         <div className="flex-1 min-w-0">
                                             <p className="text-[10px] font-black text-white uppercase truncate group-hover:text-cyan-400 transition-colors">
                                                 {artifact.title || (artifact.artifact_type ? artifact.artifact_type.replace(/_/g, ' ') : 'DATA_MANIFEST')}
                                             </p>
                                             <p className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">
                                                 {artifact.produced_by_agent || 'SYSTEM'} / {new Date(artifact.created_at).toLocaleTimeString()}
                                             </p>
                                         </div>
                                         <ChevronDown className="w-3 h-3 text-slate-700 -rotate-90 group-hover:text-cyan-500 transition-colors" />
                                    </div>
                                )) : (
                                    <div className="text-center py-6 opacity-20 italic text-[10px] uppercase tracking-widest">Zero artifacts produced</div>
                                )}
                            </div>
                        </HUDFrame>
                    </div>
                </div>

            {/* Artifact Manifest Viewer Modal */}
            <Dialog open={!!viewingArtifact} onOpenChange={(open) => !open && setViewingArtifact(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col glass border-white/10 p-0 overflow-hidden sm:rounded-none">
                    <DialogHeader className="p-6 border-b border-white/10 shrink-0">
                        <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                            <Terminal className="w-6 h-6 text-cyan-500" />
                            {String(viewingArtifact?.title || "Dimensional Manifest")}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-6 font-mono text-sm custom-scroll bg-black/60">
                        <pre className="text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                            {viewingArtifact && (typeof viewingArtifact.content === 'string'
                                ? viewingArtifact.content
                                : JSON.stringify(viewingArtifact.content, null, 2))
                            }
                        </pre>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end shrink-0">
                        <button
                            onClick={() => setViewingArtifact(null)}
                            className="px-8 py-2 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest hover:bg-white/10 transition-all scifi-clip cursor-target"
                        >
                            Close Manifest
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rejection Reason Modal */}
            <Dialog open={isRejectModalOpen} onOpenChange={(open) => !open && setIsRejectModalOpen(false)}>
                <DialogContent className="max-w-xl flex flex-col glass border-orange-500/20 shadow-[0_0_30px_rgba(249,115,22,0.1)] p-0 overflow-hidden sm:rounded-none">
                    <DialogHeader className="p-6 border-b border-white/10 shrink-0 bg-red-500/5">
                        <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                            Reject & Reroute Deliverable
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-[11px] leading-relaxed mt-2 uppercase tracking-widest font-bold">
                            Please provide a detailed strategic reason for this rejection.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 bg-black/60">
                        <div className="space-y-4">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest block flex items-center gap-2">
                                <FileText className="w-3 h-3 text-cyan-500" /> Operator Rejection Intelligence
                            </label>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Reason for rejection..."
                                className="w-full h-32 bg-white/5 border border-white/10 rounded-sm p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors custom-scroll resize-none"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="p-4 border-t border-white/10 bg-black/40 flex gap-4 shrink-0 justify-end">
                        <button
                            onClick={() => {
                                setIsRejectModalOpen(false);
                                setRejectionReason("");
                            }}
                            disabled={actionLoading}
                            className="px-6 py-2 bg-transparent text-slate-400 hover:text-white font-bold uppercase tracking-widest transition-colors cursor-target text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={actionLoading || !rejectionReason.trim()}
                            className="px-8 py-2 bg-red-500/10 border border-red-500/50 text-red-500 font-black uppercase tracking-widest hover:bg-red-500/20 transition-all scifi-clip cursor-target disabled:opacity-50 flex items-center gap-2"
                        >
                            {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            Execute Rejection
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    </div>
    );
}
