"use client";

import React, { use, useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
    Shield,
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
    BookOpen,
    Info,
    Layers,
    ArrowRight,
    ChevronDown,
    Download,
    Settings as SettingsIcon
} from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { cn, formatOutputToMarkdown } from "@/lib/utils";
import { HUDFrame } from "@/components/HUDFrame";
import { SciFiFrame } from "@/components/SciFiFrame";
import { MarkdownReport } from "@/components/MarkdownReport";
import { DeliverableItem } from "@/components/DeliverableItem";
import { exportToPDF } from "@/lib/pdf-export";
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

    const rawDeliverable = job?.runtime_context?.final_result || job?.runtime_context?.worker_result || job?.artifact || extractOutputData(job);
    const isReportReady = !!rawDeliverable;

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
    const isActuallyPass = String(passFailRaw).toLowerCase() === 'pass' || (governanceScore >= 7.5 && governanceScore > 0);
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

        if (status === 'approved') calculated = 10;
        else if (status === 'completed' || hasGrading || status === 'graded' || status === 'awaiting_approval') calculated = 9;
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
            if (envelope.fallback_suggested) return 'fallback_pending';
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
            if (currentActiveIndex >= 10) return 'approved';
            if (currentActiveIndex >= 9) return 'awaiting_approval'; // mapping to awaiting_approval for consistency
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

    const isAgentEngineFailure = (() => {
        const reason = String(job?.failure_reason || "").toLowerCase();
        return reason.includes("econnrefused") ||
            reason.includes("agent engine") ||
            reason.includes("fetch failed") ||
            reason.includes("no_worker_available");
    })();

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
        } finally {
            setActionLoading(false);
        }
    };

    const handleApproveFallback = async () => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await aceApi.approveFallback(jobId);
            refreshJob();
        } catch (error) {
            console.error("Approve fallback failed:", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectFallback = async () => {
        if (!user || actionLoading) return;
        setActionLoading(true);
        try {
            await aceApi.rejectFallback(jobId, "Operator Manual Fallback Rejection");
            refreshJob();
        } catch (error) {
            console.error("Reject fallback failed:", error);
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
        fallback_pending: "text-rose-500 border-rose-500/50 bg-rose-500/10",
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

                {/* ── FALLBACK / INTERVENTION ALERT ─────────────────────────── */}
                {envelope?.fallback_suggested && (() => {
                    const meta = envelope.fallback_metadata;
                    const isModelSwitch = meta?.suggested_action === 'model_switch';

                    return (
                        <div className="relative overflow-hidden border border-rose-500/60 bg-rose-500/10 shadow-[0_0_40px_rgba(244,63,94,0.1)] scifi-clip p-6 sm:p-8 animate-pulse-slow">
                            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-400 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />

                            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
                                <div className="flex items-start gap-6 flex-1">
                                    <div className="relative shrink-0">
                                        <div className="w-14 h-14 bg-rose-500/20 border border-rose-500/40 scifi-clip flex items-center justify-center">
                                            <RotateCw className="w-7 h-7 text-rose-400 animate-spin-slow" />
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-500 rounded-none flex items-center justify-center border border-black">
                                            <AlertTriangle className="w-3 h-3 text-black" />
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="px-2 py-0.5 bg-rose-500 text-black font-black text-[9px] uppercase tracking-widest scifi-clip-sm">
                                                Intervention Required
                                            </span>
                                            <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] italic">
                                                Fallback Pending Approval
                                            </span>
                                        </div>

                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-tight">
                                                {isModelSwitch ? 'Intelligence Provider Failure' : 'Runtime Connection Failure'}
                                            </h2>
                                            <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
                                                BYO-LLM configuration missing for organization: The provider <span className="text-rose-300 font-bold">&apos;{(meta as any)?.failed_provider || 'anthropic'}&apos;</span> is not enabled for your environment.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 pt-1">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-orange-500" />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    Action: Automatic switch to {meta?.target_model || 'GPT-4o'}
                                                </span>
                                            </div>
                                            <Link
                                                href="/system-config"
                                                className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all border-b border-cyan-400/30 pb-0.5 group"
                                            >
                                                <SettingsIcon className="w-3 h-3 group-hover:rotate-90 transition-transform" />
                                                Correct System Configuration
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3 w-full lg:w-auto shrink-0">
                                    <button
                                        onClick={handleApproveFallback}
                                        disabled={actionLoading}
                                        className="lg:px-10 py-5 bg-orange-500 text-black font-black uppercase tracking-[0.2em] hover:bg-orange-400 transition-all scifi-clip flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(249,115,22,0.3)] disabled:opacity-50"
                                    >
                                        <Zap className={cn("w-5 h-5", actionLoading && "animate-pulse")} />
                                        {actionLoading ? "Switching Provider..." : "Approve & Resume"}
                                    </button>
                                    <button
                                        onClick={handleRejectFallback}
                                        disabled={actionLoading}
                                        className="lg:px-8 py-4 bg-black/40 border border-orange-500/30 text-orange-400/70 font-black uppercase tracking-[0.2em] hover:bg-white/5 hover:text-orange-400 transition-all scifi-clip flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        <XCircle className="w-5 h-5" />
                                        Abort Mission
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── CRASH / STALL ALERT BANNER ─────────────────────────── */}
                {isStalled && !['graded', 'awaiting_approval', 'approved', 'completed'].includes(derivedStatus) && (() => {
                    const jobStatus = String(job?.status || "").toLowerCase();
                    const isNoWorker = ["created", "queued"].includes(jobStatus);
                    return (
                        <div className={cn(
                            "relative overflow-hidden animate-pulse-slow",
                            isNoWorker
                                ? "border border-rose-500/60 bg-rose-500/5"
                                : "border border-amber-500/60 bg-amber-500/5"
                        )}>
                            <div className={cn(
                                "absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent",
                                isNoWorker ? "via-rose-400" : "via-amber-400"
                            )} />
                            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 sm:p-6">
                                <div className="flex items-start gap-4">
                                    <div className="relative shrink-0">
                                        <div className={cn(
                                            "w-12 h-12 rounded-full border flex items-center justify-center",
                                            isNoWorker
                                                ? "bg-rose-500/10 border-rose-500/40"
                                                : "bg-amber-500/10 border-amber-500/40"
                                        )}>
                                            <div className={cn(
                                                "absolute inset-0 rounded-full animate-ping opacity-30",
                                                isNoWorker ? "bg-rose-400" : "bg-amber-400"
                                            )} />
                                            <Zap className={cn(
                                                "w-5 h-5 relative z-10",
                                                isNoWorker ? "text-rose-400" : "text-amber-400"
                                            )} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {isNoWorker ? (
                                                <>
                                                    <span className="text-xs font-black text-rose-400 uppercase tracking-[0.3em]">RUNTIME WORKER OFFLINE</span>
                                                    <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[9px] font-black uppercase tracking-widest scifi-clip">
                                                        NO EXECUTOR
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-xs font-black text-amber-400 uppercase tracking-[0.3em]">SERVER CRASH DETECTED</span>
                                                    <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-black uppercase tracking-widest scifi-clip">
                                                        PIPELINE STALLED
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {isNoWorker ? (
                                            <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                                                No runtime worker is running to execute this job. Start the worker
                                                process with <code className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-rose-300 font-mono text-xs rounded">npm run worker</code> and
                                                then restore continuity.
                                            </p>
                                        ) : (
                                            <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                                                The runtime worker stopped responding during job execution. No updates have been received for{" "}
                                                <span className="text-amber-400 font-bold font-mono">{staleSinceSeconds}s</span>.
                                                The job can be restored from its last safe checkpoint.
                                            </p>
                                        )}
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
                                        disabled={actionLoading || isNoWorker}
                                        title={isNoWorker ? "Start the runtime worker first (npm run worker)" : undefined}
                                        className={cn(
                                            "px-6 py-3 font-black uppercase tracking-widest transition-all scifi-clip flex items-center justify-center gap-2 w-full md:w-auto",
                                            isNoWorker
                                                ? "bg-slate-800/50 border border-slate-600/50 text-slate-500 cursor-not-allowed"
                                                : "bg-amber-500/10 border border-amber-500/50 text-amber-400 hover:bg-amber-500/20 cursor-pointer shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                                        )}
                                    >
                                        <RefreshCw className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                                        {isNoWorker ? "Worker Required" : "Continuity Restore"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ── AGENT ENGINE FAILURE BANNER ────────────────────────────────────── */}
                {!isStalled && String(job?.status || "").toLowerCase() === "failed" && isAgentEngineFailure && (
                    <div className="relative overflow-hidden border border-violet-500/60 bg-violet-500/5">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 sm:p-6">
                            <div className="flex items-start gap-4">
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/40 flex items-center justify-center">
                                        <Zap className="w-5 h-5 text-violet-400 relative z-10" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-black text-violet-400 uppercase tracking-[0.3em]">AGENT ENGINE UNAVAILABLE</span>
                                        <span className="px-2 py-0.5 bg-violet-500/20 border border-violet-500/40 text-violet-400 text-[9px] font-black uppercase tracking-widest scifi-clip">
                                            AUTO-FALLBACK READY
                                        </span>
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                                        The Python agent-engine at <code className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 text-violet-300 font-mono text-xs rounded">localhost:8001</code> was
                                        not reachable. Click <span className="text-cyan-400 font-bold">Restore Continuity</span> — the worker will
                                        automatically use the built-in TypeScript LLM fallback if the engine is still unavailable.
                                    </p>
                                    {job?.failure_reason && (
                                        <p className="text-[10px] text-slate-500 font-mono mt-1 truncate max-w-xl">
                                            {String(job.failure_reason)}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0 flex flex-col gap-2 w-full md:w-auto">
                                <button
                                    onClick={handleResurrect}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-violet-500/10 border border-violet-500/50 text-violet-400 font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all scifi-clip flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(139,92,246,0.15)] w-full md:w-auto"
                                >
                                    <RefreshCw className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                                    Restore Continuity
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
                                    Job has been re-queued. The runtime worker will pick it up on its next poll cycle.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── INTEGRITY BREACH ALERT ─────────────────────────────────────────── */}
                {(() => {
                    const failureReason = String(job?.failure_reason || envelope?.failure_reason || "");
                    const isFailed = String(job?.status || "").toLowerCase() === "failed" || envelope?.status === "failed";
                    const isMissingConfig = failureReason.includes("MISSING_INTELLIGENCE_CONFIG") || failureReason.includes("MISSING_API_KEY") || failureReason.includes("API key");

                    if (!isFailed || !failureReason || isAgentEngineFailure) return null;

                    return (
                        <div className="border border-rose-500/30 bg-rose-500/10 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500 mb-8">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 block">Integrity Breach / Execution Failed</span>
                                    <p className="text-[11px] font-mono text-rose-200 leading-tight">
                                        {failureReason}
                                    </p>
                                </div>
                            </div>

                            {isMissingConfig && (
                                <button
                                    onClick={() => router.push('/system-config')}
                                    className="w-full py-2 border border-rose-500/30 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all group"
                                >
                                    Configure Intelligence Providers
                                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                        </div>
                    );
                })()}

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

                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 glass border border-white/5 space-y-2">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Total Tokens</label>
                                <p className="font-mono text-slate-300 font-bold">{Number(typeof job?.token_usage === 'object' ? job.token_usage?.total_tokens ?? 0 : job?.token_usage ?? 0).toLocaleString()}</p>
                            </div>
                            <div className="p-4 glass border border-white/5 space-y-2">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Runtime Cost</label>
                                <p className="font-mono text-cyan-400 font-bold">${(Number((typeof job?.token_usage === 'object' ? job.token_usage?.cost : null) ?? job?.cost ?? 0)).toFixed(4)}</p>
                            </div>
                            <div className="p-4 glass border border-white/5 space-y-2">
                                <label className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">I/O Breakdown</label>
                                <div className="flex gap-2 font-mono text-[10px]">
                                    <span className="text-emerald-400">{Number(typeof job?.token_usage === 'object' ? job.token_usage?.input_tokens ?? 0 : 0).toLocaleString()} in</span>
                                    <span className="text-slate-600">/</span>
                                    <span className="text-amber-400">{Number(typeof job?.token_usage === 'object' ? job.token_usage?.output_tokens ?? 0 : 0).toLocaleString()} out</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── GOVERNANCE ACTION BAR ─────────────────────────────────────────── */}
                {(() => {
                    const status = String(job?.status || '').toLowerCase();
                    const isDecided = ['approved', 'rejected'].includes(status);

                    // Show the bar if we are in a decision stage OR if we have reached the worker/grading phase
                    const isLateStage = ['grading', 'graded', 'awaiting_approval', 'worker_execution', 'completed', 'failed', 'approved', 'rejected'].includes(derivedStatus);

                    // CRITICAL: Unlock buttons when status is awaiting_human or graded
                    const needsDecision = (['graded', 'awaiting_approval'].includes(derivedStatus) || status === 'awaiting_human') && !isDecided;

                    if (!isLateStage && !isDecided) return null;

                    // Case A.1 (Fallback) has been moved to the top of the page for maximum visibility.

                    if (isDecided || (status === 'completed' && !needsDecision)) {
                        // ── CASE A: Decision already made (Terminal) ──────────────
                        const approved = status === 'approved' || (status === 'completed' && isPass);
                        return (
                            <div className={cn(
                                "relative overflow-hidden border flex items-center gap-5 p-5 mb-8",
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
                                        Verification Decision Logged
                                    </p>
                                    <p className="text-white font-bold text-sm mt-0.5">
                                        Artifact <span className={approved ? "text-emerald-400" : "text-red-400"}>{approved ? "Approved" : "Rejected"}</span>
                                        {(!approved && job?.failure_reason) ? ` — ${String(job.failure_reason)}` : ''}
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
                    } else if (needsDecision) {
                        // ── CASE B: Decision required (Interactive) ───────────────
                        return (
                            <div className="relative overflow-hidden border border-orange-500/50 bg-orange-500/5 shadow-[0_0_40px_rgba(249,115,22,0.08)] mb-8">
                                {/* ... existing buttons container ... */}
                                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400/80 to-transparent" />
                                <div className="p-5 sm:p-7 space-y-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-10 h-10 shrink-0">
                                                <div className="absolute inset-0 rounded-full bg-orange-500/10 border border-orange-500/40 flex items-center justify-center">
                                                    <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-orange-400" />
                                                    <AlertTriangle className="w-4 h-4 text-orange-400 relative z-10" />
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-400/70">{actionLoading ? "Syncing..." : "Action Required"}</p>
                                                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase leading-tight">
                                                    Mission Verification Console
                                                </h2>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {evaluationContent?.grade && (
                                                <div className="text-center">
                                                    <p className="text-[8px] uppercase font-black text-slate-600 tracking-widest mb-0.5">Grade</p>
                                                    <div className={cn(
                                                        "w-12 h-12 flex items-center justify-center border-2 text-2xl font-black italic scifi-clip",
                                                        isPass ? "border-emerald-500/60 text-emerald-400 bg-emerald-500/10" : "border-amber-500/60 text-amber-400 bg-amber-500/10"
                                                    )}>
                                                        {evaluationContent.grade}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="text-right">
                                                <p className="text-[8px] uppercase font-black text-slate-600 tracking-widest mb-0.5">AI Integrity Score</p>
                                                <p className={cn("text-2xl font-black italic", isPass ? "text-emerald-400" : "text-amber-400")}>
                                                    {governanceScore.toFixed(1)}<span className="text-sm text-slate-600">/10</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleApprove}
                                            disabled={actionLoading}
                                            className="flex-1 py-4 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-black uppercase tracking-[0.2em] hover:bg-emerald-500/20 transition-all scifi-clip flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(16,185,129,0.1)] group disabled:opacity-50"
                                        >
                                            <ShieldCheck className={cn("w-5 h-5 group-hover:scale-110 transition-transform", actionLoading && "animate-spin")} />
                                            {actionLoading ? "Processing Approval..." : "Approve Artifact"}
                                        </button>
                                        <button
                                            onClick={() => setIsRejectModalOpen(true)}
                                            disabled={actionLoading}
                                            className="flex-1 py-4 bg-red-500/5 border border-red-500/30 text-red-500/70 font-black uppercase tracking-[0.2em] hover:bg-red-500/10 hover:text-red-500 transition-all scifi-clip flex items-center justify-center gap-3 group disabled:opacity-50"
                                        >
                                            <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                            Reject Release
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    } else if (isLateStage) {
                        // ── CASE C: Processing or initializing (Wait state) ────────
                        return (
                            <div className="relative overflow-hidden border border-white/5 bg-white/[0.02] p-6 mb-8 scifi-clip">
                                <div className="absolute top-0 left-0 w-24 h-px bg-cyan-500/50" />
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full border border-dashed border-white/20 flex items-center justify-center relative">
                                            <div className="absolute inset-0 rounded-full animate-spin-slow border-t border-cyan-500/40" />
                                            <Shield className="w-5 h-5 text-slate-600 animate-pulse" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 italic animate-pulse">
                                                Awaiting Certification Stage
                                            </p>
                                            <h2 className="text-base font-black text-white/50 italic tracking-tighter uppercase leading-tight">
                                                Verification HUD Reserved
                                            </h2>
                                        </div>
                                    </div>
                                    <div className="flex-1 max-w-md hidden md:block">
                                        <div className="h-1 w-full bg-white/5 overflow-hidden rounded-full">
                                            <div className="h-full bg-gradient-to-r from-cyan-500/20 via-cyan-500/50 to-cyan-500/20 animate-shimmer-fast" style={{ width: '100%' }} />
                                        </div>
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-700 mt-2 text-center italic">
                                            Neural Scanning Artifact integrity...
                                        </p>
                                    </div>
                                    <div className="px-4 py-2 bg-white/5 border border-white/10 text-[9px] font-black text-slate-500 uppercase tracking-widest opacity-50">
                                        Buttons Pending
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

                {/* ── UNIFIED MISSION TIMELINE ──────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 space-y-8">
                        {envelopeId && <EnvelopeInspector executionId={envelopeId} hideFailureBanner={true} />}

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
                                                    {(job?.runtime_context?.plan || artifacts.some(a => ['plan', 'task_plan'].includes(a.artifact_type || ''))) ? "COMPLETE" : "OPERATING"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(() => {
                                                const sortedArtifacts = [...artifacts].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
                                                const artifact = sortedArtifacts.find(a => ['plan', 'task_plan'].includes(a.artifact_type || ''));
                                                const plan = job?.runtime_context?.plan || (job as any)?.plan;
                                                let rawContent = artifact?.artifact_content || plan;
                                                if (!rawContent) return <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting strategy formulation...</div>;

                                                let planData: any = rawContent;
                                                if (typeof rawContent === 'string') {
                                                    try { planData = JSON.parse(rawContent); } catch (e) { planData = rawContent; }
                                                }

                                                const strategicObj = typeof planData === 'object' ? (planData.strategic_objective || planData.objective || '') : '';
                                                const missionCtx = typeof planData === 'object' ? (planData.mission_context || '') : '';
                                                const constraints = typeof planData === 'object' && Array.isArray(planData.constraints) ? planData.constraints : [];
                                                const qualityBar = typeof planData === 'object' ? (planData.quality_bar || '') : '';
                                                const complexity = typeof planData === 'object' ? (planData.estimated_complexity || '') : '';
                                                const tasks: any[] = typeof planData === 'object' ? (planData.assignments || planData.tasks || []) : [];

                                                return (
                                                    <div className="space-y-6">
                                                        {/* Executive Summary Row */}
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            {complexity && (
                                                                <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-sm">
                                                                    <p className="text-[8px] uppercase font-black tracking-widest text-cyan-400 mb-1">Complexity</p>
                                                                    <p className="text-xs font-bold text-white uppercase">{String(complexity)}</p>
                                                                </div>
                                                            )}
                                                            {tasks.length > 0 && (
                                                                <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-sm">
                                                                    <p className="text-[8px] uppercase font-black tracking-widest text-purple-400 mb-1">Assignments</p>
                                                                    <p className="text-xs font-bold text-white">{tasks.length} Tactical Units</p>
                                                                </div>
                                                            )}
                                                            {qualityBar && (
                                                                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                                                                    <p className="text-[8px] uppercase font-black tracking-widest text-emerald-400 mb-1">Quality Bar</p>
                                                                    <p className="text-xs text-slate-300 leading-relaxed">{String(qualityBar)}</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Strategic Objective */}
                                                        {strategicObj && (
                                                            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-sm">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-blue-400 mb-2">Strategic Objective</p>
                                                                <p className="text-sm text-slate-300 leading-relaxed">{String(strategicObj)}</p>
                                                            </div>
                                                        )}

                                                        {/* Mission Context */}
                                                        {missionCtx && (
                                                            <div className="p-4 bg-white/[0.02] border border-white/10 rounded-sm">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-400 mb-2">Mission Context</p>
                                                                <p className="text-sm text-slate-400 leading-relaxed">{String(missionCtx)}</p>
                                                            </div>
                                                        )}

                                                        {/* Role Assignments */}
                                                        {tasks.length > 0 && (
                                                            <div className="space-y-3">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-1">Role Assignments</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {tasks.map((task: any, idx: number) => {
                                                                        const taskName = task.name || task.task_name || task.title || `Assignment ${idx + 1}`;
                                                                        const taskDesc = task.task || task.description || task.detail || '';
                                                                        const expectedOutput = task.expected_output || '';
                                                                        const successCriteria = task.success_criteria || '';
                                                                        const assignedTo = task.assigned_to || task.agent_role || task.agent || task.executor || '';
                                                                        const priority = task.priority || '';
                                                                        const priorityColor = priority === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400' : priority === 'high' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-500/10 border-slate-500/30 text-slate-400';
                                                                        return (
                                                                            <div key={idx} className="p-4 bg-white/[0.03] border border-white/10 scifi-clip hover:bg-white/[0.06] transition-colors space-y-3">
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">{String(taskName)}</span>
                                                                                    {priority && (
                                                                                        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 border shrink-0 ${priorityColor}`}>{String(priority)}</span>
                                                                                    )}
                                                                                </div>
                                                                                {assignedTo && (
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <User className="w-3 h-3 text-slate-600" />
                                                                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{String(assignedTo)}</span>
                                                                                    </div>
                                                                                )}
                                                                                <p className="text-xs text-slate-300 leading-relaxed">{String(taskDesc)}</p>
                                                                                {expectedOutput && (
                                                                                    <div className="pt-2 border-t border-white/5">
                                                                                        <p className="text-[8px] uppercase font-black tracking-widest text-emerald-500/70 mb-1">Expected Output</p>
                                                                                        <p className="text-[11px] text-slate-400 leading-relaxed">{String(expectedOutput)}</p>
                                                                                    </div>
                                                                                )}
                                                                                {successCriteria && (
                                                                                    <div className="pt-2 border-t border-white/5">
                                                                                        <p className="text-[8px] uppercase font-black tracking-widest text-blue-500/70 mb-1">Success Criteria</p>
                                                                                        <p className="text-[11px] text-slate-400 leading-relaxed">{String(successCriteria)}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Constraints */}
                                                        {constraints.length > 0 && (
                                                            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-sm">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-red-400/70 mb-3">Constraints & Requirements</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {constraints.map((c: any, i: number) => (
                                                                        <span key={i} className="px-2 py-1 bg-red-500/5 border border-red-500/20 text-[10px] text-slate-400">{String(c)}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Fallback */}
                                                        {!strategicObj && !missionCtx && tasks.length === 0 && (
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
                                                    {(job?.runtime_context?.research_result || artifacts.some(a => ['assignment', 'assign', 'research', 'intelligence', 'task_assign'].includes(a.artifact_type || ''))) ? "COMPLETE" : "IDLE"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(() => {
                                                const sortedArtifacts = [...artifacts].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
                                                const artifact = sortedArtifacts.find(a => ['assignment', 'assign', 'research', 'intelligence', 'task_assign'].includes(a.artifact_type || ''));
                                                const res = job?.runtime_context?.research_result || (job as any)?.research_intelligence;
                                                const rawContent = artifact?.artifact_content || res;
                                                if (!rawContent) return <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting research retrieval...</div>;

                                                let resData: any = rawContent;
                                                if (typeof rawContent === 'string') {
                                                    try { resData = JSON.parse(rawContent); } catch (e) { resData = { research_summary: rawContent }; }
                                                }

                                                const summary = resData.research_summary || resData.summary || '';
                                                const findings: any[] = Array.isArray(resData.key_findings) ? resData.key_findings : [];
                                                const resources: any[] = Array.isArray(resData.resources) ? resData.resources : [];
                                                const riskFactors: any[] = Array.isArray(resData.risk_factors) ? resData.risk_factors : [];
                                                const approach = resData.recommended_approach || '';
                                                const confidence = resData.confidence_level || '';

                                                return (
                                                    <div className="space-y-6">
                                                        {/* Summary */}
                                                        {summary && (
                                                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <p className="text-[9px] uppercase font-black tracking-widest text-emerald-400">Intelligence Summary</p>
                                                                    {confidence && <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">{confidence} confidence</span>}
                                                                </div>
                                                                <p className="text-sm text-slate-300 leading-relaxed">{String(summary)}</p>
                                                            </div>
                                                        )}

                                                        {/* Key Findings */}
                                                        {findings.length > 0 && (
                                                            <div className="space-y-3">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-1">Intelligence Findings</p>
                                                                <div className="space-y-3">
                                                                    {findings.map((f: any, i: number) => {
                                                                        const title = typeof f === 'string' ? `Finding ${i + 1}` : (f.title || `Finding ${i + 1}`);
                                                                        const detail = typeof f === 'string' ? f : (f.detail || f.description || '');
                                                                        const significance = typeof f === 'object' ? (f.significance || '') : '';
                                                                        return (
                                                                            <div key={i} className="p-4 bg-white/[0.03] border border-white/10 scifi-clip hover:bg-white/[0.06] transition-colors">
                                                                                <div className="flex items-start gap-3 mb-2">
                                                                                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                                                                                        <span className="text-[9px] font-black text-emerald-400">{i + 1}</span>
                                                                                    </div>
                                                                                    <p className="text-[10px] font-black text-emerald-300 uppercase tracking-wider">{String(title)}</p>
                                                                                </div>
                                                                                <p className="text-xs text-slate-300 leading-relaxed pl-8">{String(detail)}</p>
                                                                                {significance && (
                                                                                    <div className="mt-3 pl-8">
                                                                                        <p className="text-[8px] uppercase font-black tracking-widest text-blue-400/70 mb-1">Significance</p>
                                                                                        <p className="text-[11px] text-blue-300/70 leading-relaxed italic">{String(significance)}</p>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Resources */}
                                                        {resources.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-1">Resources & References</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                    {resources.map((r: any, i: number) => {
                                                                        const title = typeof r === 'string' ? r : (r.title || r.name || `Resource ${i + 1}`);
                                                                        const type = typeof r === 'object' ? (r.type || '') : '';
                                                                        const relevance = typeof r === 'object' ? (r.relevance || '') : '';
                                                                        return (
                                                                            <div key={i} className="p-3 bg-white/[0.02] border border-white/10 rounded-sm">
                                                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                                                    <span className="text-[10px] font-bold text-slate-300">{String(title)}</span>
                                                                                    {type && <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 font-black uppercase tracking-wider shrink-0">{String(type)}</span>}
                                                                                </div>
                                                                                {relevance && <p className="text-[10px] text-slate-500 leading-relaxed">{String(relevance)}</p>}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Recommended Approach */}
                                                        {approach && (
                                                            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-sm">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-amber-400 mb-2">Recommended Approach for Worker</p>
                                                                <p className="text-sm text-slate-300 leading-relaxed">{String(approach)}</p>
                                                            </div>
                                                        )}

                                                        {/* Risk Factors */}
                                                        {riskFactors.length > 0 && (
                                                            <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-sm">
                                                                <p className="text-[9px] uppercase font-black tracking-widest text-red-400/70 mb-2">Risk Factors</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {riskFactors.map((r: any, i: number) => <span key={i} className="px-2 py-1 bg-red-500/5 border border-red-500/20 text-[10px] text-slate-400">{String(r)}</span>)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
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
                                                    (job?.runtime_context?.final_result || artifacts.some(a => ['final', 'artifact_produce', 'worker_result', 'deliverable'].includes(a.artifact_type || ''))) ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" : "bg-white/5 text-slate-600 border border-white/10"
                                                )}>
                                                    {(job?.runtime_context?.final_result || artifacts.some(a => ['final', 'artifact_produce', 'worker_result', 'deliverable'].includes(a.artifact_type || ''))) ? "COMPLETE" : "IDLE"}
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-8 space-y-6">
                                            {(() => {
                                                const artifact = artifacts.find(a => ['artifact_produce', 'report', 'final', 'worker_result', 'worker', 'deliverable'].includes(a.artifact_type || ''));
                                                const result = job?.runtime_context?.worker_result || job?.runtime_context?.final_result || job?.artifact || extractOutputData(job);
                                                let rawContent = artifact?.artifact_content || result;
                                                if (!rawContent) return <div className="text-center py-8 opacity-20 italic text-[10px] uppercase tracking-widest border border-dashed border-white/5">Awaiting final execution...</div>;

                                                let workerData: any = (typeof result === 'object' && result !== null) ? result : rawContent;
                                                if (typeof workerData === 'string') {
                                                    try {
                                                        let clean = (workerData as string).replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim();
                                                        workerData = JSON.parse(clean);
                                                    } catch (e) { workerData = { content: workerData }; }
                                                }

                                                // Ensure workerData has any missing metadata from the result object
                                                if (!workerData.grounding_report && result?.grounding_report) {
                                                    workerData.grounding_report = result.grounding_report;
                                                }
                                                if (!workerData.key_conclusions && result?.key_conclusions) {
                                                    workerData.key_conclusions = result.key_conclusions;
                                                }
                                                if (!workerData.source_references && result?.source_references) {
                                                    workerData.source_references = result.source_references;
                                                }

                                                let sections: any[] = Array.isArray(workerData.sections) ? workerData.sections : [];
                                                let content = workerData.content || workerData.report || workerData.text || workerData.deliverable || workerData.artifact || '';

                                                // Handle double-encoded JSON or JSON-in-string cases
                                                if (typeof content === 'string' && content.trim().startsWith('{')) {
                                                    try {
                                                        const cleanContent = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim();
                                                        const parsed = JSON.parse(cleanContent);
                                                        if (parsed.sections && Array.isArray(parsed.sections) && sections.length === 0) {
                                                            sections = parsed.sections;
                                                        }
                                                        content = parsed.content || parsed.report || parsed.text || parsed.body || parsed.markdown || (parsed.sections ? '' : content);
                                                    } catch (e) { /* Not valid JSON, keep as string */ }
                                                }

                                                if (typeof content === 'object' && content !== null) {
                                                    if ((content as any).sections && Array.isArray((content as any).sections) && sections.length === 0) {
                                                        sections = (content as any).sections;
                                                    }
                                                    content = (content as any).text || (content as any).body || (content as any).markdown || (content as any).content || (sections.length > 0 ? '' : JSON.stringify(content, null, 2));
                                                }

                                                // Enhanced Robust Markdown Formatter for JSON structures
                                                const formatToMarkdown = (raw: any): string => {
                                                    if (!raw) return "";
                                                    if (typeof raw === 'string') {
                                                        const trimmed = raw.trim();
                                                        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                                                            try { return formatToMarkdown(JSON.parse(trimmed)); } catch { return raw; }
                                                        }
                                                        return raw;
                                                    }
                                                    if (typeof raw !== 'object') return String(raw);

                                                    let md = "";

                                                    // 1. Sections (Highest priority for structured content)
                                                    const sectionsList = raw.sections || raw.content?.sections || (Array.isArray(raw.content) ? raw.content : null);

                                                    // 2. Executive Summary
                                                    const summary = raw.deliverable_summary || raw.summary || raw.executive_summary;
                                                    // Only add if it's not a generic placeholder and not already in sections
                                                    const hasSummarySection = Array.isArray(sectionsList) && sectionsList.some((s: any) =>
                                                        String(s.title || s.header || "").toLowerCase().includes('summary')
                                                    );

                                                    if (summary && typeof summary === 'string' && !summary.toLowerCase().includes('worker output') && !hasSummarySection) {
                                                        const cleanSummary = summary.trim();
                                                        if (cleanSummary && cleanSummary.length > 10) {
                                                            md += `# Executive Summary\n\n${cleanSummary}\n\n`;
                                                        }
                                                    }

                                                    if (sectionsList && Array.isArray(sectionsList)) {
                                                        md += sectionsList.map((s: any, i: number) => {
                                                            if (typeof s === 'string') return s;
                                                            const title = s.title || s.header || s.name || `Section ${i + 1}`;
                                                            const body = s.body || s.content || s.text || "";
                                                            return `## ${title}\n\n${body}\n\n`;
                                                        }).join("\n");
                                                        return md.trim();
                                                    }

                                                    // 3. Fallback content/findings
                                                    if (raw.title || raw.findings || raw.content) {
                                                        if (raw.title && typeof raw.title === 'string' && !md.includes(raw.title)) {
                                                            md = `# ${raw.title}\n\n` + md;
                                                        }
                                                        if (raw.content && typeof raw.content === 'string') {
                                                            const cleanContent = raw.content.trim();
                                                            if (cleanContent && !md.includes(cleanContent.substring(0, 50))) {
                                                                if (md && !md.endsWith('\n\n')) md += md.endsWith('\n') ? '\n' : '\n\n';
                                                                md += cleanContent + "\n\n";
                                                            }
                                                        }

                                                        const listItems = raw.findings || raw.steps || raw.items || raw.results;
                                                        if (Array.isArray(listItems)) {
                                                            if (raw.findings && !md.includes('Key Findings')) md += `### Key Findings\n\n`;
                                                            md += listItems.map((item: any) => {
                                                                if (typeof item === 'object') {
                                                                    const label = item.title || item.label || item.name;
                                                                    const val = item.body || item.content || item.value || item.description || JSON.stringify(item);
                                                                    return label ? `* **${label}:** ${val}` : `* ${val}`;
                                                                }
                                                                return `* ${item}`;
                                                            }).join("\n");
                                                        }
                                                        if (md) return md.trim();
                                                    }

                                                    return "```json\n" + JSON.stringify(raw, null, 2) + "\n```";
                                                };

                                                const displayContent = formatToMarkdown(rawContent);

                                                const conclusions: any[] = Array.isArray(workerData.key_conclusions) ? workerData.key_conclusions : [];
                                                const synthesis = workerData.research_synthesis || '';
                                                const limitations: any[] = Array.isArray(workerData.limitations) ? workerData.limitations : [];
                                                const execSummary = workerData.executive_summary || workerData.deliverable_summary || (sections.length > 0 && String(sections[0].title).toLowerCase().includes('summary') ? sections[0].body : '') || '';

                                                return (
                                                    <div className="space-y-12">
                                                        {/* Grounding & Verification HUD */}
                                                        {workerData.grounding_report && (
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                <div className="p-4 bg-cyan-500/5 border border-cyan-500/10 rounded-sm">
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <span className="text-[8px] font-black uppercase tracking-widest text-cyan-400">Grounding Status</span>
                                                                        <ShieldCheck className={cn("w-3 h-3", (workerData.grounding_report.fabrication_check === 'VERIFIED' || (!workerData.grounding_report.fabrication_check || workerData.grounding_report.fabrication_check === 'UNKNOWN') && (workerData.grounding_report.kb_chunks_cited > 0 || workerData._grounding_meta?.kb_chunks_used > 0)) ? "text-emerald-400" : "text-amber-400")} />
                                                                    </div>
                                                                    <div className="text-lg font-mono font-black text-white">
                                                                        {workerData.grounding_report.fabrication_check && workerData.grounding_report.fabrication_check !== 'UNKNOWN'
                                                                            ? workerData.grounding_report.fabrication_check
                                                                            : ((workerData.grounding_report.kb_chunks_cited > 0 || workerData._grounding_meta?.kb_chunks_used > 0) ? 'VERIFIED' : 'UNKNOWN')}
                                                                    </div>
                                                                </div>
                                                                <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-sm">
                                                                    <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 block mb-2">Knowledge Density</span>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-lg font-mono font-black text-white">{workerData.grounding_report.kb_chunks_cited || workerData._grounding_meta?.kb_chunks_used || 0}</span>
                                                                        <span className="text-[10px] text-slate-500 uppercase">Context Units</span>
                                                                    </div>
                                                                </div>
                                                                <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-sm">
                                                                    <span className="text-[8px] font-black uppercase tracking-widest text-purple-400 block mb-2">Intelligence Source</span>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <span className="text-lg font-mono font-black text-white">{workerData._grounding_meta?.web_results_used || workerData.grounding_report?.web_sources_cited || 0}</span>
                                                                        <span className="text-[10px] text-slate-500 uppercase">Web Data</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-2 px-1 opacity-60">
                                                                <BookOpen className="w-3 h-3 text-cyan-500" />
                                                                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Full Deliverable Content</span>
                                                            </div>

                                                            <div className="p-10 bg-black border border-white/5 rounded-sm shadow-2xl relative overflow-hidden">
                                                                <div className="relative z-10">
                                                                    <MarkdownReport content={displayContent} className="text-sm" />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Strategic Findings */}
                                                        {conclusions.length > 0 && (
                                                            <div className="space-y-4 pt-4">
                                                                <p className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-500 px-1 text-center">Strategic Findings HUD</p>
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    {conclusions.map((c: any, i: number) => {
                                                                        const conclusion = c.conclusion || (typeof c === 'string' ? c : '');
                                                                        const evidence = c.evidence || '';
                                                                        const recommendation = c.recommendation || '';
                                                                        return (
                                                                            <div key={i} className="p-5 bg-cyan-500/[0.03] border border-cyan-500/10 rounded-sm relative group hover:bg-cyan-500/[0.05] transition-all">
                                                                                <div className="absolute top-4 left-0 w-1 h-6 bg-cyan-500/40" />
                                                                                <div className="flex items-start gap-4">
                                                                                    <Zap className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                                                                                    <div className="space-y-3 flex-1">
                                                                                        <p className="text-sm font-bold text-slate-200 leading-relaxed">{String(conclusion)}</p>
                                                                                        {evidence && (
                                                                                            <div className="p-3 bg-black/20 border border-white/5 rounded-sm">
                                                                                                <p className="text-[8px] uppercase font-black tracking-widest text-blue-400/70 mb-1">Empirical Evidence</p>
                                                                                                <p className="text-[11px] text-slate-400 leading-relaxed italic">{String(evidence)}</p>
                                                                                            </div>
                                                                                        )}
                                                                                        {recommendation && (
                                                                                            <div className="flex items-start gap-2 text-[11px] text-emerald-400/90 bg-emerald-500/5 p-2 rounded-sm border border-emerald-500/10">
                                                                                                <Target className="w-3 h-3 mt-0.5" />
                                                                                                <p>{String(recommendation)}</p>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Source References */}
                                                        {workerData.source_references && workerData.source_references.length > 0 && (
                                                            <div className="space-y-3 pt-6">
                                                                <p className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-500 px-1">Source Provenance</p>
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                    {workerData.source_references.map((ref: any, i: number) => (
                                                                        <div key={i} className="p-3 bg-white/[0.02] border border-white/5 rounded-sm flex items-start gap-3">
                                                                            <div className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-[8px] font-mono font-bold text-blue-400 rounded-xs mt-0.5">{ref.ref_id}</div>
                                                                            <div className="space-y-1">
                                                                                <p className="text-[10px] font-bold text-slate-300">{ref.title}</p>
                                                                                <p className="text-[9px] text-slate-500 leading-tight">{ref.usage}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Evidence Gaps */}
                                                        {workerData.evidence_gaps && workerData.evidence_gaps.length > 0 && (
                                                            <div className="space-y-3 pt-6">
                                                                <p className="text-[9px] uppercase font-black tracking-[0.2em] text-amber-500/60 px-1">Identified Intelligence Gaps</p>
                                                                <div className="space-y-2">
                                                                    {workerData.evidence_gaps.map((gap: any, i: number) => (
                                                                        <div key={i} className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-sm flex items-start gap-4">
                                                                            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                                            <div className="space-y-1 flex-1">
                                                                                <p className="text-xs font-bold text-amber-200/90">{gap.gap}</p>
                                                                                <p className="text-[10px] text-slate-400">{gap.impact}</p>
                                                                                <div className="mt-2 text-[9px] text-amber-400/80 font-mono italic">Resolution: {gap.recommended_resolution}</div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Research Synthesis */}
                                                        {synthesis && (
                                                            <div className="p-6 bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-sm mt-8">
                                                                <div className="flex items-center gap-3 mb-3">
                                                                    <Cpu className="w-4 h-4 text-emerald-400" />
                                                                    <p className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Synthesis Engine Output</p>
                                                                </div>
                                                                <p className="text-sm text-slate-300 leading-relaxed font-medium">{String(synthesis)}</p>
                                                            </div>
                                                        )}

                                                        {/* Limitations */}
                                                        {limitations.length > 0 && (
                                                            <div className="p-4 bg-white/[0.02] border border-white/5 rounded-sm mt-4">
                                                                <div className="flex items-center gap-3 mb-3">
                                                                    <Info className="w-4 h-4 text-slate-500" />
                                                                    <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Scoped Constraints</p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {limitations.map((l: any, i: number) => <span key={i} className="px-2.5 py-1 bg-black/40 border border-white/10 text-[10px] font-mono text-slate-400 rounded-sm">{String(l)}</span>)}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Fallback: no structured data */}
                                                        {!execSummary && !content && sections.length === 0 && (
                                                            <div className="p-12 bg-purple-500/5 border border-purple-500/20 border-dashed rounded-sm text-center">
                                                                <p className="text-[10px] uppercase font-black tracking-widest text-purple-400/60 mb-4">Raw Artifact Stream</p>
                                                                <MarkdownReport content={typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2)} className="text-sm opacity-80" />
                                                            </div>
                                                        )}
                                                        <div className="flex justify-center pt-8">
                                                            <button
                                                                onClick={() => {
                                                                    const artifact = artifacts.find(a => ['deliverable', 'artifact_produce', 'produce_artifact', 'report', 'final', 'worker_result', 'worker'].includes(a.artifact_type || ''));
                                                                    const result = job?.runtime_context?.worker_result || job?.runtime_context?.final_result || job?.artifact || extractOutputData(job);
                                                                    const rawContent = artifact?.artifact_content || result;

                                                                    // Resolve provider/model with broad fallback chain
                                                                    const resolvedProvider = (job as any)?.neural_provider || (job as any)?.model_provider || (job as any)?.provider || (envelope as any)?.neural_provider || (envelope as any)?.provider || 'N/A';
                                                                    const resolvedModel = (job as any)?.model_used || (job as any)?.model || (job as any)?.llm_model || (envelope as any)?.model_used || (envelope as any)?.model || 'N/A';

                                                                    let md = `# Intelligence Report(PRO): ${job?.job_id || jobId}\n\n`;
                                                                    md += `## Audit Metadata\n\n`;
                                                                    md += `* **Job ID:** ${job?.job_id || jobId}\n`;
                                                                    md += `* **Envelope ID:** ${envelope?.envelope_id || job?.envelope_id || 'N/A'}\n`;
                                                                    md += `* **Status:** ${derivedStatus?.toUpperCase() || 'UNKNOWN'}\n`;
                                                                    // md += `* **Neural Provider:** ${resolvedProvider.toUpperCase()}\n`;
                                                                    // md += `* **Compute Model:** ${resolvedModel}\n`;
                                                                    md += `* **Compute Cost:** $${Number((typeof job?.token_usage === 'object' ? job?.token_usage?.cost : null) ?? job?.cost ?? 0).toFixed(6)}\n`;
                                                                    md += `* **Token Usage:** ${Number(typeof job?.token_usage === 'object' ? job?.token_usage?.total_tokens ?? 0 : job?.token_usage ?? 0).toLocaleString()}\n`;
                                                                    md += `* **Generated At:** ${new Date().toLocaleString()}\n\n`;

                                                                    if (job?.prompt) {
                                                                        md += `## Strategic Intent\n\n`;
                                                                        md += `> ${job.prompt}\n\n`;
                                                                    }

                                                                    if (job?.runtime_context?.plan) {
                                                                        md += `## Strategic Plan\n\n`;
                                                                        md += `${typeof job.runtime_context.plan === 'string' ? job.runtime_context.plan : JSON.stringify(job.runtime_context.plan, null, 2)}\n\n`;
                                                                    }

                                                                    if (governanceScore > 0 || evaluationContent) {
                                                                        md += `## Governance Grading\n\n`;
                                                                        md += `* **Score:** ${governanceScore.toFixed(1)}/10\n`;
                                                                        md += `* **Verdict:** ${finalGovStatus}\n`;
                                                                        const graderObj = evaluationContent || job?.runtime_context?.grading_result || job?.grading_result || job?.grader_params || job;
                                                                        const rationale = graderObj?.reason || graderObj?.reasoning || graderObj?.reasoning_summary || graderObj?.summary || graderObj?.grading_summary || graderObj?.feedback || "*No reasoning provided.*";
                                                                        // if (rationale) md += `* **Evaluation Reason:** ${typeof rationale === 'object' ? JSON.stringify(rationale) : rationale}\n`;
                                                                        if (graderObj?.risk_flags && Array.isArray(graderObj.risk_flags) && graderObj.risk_flags.length > 0) {
                                                                            md += `* **Risk Flags:** ${graderObj.risk_flags.join(', ')}\n`;
                                                                        }
                                                                        md += `\n`;
                                                                    }

                                                                    let workerData: any = rawContent;
                                                                    if (typeof rawContent === 'string' && rawContent.trim().startsWith('{')) {
                                                                        try { workerData = JSON.parse(rawContent.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim()); } catch (e) { }
                                                                    }

                                                                    if (workerData?.grounding_report) {
                                                                        const gr = workerData.grounding_report;
                                                                        md += `## Grounding & Verification\n\n`;
                                                                        md += `* **Fabrication Check:** ${gr.fabrication_check || 'UNKNOWN'}\n`;
                                                                        md += `* **Knowledge Density:** ${gr.kb_chunks_cited || workerData._grounding_meta?.kb_chunks_used || 0} Indexed Context Units\n`;
                                                                        md += `* **Web Intelligence:** ${workerData._grounding_meta?.web_results_used || gr.web_sources_cited || 0} Web Sources\n\n`;
                                                                    }

                                                                    md += `## Final Deliverable Content\n\n`;
                                                                    const formattedContent = formatOutputToMarkdown(rawContent);
                                                                    md += formattedContent ? formattedContent : "*No deliverable content was generated for this job.*";
                                                                    md += `\n\n`;

                                                                    if (workerData?.key_conclusions && Array.isArray(workerData.key_conclusions) && workerData.key_conclusions.length > 0) {
                                                                        md += `## Strategic Findings\n\n`;
                                                                        workerData.key_conclusions.forEach((c: any, i: number) => {
                                                                            const conclusion = c.conclusion || (typeof c === 'string' ? c : '');
                                                                            md += `### Finding ${i + 1}: ${conclusion}\n\n`;
                                                                            if (c.evidence) md += `* **Evidence:** ${c.evidence}\n`;
                                                                            if (c.recommendation) md += `* **Recommendation:** ${c.recommendation}\n`;
                                                                            md += `\n`;
                                                                        });
                                                                    }

                                                                    if (workerData?.source_references && Array.isArray(workerData.source_references) && workerData.source_references.length > 0) {
                                                                        md += `## Source Provenance\n\n`;
                                                                        workerData.source_references.forEach((ref: any) => {
                                                                            md += `* **[${ref.ref_id}] ${ref.title}** - ${ref.usage}\n`;
                                                                        });
                                                                        md += `\n`;
                                                                    }

                                                                    exportToPDF(md, `job-${job?.job_id || jobId}-full-report.pdf`);
                                                                }}
                                                                disabled={actionLoading || !['grading', 'graded', 'awaiting_approval', 'approved', 'completed'].includes(derivedStatus?.toLowerCase())}
                                                                className="px-8 py-4 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black uppercase tracking-[0.2em] text-xs hover:bg-cyan-500/20 hover:border-cyan-500 transition-all cursor-target flex items-center justify-center gap-3 group disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent shadow-[0_0_30px_rgba(6,182,212,0.1)] scifi-clip"
                                                                title="Save PDF"
                                                            >
                                                                <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                                                Save PDF Report
                                                            </button>
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
                                                                        isPass
                                                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                                                    )}>
                                                                        ↳ {isPass ? "APPROVE" : String(evaluationContent.recommendation)}
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
                                    <AgentLogPanel
                                        logs={agentLogs}
                                        loading={agentLogsLoading && agentLogs.length === 0}
                                        jobId={job?.job_id || jobId}
                                        envelopeId={envelopeId}
                                        agentId={envelope?.identity_context?.identity_fingerprint || job?.identity_fingerprint || job?.agent_id || job?.requested_agent_id}
                                    />
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
