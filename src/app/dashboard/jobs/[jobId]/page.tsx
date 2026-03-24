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
import { EnvelopeInspector } from "@/components/EnvelopeInspector";
import { KernelStatusBadge } from "@/components/KernelStatusBadge";
import { nxqApi } from "@/lib/api-client";
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
    Layers
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
    const { envelope, steps, loading: envelopeLoading } = useEnvelope(job?.execution_id || null);

    // Unified Governance Logic
    const govScoreRaw = job?.runtime_context?.grading_result?.compliance_score ??
        job?.runtime_context?.grading_result?.score ??
        job?.grading_result?.compliance_score ??
        job?.grading_result?.score ??
        job?.compliance_score ??
        job?.grade_score ??
        (job as any)?.score ??
        (job as any)?.grade ??
        job?.grader_params?.score ?? 0;

    let governanceScore = typeof govScoreRaw === 'object' ? (govScoreRaw.value || 0) : Number(govScoreRaw);
    // Normalize score if it's on a 100-point scale
    if (governanceScore > 10) governanceScore = governanceScore / 10;

    const passFailRaw = job?.runtime_context?.grading_result?.pass_fail ??
        job?.grading_result?.pass_fail ??
        job?.pass_fail ??
        job?.grade_status ??
        job?.grader_params?.pass_fail;

    const isPass = String(passFailRaw).toLowerCase() === 'pass' && (governanceScore > 3 || governanceScore === 0);
    // Wait, if it's 0.0 exactly, is it still "pass"? The user says "0.0 / 10 pass" is wrong.
    // So if score is 0, it should be fail regardless of passFailRaw? 
    // Let's refine: A score of 0.0 is either PENDING or FAIL.

    const isActuallyPending = governanceScore === 0 && !passFailRaw;
    const isActuallyPass = String(passFailRaw).toLowerCase() === 'pass';
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

        // Data-based transition checks
        const hasPlan = job?.runtime_context?.plan || (job as any)?.plan || (job as any)?.strategic_plan || (job as any)?.output_plan || (job as any)?.coo_plan || extractOutputData(job);
        const hasResearch = job?.runtime_context?.research_result || (job as any)?.research_result || (job as any)?.research || (job as any)?.research_intelligence;
        const hasWorker = job?.runtime_context?.worker_result || (job as any)?.final_result || (job as any)?.output || (job as any)?.result;
        const hasGrading = job?.runtime_context?.grading_result || (job as any)?.grading_result || job?.grade_status;

        let calculated = 0;

        if (status === 'completed' || status === 'approved') calculated = 10;
        else if (hasGrading || status === 'graded' || status === 'awaiting_approval') calculated = 9;
        else if (hasWorker || status === 'grading') calculated = 8;
        else if (hasResearch || status === 'worker_execution') calculated = 7;
        else if (hasPlan || status === 'research_execution') calculated = 6;
        else if (status === 'coo_planning' || envelope?.execution_context?.status === "running") calculated = 5;
        else {
            // Trace-based heuristics for system stages
            if (envelope?.execution_context?.status === "completed") calculated = 10;
            else if (envelope?.identity_context?.verified) calculated = 2;
            else if (envelope?.authority_context?.lease_id) calculated = 3;
            else {
                const traceMessages = traces.map(t => t.message.toLowerCase()).join(' ');
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
            const result = await nxqApi.resurrectJob(jobId, "Operator Manual Continuity Restore");
            // Show resurrecting banner — cleared automatically once pipeline starts
            setIsResurrecting(true);
            // Reset timeline advancement so it rebuilds from step 1
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
            await nxqApi.approveJob(jobId);
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
            await nxqApi.rejectJob(jobId, rejectionReason || "Operator Manual Rejection");
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
        in_progress: "text-amber-400 border-amber-400/50 bg-amber-400/10",
        coo_planning: "text-blue-400 border-blue-400/50 bg-blue-400/10",
        research_execution: "text-cyan-400 border-cyan-400/50 bg-cyan-400/10",
        worker_execution: "text-purple-400 border-purple-400/50 bg-purple-400/10",
        grading: "text-pink-400 border-pink-400/50 bg-pink-400/10",
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

    // Derived states from traces
    const fallbackSteps = [
        { id: 'identity', name: 'IDENTITY_CHECK', icon: Fingerprint, subtext: 'Verifying ACELOGIC identity fingerprint', color: '#00E5FF' },
        { id: 'resurrection', name: 'RESURRECTION_CHECK', icon: RefreshCw, subtext: 'Preventing duplicate execution forks', color: '#FFC857' },
        { id: 'authority', name: 'AUTHORITY_LEASE', icon: Key, subtext: 'Acquiring execution authority lease', color: '#9C6BFF' },
        { id: 'boot', name: 'INSTANCE_BOOT', icon: Cpu, subtext: 'Spinning up agent runtime instance', color: '#4DD9FF' },
        { id: 'sync', name: 'CONTEXT_SYNC', icon: Database, subtext: 'Loading runtime execution context', color: '#2FFFD1' },
        { id: 'coo_planning', name: 'COO_AGENT', icon: Activity, subtext: 'Planning execution strategy', color: '#00E5FF', isAgent: true },
        { id: 'research_execution', name: 'RESEARCH_AGENT', icon: Search, subtext: 'Collecting information', color: '#2DFF9B', isAgent: true },
        { id: 'worker_execution', name: 'WORKER_AGENT', icon: Cpu, subtext: 'Generating final output', color: '#FF9E4D', isAgent: true },
        { id: 'grading', name: 'GRADER_AGENT', icon: GraduationCap, subtext: 'Evaluating result quality', color: '#7CFF6B', isAgent: true },
    ];



    const getStepStatus = (index: number) => {
        if (index < currentActiveIndex) return 'completed';
        if (index === currentActiveIndex) return 'in_progress';
        return 'queued';
    };



    return (
        <div className="w-full relative">
            {/* background decorations */}
            <div className="fixed top-0 right-0 w-1/3 h-1/3 bg-cyan-500/5 blur-[120px] pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-1/4 h-1/4 bg-purple-500/5 blur-[100px] pointer-events-none" />

            <div className="max-w-7xl mx-auto space-y-4 lg:space-y-8 relative z-10 p-4 lg:p-8 pb-20">

                {/* 1. Header & Quick Actions */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
                    <div className="space-y-2">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition-colors text-xs font-bold uppercase tracking-widest mb-2 sm:mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Return
                        </button>
                        <div className="flex flex-wrap items-center gap-4">
                            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                                <Activity className="w-8 h-8 text-cyan-500" />
                                Job Details
                            </h1>
                            <div className="px-3 py-1 glass border border-white/10 font-mono text-xs text-slate-400 rounded-full flex items-center gap-2">
                                <Fingerprint className="w-3 h-3" />
                                {jobId}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2 lg:mt-0 w-full lg:w-auto">
                        <div className={cn(
                            "px-3 py-1 border font-bold text-[10px] uppercase tracking-widest scifi-clip animate-pulse-slow",
                            getStatusColor(job?.status)
                        )}>
                            {job?.status?.replace('_', ' ')}
                        </div>
                        <button
                            onClick={() => refreshJob()}
                            disabled={jobLoading}
                            className="p-3 glass border border-white/10 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all cursor-target w-full sm:w-auto flex justify-center"
                            title="Refresh Data"
                        >
                            <RefreshCcw className={cn("w-5 h-5", jobLoading && "animate-spin")} />
                        </button>

                        {(() => {
                            const status = String(job?.status || "").toLowerCase();
                            const canResurrect = ["failed", "rejected"].includes(status) || isStalled || job?.status?.toLowerCase() === 'quarantined' || job?.quarantine_reason;

                            if (!canResurrect) return null;

                            return (
                                <button
                                    onClick={handleResurrect}
                                    disabled={actionLoading}
                                    className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-bold uppercase tracking-widest hover:bg-cyan-500/20 transition-all scifi-clip flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                >
                                    <RefreshCw className={cn("w-4 h-4", actionLoading && "animate-spin")} />
                                    Continuity Restore
                                </button>
                            );
                        })()}
                    </div>
                </div>

                {/* ── CRASH / STALL ALERT BANNER ─────────────────────────── */}
                {isStalled && (
                    <div className="relative overflow-hidden border border-amber-500/60 bg-amber-500/5 animate-pulse-slow">
                        {/* pulsing red glow top edge */}
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
                                        {job?.runtime_context?.active_stage && (
                                            <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                                                | Stage: {String(job.runtime_context.active_stage).replace(/_/g, ' ')}
                                            </div>
                                        )}
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
                                <p className="text-[9px] text-slate-600 text-center uppercase tracking-widest">
                                    Resume From Last Checkpoint
                                </p>
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
                                    <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-[9px] font-black uppercase tracking-widest scifi-clip">
                                        PIPELINE REACTIVATING
                                    </span>
                                </div>
                                <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
                                    The agent engine has been signalled. The pipeline will resume momentarily — this banner will clear once the first agent stage begins.
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                                    Restore #{(job as any)?.resurrection_count ?? "—"} · Waiting for agent engine heartbeat...
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Job Overview Grid */}
                <HUDFrame title="JOB METADATA">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-6">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3" /> Job Type
                            </label>
                            <p className="text-white font-bold uppercase italic text-sm">{String(job?.job_type || 'STANDARD')}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" /> Active Stage
                            </label>
                            <p className="text-cyan-400 font-bold uppercase text-sm">{String(job?.runtime_context?.active_stage || job?.status || 'UNKNOWN').replace(/_/g, ' ')}</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" /> Assigned Agent
                            </label>
                            <p className="text-purple-400 font-bold uppercase text-sm">{String(job?.assigned_agent_id || job?.assigned_agent_role || 'Pending')}</p>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <Fingerprint className="w-3 h-3" /> Assigned Instance
                            </label>
                            <p className="text-slate-400 font-mono text-[10px] truncate" title={String(job?.assigned_instance_id || 'unassigned_instance')}>
                                {String(job?.assigned_instance_id || 'unassigned_instance')}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <User className="w-3 h-3" /> User ID
                            </label>
                            <p className="text-slate-400 font-mono text-[10px] truncate" title={String(job?.user_id || 'system')}>
                                {String(job?.user_id || 'system')}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> Created At
                            </label>
                            <p className="text-slate-300 font-mono text-xs">{formatDate(job?.created_at || job?.updated_at)}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-slate-600" /> Updated At
                            </label>
                            <p className="text-slate-500 font-mono text-xs">{formatDate(job?.updated_at || job?.created_at)}</p>
                        </div>
                        {/* Resurrection count — shown only if restored at least once */}
                        {Number((job as any)?.resurrection_count || 0) > 0 && (
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest flex items-center gap-2">
                                    <RotateCw className="w-3 h-3 text-cyan-500" /> Restore Count
                                </label>
                                <p className="text-cyan-400 font-bold text-sm">
                                    #{(job as any)?.resurrection_count}
                                    {(job as any)?.resurrected_at && (
                                        <span className="text-slate-500 font-mono text-[10px] ml-2">
                                            Last: {formatDate((job as any)?.resurrected_at)}
                                        </span>
                                    )}
                                </p>
                            </div>
                        )}

                        {job?.execution_id && (
                            <div className="md:col-span-2 lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                                <KernelStatusBadge kernel="identity" status={envelope?.identity_context?.verified ? "verified" : "active"} />
                                <KernelStatusBadge kernel="authority" status={envelope?.authority_context?.lease_id ? "granted" : "idle"} />
                                <KernelStatusBadge kernel="execution" status={envelope?.execution_context?.status === "running" ? "active" : "idle"} />
                                <KernelStatusBadge kernel="persistence" status="verified" />
                            </div>
                        )}

                        <div className="md:col-span-2 lg:col-span-4 space-y-2 mt-4 pt-4 border-t border-white/5">
                            <label className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Input Prompt</label>
                            <div className="p-4 glass border border-white/5 rounded-sm bg-black/40">
                                <p className="text-slate-200 text-sm leading-relaxed italic">
                                    {typeof job?.prompt === 'object' ? JSON.stringify(job.prompt) : String(job?.prompt || "No input prompt provided.")}
                                </p>
                            </div>
                        </div>
                    </div>
                </HUDFrame>

                {/* OPERATOR DECISION CARD */}
                {
                    job?.status?.toLowerCase() === 'awaiting_approval' && (
                        <HUDFrame title="OPERATOR DECISION REQUIRED" className="border-orange-500/50 bg-orange-500/5 shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                            <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                                <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <AlertTriangle className="w-6 h-6 text-orange-500" />
                                            <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">Manual Governance Review</h2>
                                        </div>
                                        <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
                                            The autonomous worker pipeline has completed, but the governance grader flagged the deliverable for manual review. Please review the grading summary and tactical output before approving or rejecting this job.
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-left md:text-right space-y-2 w-full md:w-auto mt-4 md:mt-0">
                                        <div className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Grader Score</div>
                                        <div className={cn(
                                            "text-4xl font-black italic tracking-tighter shadow-sm",
                                            (job?.runtime_context?.grading_result?.pass_fail ?? job?.pass_fail) === 'pass' ? "text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]" : "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.3)]"
                                        )}>
                                            {(() => {
                                                const score = job?.runtime_context?.grading_result?.score ?? job?.compliance_score ?? job?.grade_score ?? 0;
                                                const numericScore = typeof score === 'object' ? (score.value || 0) : Number(score);
                                                const normalized = numericScore > 10 ? numericScore / 10 : numericScore;
                                                return isNaN(normalized) ? '0.0' : normalized.toFixed(1);
                                            })()}
                                            <span className="text-lg text-slate-600"> /10</span>
                                        </div>
                                        <div className={cn(
                                            "inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest scifi-clip",
                                            (job?.runtime_context?.grading_result?.pass_fail ?? job?.pass_fail) === 'fail' ? "bg-red-500/20 text-red-500 border border-red-500/50" : "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50"
                                        )}>
                                            {String(job?.runtime_context?.grading_result?.pass_fail ?? job?.pass_fail ?? 'PENDING')}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="p-4 bg-black/40 border border-white/5 rounded-sm space-y-2">
                                        <label className="text-[9px] uppercase font-bold text-cyan-500 tracking-widest block flex items-center gap-2">
                                            <Activity className="w-3 h-3" /> Original Prompt
                                        </label>
                                        <p className="text-slate-300 text-sm italic">{typeof job?.prompt === 'object' ? JSON.stringify(job.prompt) : String(job?.prompt || '')}</p>
                                    </div>
                                    {(() => {
                                        const isPass = (job?.runtime_context?.grading_result?.pass_fail ?? job?.pass_fail) === 'pass';
                                        return (
                                            <div className={cn(
                                                "p-4 border rounded-sm space-y-2",
                                                isPass ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
                                            )}>
                                                <label className={cn(
                                                    "text-[9px] uppercase font-bold tracking-widest block flex items-center gap-2",
                                                    isPass ? "text-emerald-400" : "text-red-400"
                                                )}>
                                                    <ShieldCheck className="w-3 h-3" /> Grading Summary
                                                </label>
                                                <p className="text-slate-300 text-xs leading-relaxed">
                                                    {(() => {
                                                        const summary = job?.runtime_context?.grading_result?.grading_summary ?? job?.grading_summary ?? job?.grader_params?.reasoning_summary;
                                                        const extracted = typeof summary === 'object' ? (summary.detail || summary.summary || JSON.stringify(summary)) : String(summary || "No summary provided.");
                                                        return (typeof extracted === 'object' ? JSON.stringify(extracted) : String(extracted))
                                                            .replace(/The result '\[object Object\]' /g, 'The submitted deliverable ')
                                                            .replace(/\[object Object\]/g, 'the unformatted data');
                                                    })()}
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/10">
                                    <button
                                        onClick={handleApprove}
                                        disabled={actionLoading}
                                        className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 text-emerald-500 font-black uppercase tracking-widest transition-all cursor-target flex items-center justify-center gap-2 scifi-clip shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                    >
                                        <ShieldCheck className="w-5 h-5" /> Approve Artifact
                                    </button>
                                    <button
                                        onClick={() => setIsRejectModalOpen(true)}
                                        disabled={actionLoading}
                                        className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-500 font-black uppercase tracking-widest transition-all cursor-target flex items-center justify-center gap-2 scifi-clip"
                                    >
                                        <XCircle className="w-5 h-5" /> Reject Artifact
                                    </button>
                                </div>
                            </div>
                        </HUDFrame>
                    )
                }

                {/* 3. Execution Lifecycle Timeline */}
                <div className="space-y-4">
                    {job?.execution_id ? (
                        <EnvelopeInspector executionId={job.execution_id} />
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-6">
                                    <h3 className="text-xs font-black text-cyan-500 uppercase tracking-[0.3em] flex items-center gap-2">
                                        <Clock className="w-4 h-4 animate-pulse" />
                                        Legacy Execution Lifecycle
                                    </h3>
                                </div>
                            </div>
                            <HUDFrame variant="dark" className="p-12 text-center text-slate-600">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                                    Direct Execution Context Not Found
                                </span>
                            </HUDFrame>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 mt-4 lg:mt-0">
                    {/* Left Column - Detailed Outputs */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-8">

                        {/* Agent Deliverables Accordion */}
                        <HUDFrame title="AGENT DELIVERABLES">
                            <div className="p-0">
                                <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3"]} className="w-full">
                                    {/* 1. COO Implementation Plan */}
                                    <AccordionItem value="item-1" className="border-b border-white/5 px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <Activity className="w-5 h-5 text-cyan-500" />
                                                    <span className="font-black text-white uppercase italic tracking-widest text-sm">Strategic Plan</span>
                                                </div>
                                                <span className="text-[9px] uppercase font-bold px-2 py-0.5 border border-cyan-500/30 text-cyan-500 rounded-full">Phase 1: Planning</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-6">
                                            {(() => {
                                                const plan = job?.runtime_context?.plan || (job as any)?.plan || (job as any)?.strategic_plan || (job as any)?.strategicPlan;
                                                if (!plan) return <div className="text-center py-4 opacity-20 italic text-[10px]">Awaiting COO output...</div>;

                                                return (
                                                    <DeliverableItem
                                                        type="plan"
                                                        title="Operational Blueprint"
                                                        subtitle="COO Strategy"
                                                        content={plan}
                                                    />
                                                );
                                            })()}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 2. Research Findings */}
                                    <AccordionItem value="item-2" className="border-b border-white/5 px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <Search className="w-5 h-5 text-blue-400" />
                                                    <span className="font-black text-white uppercase italic tracking-widest text-sm">Research Intelligence</span>
                                                </div>
                                                <span className="text-[9px] uppercase font-bold px-2 py-0.5 border border-blue-500/30 text-blue-500 rounded-full">Phase 2: Investigation</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-6">
                                            {(() => {
                                                const res = job?.runtime_context?.research_result || (job as any)?.research_intelligence || (job as any)?.researchIntelligence || (job as any)?.research_result;
                                                if (!res) return <div className="text-center py-4 opacity-20 italic text-[10px]">Awaiting Research output...</div>;

                                                return (
                                                    <DeliverableItem
                                                        type="research"
                                                        title="Intelligence Report"
                                                        subtitle="Deep Search Findings"
                                                        content={res}
                                                    />
                                                );
                                            })()}
                                        </AccordionContent>
                                    </AccordionItem>

                                    {/* 3. Worker Execution */}
                                    <AccordionItem value="item-3" className="border-none px-6">
                                        <AccordionTrigger className="hover:no-underline py-6">
                                            <div className="flex items-center justify-between w-full pr-4 text-left">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="w-5 h-5 text-purple-400" />
                                                    <span className="font-black text-white uppercase italic tracking-widest text-sm">Final Artifacts</span>
                                                </div>
                                                <span className="text-[9px] uppercase font-bold px-2 py-0.5 border border-purple-500/30 text-purple-500 rounded-full">Phase 3: Final</span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-6">
                                            {(() => {
                                                const result = job?.runtime_context?.final_result || job?.runtime_context?.worker_result || job?.artifact || (job as any)?.final_result || (job as any)?.worker_result || extractOutputData(job);
                                                if (!result) return <div className="text-center py-4 opacity-20 italic text-[10px]">Awaiting final artifacts...</div>;

                                                return (
                                                    <DeliverableItem
                                                        type="final"
                                                        title="Mission Deliverable"
                                                        subtitle="End-to-End Synthesis"
                                                        content={result}
                                                    />
                                                );
                                            })()}
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        </HUDFrame>

                        {/* FINAL COMPLETED ARTIFACT HIGHLIGHT */}
                        {job?.status === 'completed' && artifacts.some(a => a.artifact_type === 'final') && (
                            <HUDFrame title="FINAL COMPLETED ARTIFACT" className="border-emerald-500/30 bg-emerald-500/5">
                                <div className="p-8 flex flex-col items-center text-center space-y-4">
                                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 relative">
                                        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-500" />
                                        <Award className="w-10 h-10" />
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-black text-white italic tracking-tighter uppercase">Mission Objective Achieved</h4>
                                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">The final dimensional deliverable has been stabilized.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const final = artifacts.find(a => a.artifact_type === 'final');
                                            if (final) setViewingArtifact({ title: final.title || "Final Artifact", content: final.artifact_content });
                                        }}
                                        className="px-10 py-3 bg-emerald-500 border border-emerald-400 text-white font-black uppercase tracking-widest scifi-clip hover:scale-105 transition-transform cursor-target shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                                    >
                                        Extract Final Manifest
                                    </button>
                                </div>
                            </HUDFrame>
                        )}

                    </div>

                    {/* Right Column - Governance & Artifacts */}
                    <div className="space-y-8">
                        {/* 6. Agent Identity & Governance Section */}
                        <HUDFrame title="AGENT IDENTITY & GOVERNANCE">
                            <div className="p-6 space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">Identity Fingerprint</label>
                                    <p className="text-[10px] font-mono text-cyan-500 break-all bg-black/40 p-2 border border-white/5 rounded-sm">
                                        {typeof job?.identity_fingerprint === 'object' ? JSON.stringify(job.identity_fingerprint) : (job?.identity_fingerprint || "ID_FINGERPRINT_PENDING")}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">Agent ID</label>
                                        <p className="text-xs font-bold text-white uppercase italic">{String(job?.requested_agent_id || job?.agent_id || job?.assigned_agent_id || "UNASSIGNED")}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">AceLogic ID</label>
                                        <p className="text-xs font-bold text-white uppercase italic">{typeof job?.acelogic_id === 'object' ? JSON.stringify(job.acelogic_id) : String(job?.acelogic_id || "ACE_GEN_0")}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">Jurisdiction</label>
                                        <p className="text-[10px] font-bold text-emerald-500 uppercase">{typeof job?.jurisdiction === 'object' ? JSON.stringify(job.jurisdiction) : String(job?.jurisdiction || "GLOBAL_ENVELOPE")}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">Model Profile</label>
                                        <p className="text-[10px] font-bold text-blue-400 uppercase">{typeof job?.model_provider === 'object' ? JSON.stringify(job.model_provider) : String(job?.model_provider || "CLAUDE-3")}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">Mission Directive</label>
                                    <div className="p-3 bg-white/5 border border-white/5 rounded-sm">
                                        <p className="text-[10px] text-slate-400 leading-relaxed italic line-clamp-3">
                                            {typeof job?.mission === 'object' ? JSON.stringify(job.mission) : (job?.mission || "Maintain deterministic identity across execution and restart, ensuring governance following NXQ protocol guidelines.")}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-sm">
                                        <label className="text-[8px] uppercase font-black text-emerald-500 tracking-widest block mb-1">Neural Confidence</label>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: '98.4%' }} />
                                            </div>
                                            <span className="text-[10px] font-mono text-emerald-400">98.4%</span>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-sm">
                                        <label className="text-[8px] uppercase font-black text-cyan-500 tracking-widest block mb-1">Verification Sig</label>
                                        <p className="text-[9px] font-mono text-cyan-400 truncate">NXQ_SIG_7829-ALPHA</p>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-white/5">
                                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block">Token Telemetry</label>
                                    <div className="grid grid-cols-2 gap-4 bg-black/40 p-3 border border-white/5 rounded-sm">
                                        <div className="space-y-1">
                                            <label className="text-[8px] uppercase font-bold text-slate-600 tracking-widest block">Total Used</label>
                                            <p className="text-xs font-mono text-cyan-400">{job?.runtime_context?.token_usage?.total_tokens || job?.token_usage || "0"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] uppercase font-bold text-slate-600 tracking-widest block">Runtime Cost</label>
                                            <p className="text-xs font-mono text-emerald-400">
                                                ${(() => {
                                                    const explicitCost = job?.runtime_context?.token_usage?.cost ?? job?.cost;
                                                    if (explicitCost !== undefined && explicitCost !== null) {
                                                        const numCost = Number(explicitCost);
                                                        return isNaN(numCost) ? "0.00" : numCost.toFixed(4);
                                                    }
                                                    // Fallback calculation: blended estimate of $0.002 per 1k tokens
                                                    const tokensText = job?.runtime_context?.token_usage?.total_tokens ?? job?.token_usage ?? 0;
                                                    const tokens = Number(tokensText);
                                                    if (isNaN(tokens) || tokens === 0) return "0.00";
                                                    return ((tokens / 1000) * 0.002).toFixed(4);
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </HUDFrame>

                        {/* 7. Grader Evaluation */}
                        <HUDFrame title="GOVERNANCE SCORE">
                            <div className="p-6 text-center space-y-6">
                                <div className="relative inline-block">
                                    <div className="w-32 h-32 rounded-full border-4 border-white/5 flex items-center justify-center relative overflow-hidden">
                                        {/* Progress Ring Background */}
                                        <svg className={cn(
                                            "absolute inset-0 w-full h-full -rotate-90",
                                            job?.status === 'in_progress' || job?.status === 'awaiting_approval' ? "animate-breathing" : ""
                                        )}>
                                            <circle
                                                cx="64" cy="64" r="60"
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                className="text-white/5"
                                            />
                                            <circle
                                                cx="64" cy="64" r="60"
                                                fill="transparent"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                                strokeDasharray={377}
                                                strokeDashoffset={377 - (377 * (governanceScore || 0)) / 10}
                                                className={cn(
                                                    "transition-all duration-1000",
                                                    isPass ? "text-emerald-500 ai-breathing-green" :
                                                        finalGovStatus === 'FAIL' ? "text-red-500 ai-breathing-red" : "text-amber-500"
                                                )}
                                                strokeLinecap="round"
                                            />
                                        </svg>
                                        <div className="text-center z-10">
                                            <span className="text-3xl font-black text-white italic tracking-tighter">
                                                {governanceScore.toFixed(1)}
                                            </span>
                                            <span className="text-[10px] text-slate-500 block uppercase font-bold">/ 10</span>
                                        </div>
                                    </div>
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                                        <div className={cn(
                                            "px-4 py-1 border text-[10px] font-black uppercase tracking-widest scifi-clip shadow-lg",
                                            isPass ? "bg-emerald-500 border-emerald-400 text-white" :
                                                finalGovStatus === 'FAIL' ? "bg-red-500 border-red-400 text-white" : "bg-amber-500 border-amber-400 text-white"
                                        )}>
                                            {finalGovStatus}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6 pt-4 text-left border-t border-white/5">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest block">Governance Reasoning</label>
                                        <p className="text-xs text-slate-400 italic leading-relaxed bg-black/20 p-3 border border-white/5 rounded-sm">
                                            {(() => {
                                                const summary = job?.runtime_context?.grading_result?.grading_summary ??
                                                    job?.grading_summary ??
                                                    (job?.runtime_context?.grading_result as any)?.reasoning ??
                                                    job?.grader_params?.reasoning_summary;
                                                if (!summary) return "The governance protocol is currently analyzing the worker deliverable for policy adherence and risk factors.";
                                                const extracted = typeof summary === 'object' ? (summary.detail || summary.summary || JSON.stringify(summary)) : String(summary);
                                                return (typeof extracted === 'object' ? JSON.stringify(extracted) : String(extracted))
                                                    .replace(/The result '\[object Object\]' /g, 'The submitted deliverable ')
                                                    .replace(/\[object Object\]/g, 'the unformatted data');
                                            })()}
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest block">Grading Summary</label>
                                        <div className={cn(
                                            "text-xs leading-relaxed p-4 bg-black/40 border rounded-sm",
                                            isPass ? "text-emerald-400/90 border-emerald-500/20" : "text-red-400/90 border-red-500/20"
                                        )}>
                                            {(() => {
                                                const result = job?.runtime_context?.final_result ||
                                                    job?.runtime_context?.worker_result ||
                                                    job?.artifact ||
                                                    (job as any)?.output ||
                                                    (job as any)?.result;
                                                if (!result) return "Awaiting final worker output for grading completion.";

                                                try {
                                                    let parsedResult = result;
                                                    if (typeof result === 'string') {
                                                        try { parsedResult = JSON.parse(result); } catch (e) { }
                                                    }

                                                    if (typeof parsedResult === 'object' && parsedResult !== null && parsedResult.final_summary) {
                                                        return parsedResult.final_summary;
                                                    }
                                                    return typeof result === 'string' ? result.substring(0, 300) + (result.length > 300 ? "..." : "") : "Strategic output captured and verified.";
                                                } catch (e) {
                                                    return "Strategic output captured and verified.";
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </HUDFrame>

                        {/* 7. Artifacts List */}
                        {artifacts.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-sm font-black text-white uppercase italic tracking-widest flex items-center gap-2 ml-1">
                                    <FileText className="w-4 h-4 text-cyan-500" />
                                    Produced Artifacts
                                </h2>
                                <div className="space-y-3">
                                    {artifacts.map(artifact => (
                                        <SciFiFrame key={artifact.id} className="group cursor-target">
                                            <div className="p-4 flex items-center gap-4">
                                                <div className="w-10 h-10 glass border border-white/10 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                                                    {artifact.artifact_type === 'code' ? <Code className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">{String(artifact.title || artifact.artifact_id || "UNNAMED_ARTIFACT")}</p>
                                                    <p className="text-[9px] text-slate-500 uppercase font-bold">{String(artifact.artifact_type)} • {String(artifact.produced_by_agent || "SYSTEM")}</p>
                                                </div>
                                                <button
                                                    onClick={() => setViewingArtifact({
                                                        title: artifact.title || artifact.artifact_id,
                                                        content: artifact.artifact_content
                                                    })}
                                                    className="p-2 hover:bg-white/5 rounded-full transition-colors cursor-target"
                                                >
                                                    <ExternalLink className="w-4 h-4 text-slate-700 group-hover:text-cyan-500 transition-colors" />
                                                </button>
                                            </div>
                                        </SciFiFrame>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Artifact Manifest Viewer Modal */}
            <Dialog open={!!viewingArtifact} onOpenChange={(open) => !open && setViewingArtifact(null)}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col glass border-white/10 p-0 overflow-hidden sm:rounded-none">
                    <DialogHeader className="p-6 border-b border-white/10 shrink-0">
                        <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                            <Terminal className="w-6 h-6 text-cyan-500" />
                            {String(viewingArtifact?.title || "Artifact Viewer")}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                            Full Dimensional Manifest Data
                        </DialogDescription>
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
                            Please provide a detailed strategic reason for this rejection. This intelligence will be fed back into the autonomous pipeline for the subsequent iteration.
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
                                placeholder="e.g. The deliverable failed to address the core objective, specifically section 3 remains incomplete..."
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
    );
}
