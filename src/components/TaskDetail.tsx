import React, { useState, useEffect } from "react";
import {
    X,
    Cpu,
    ShieldCheck,
    RotateCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    RefreshCw,
    ShieldAlert,
    BoxSelect,
    Network,
    Layers,
    Fingerprint as FingerprintIcon,
    ShieldCheck as ShieldCheckIcon,
    Download,
    Settings as SettingsIcon,
    Zap,
    AlertTriangle,
    ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { HUDFrame } from "./HUDFrame";
import { MarkdownReport } from "./MarkdownReport";
import { KernelStatusBadge } from "./KernelStatusBadge";
import { StepGraph } from "./StepGraph";
import { EnvelopeInspector } from "./EnvelopeInspector";
import { Job, useJob, useForkProtection, useJobArtifacts } from "@/hooks/useJobs";
import { useEnvelope } from "@/hooks/useEnvelope";
import { useJobActions } from "@/hooks/useJobActions";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { exportToPDF } from "@/lib/pdf-export";

interface TaskDetailProps {
    job: Job;
    userId: string | undefined;
    onClose: () => void;
    onUpdate?: (job: Job) => void;
}

export function TaskDetail({ job: initialJob, userId, onClose, onUpdate }: TaskDetailProps) {
    const { job, refreshing, refresh, isStalled } = useJob(initialJob.job_id, userId, onUpdate);
    const { envelope, steps } = useEnvelope(job?.execution_id || job?.envelope_id || null);
    const displayJob = job || initialJob;
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"execution" | "grading" | "governance" | "resurrection" | "nexus">("execution");
    const { approveJob, rejectJob, resurrectJob, simulateFork, isProcessing, error, clearError } = useJobActions();
    const { artifacts } = useJobArtifacts(displayJob.job_id);
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [resurrectReason, setResurrectReason] = useState("");
    const [showResurrectInput, setShowResurrectInput] = useState(false);
    const [collectionsStatus, setCollectionsStatus] = useState<Record<string, any>>({});

    // Fork Protection logic
    const { attemptsCount, latestEvent, loading: forkLoading } = useForkProtection(displayJob.job_id);

    const handleSimulateFork = async () => {
        if (isProcessing) return;
        try {
            console.log("[FORK] Triggering simulation for:", displayJob.job_id);

            await simulateFork({
                job_id: displayJob.job_id,
                identity_id: displayJob.identity_id || "ID-UNKNOWN",
                attempted_by: "operator_simulation",
                reason: "Manual fork protection verification"
            });
        } catch (e: unknown) {
            console.error("Fork simulation failed:", e);
            // Revert state on actual error if needed, though refresh will handle it
            refresh();
        }
    };

    // Clear any previous action errors when switching tabs
    useEffect(() => {
        clearError();
    }, [activeTab, clearError]);

    const handleApprove = async () => {
        try {
            await approveJob(displayJob.job_id, () => {
                refresh();
            });
        } catch {
            refresh();
        }
    };

    const handleReject = async () => {
        if (!rejectReason) {
            alert("Please provide a reason for rejection.");
            return;
        }
        try {
            await rejectJob(displayJob.job_id, rejectReason, () => {
                setShowRejectInput(false);
                setRejectReason("");
                refresh();
            });
        } catch {
            refresh();
        }
    };

    const handleResurrect = async () => {
        if (!resurrectReason) {
            return;
        }
        try {
            await resurrectJob(displayJob.job_id, resurrectReason, () => {
                setShowResurrectInput(false);
                setResurrectReason("");
                refresh();
            });
        } catch {
            refresh();
        }
    };

    // Subscribe to knowledge collections status
    useEffect(() => {
        const collectionIds = envelope?.knowledge_context?.collections || [];
        const userId = envelope?.user_id || auth.currentUser?.uid;
        if (collectionIds.length === 0 || !userId) return;

        const unsubs = collectionIds.map(cid => {
            // Updated path based on upload API structure
            const docRef = doc(db, "user_knowledge_collections", userId, "collections", cid);
            return onSnapshot(docRef, (snap) => {
                if (snap.exists()) {
                    setCollectionsStatus(prev => ({ ...prev, [cid]: { id: cid, ...snap.data() } }));
                }
            });
        });

        return () => unsubs.forEach(u => u());
    }, [envelope?.knowledge_context?.collections, envelope?.user_id]);

    const statusColors: Record<string, string> = {
        created: "text-blue-400 border-blue-400/30 bg-blue-400/5",
        queued: "text-blue-400 border-blue-400/30 bg-blue-400/5",
        assigned: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
        in_progress: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
        completed: "text-purple-400 border-purple-400/30 bg-purple-400/5",
        graded: "text-orange-400 border-orange-400/30 bg-orange-400/5",
        fallback_pending: "text-rose-500 border-rose-500/30 bg-rose-500/5",
        approved: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
        rejected: "text-rose-400 border-rose-400/30 bg-rose-400/5",
        failed: "text-rose-400 border-rose-400/30 bg-rose-400/5",
        resurrected: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5",
        awaiting_approval: "text-amber-400 border-amber-400/30 bg-amber-400/5",
        quarantined: "text-orange-500 border-orange-500/30 bg-orange-500/5",
    };

    const getGraderData = () => {
        // Preference for structured fields within runtime_context
        let rcGrader = displayJob.runtime_context?.grading_result;
        if (typeof rcGrader === 'string') {
            try { rcGrader = JSON.parse(rcGrader); } catch { /* keep as string */ }
        }
        if (rcGrader || displayJob.grading_summary || displayJob.compliance_score !== undefined) {
            let flags: string[] = [];
            if (rcGrader?.risk_flags) {
                const flagsIn = Array.isArray(rcGrader.risk_flags) ? rcGrader.risk_flags : String(rcGrader.risk_flags).split(",");
                flags = flagsIn.map((f: unknown) => {
                    const extracted = typeof f === 'object' ? (f as any).detail || (f as any).id || JSON.stringify(f) : String(f);
                    return typeof extracted === 'object' ? JSON.stringify(extracted).trim() : String(extracted).trim();
                });
            } else if (displayJob.risk_flags) {
                flags = String(displayJob.risk_flags).split(",").map(f => String(f).trim());
            }

            const scoreRaw = rcGrader?.overall_score ??
                rcGrader?.compliance_score ??
                rcGrader?.score ??
                displayJob.grading_result?.compliance_score ??
                displayJob.grading_result?.score ??
                displayJob.compliance_score ??
                displayJob.grade_score ?? 0;

            let normalizedScore = typeof scoreRaw === 'object' ? (scoreRaw.value || 0) : Number(scoreRaw);
            if (normalizedScore > 10) normalizedScore = normalizedScore / 10;

            const pass_fail = rcGrader?.recommendation ?? rcGrader?.pass_fail ?? displayJob.grading_result?.pass_fail ?? displayJob.pass_fail;
            const isApprove = String(pass_fail).toLowerCase() === 'approve' || String(pass_fail).toLowerCase() === 'pass';
            const isTrulyPass = normalizedScore >= 7.5 || (isApprove && normalizedScore > 3);
            const finalPassFail = isTrulyPass ? "pass" : "fail";

            return {
                score: normalizedScore,
                pass_fail: finalPassFail as "pass" | "fail",
                risk_flags: flags,
                reasoning_summary: rcGrader?.reason || rcGrader?.reasoning || rcGrader?.feedback || rcGrader?.summary || rcGrader?.grading_summary || displayJob.grading_summary || displayJob.grading_result?.grading_summary || "No summary available."
            };
        }

        if (displayJob.grader_params) {
            const score = Number(displayJob.grader_params.score) || 0;
            const pass_fail = String(displayJob.grader_params.pass_fail).toLowerCase() === "pass" ? "pass" : "fail";
            const isTrulyPass = score >= 7.5 || (pass_fail === 'pass' && score > 3);

            return {
                score: score,
                pass_fail: isTrulyPass ? "pass" : "fail",
                risk_flags: (displayJob.grader_params.risk_flags || []).map((f: unknown) => {
                    const extracted = typeof f === 'object' ? (f as any).detail || (f as any).id || JSON.stringify(f) : String(f);
                    return typeof extracted === 'object' ? JSON.stringify(extracted).trim() : String(extracted).trim();
                }),
                reasoning_summary: typeof displayJob.grader_params.reasoning_summary === 'object'
                    ? JSON.stringify(displayJob.grader_params.reasoning_summary)
                    : String(displayJob.grader_params.reasoning_summary || "No summary available.")
            };
        }

        // Fallback to top-level fields
        if (displayJob.grade_score !== undefined || displayJob.pass_fail) {
            let reasoning = "N/A";
            let flags: string[] = [];

            // Try to extract more from output array
            if (displayJob.output && displayJob.output.length > 0) {
                const firstMsg = displayJob.output[0];
                if (firstMsg.content && firstMsg.content.length > 0) {
                    const textObj = firstMsg.content[0].text;
                    if (typeof textObj === 'object') {
                        reasoning = textObj.reason || textObj.reasoning || textObj.reasoning_summary || textObj.feedback || textObj.summary || reasoning;
                        if (typeof reasoning === 'object') reasoning = JSON.stringify(reasoning);
                        if (textObj.risk_flags) {
                            const rawFlags = Array.isArray(textObj.risk_flags) ? textObj.risk_flags : String(textObj.risk_flags).split(",");
                            flags = rawFlags.map((f: unknown) => String(f).trim()).filter((f: string) => f !== "" && f.toLowerCase() !== "none");
                        }
                    }
                }
            }

            // Map risk_flags if available at top level
            if (displayJob.risk_flags && flags.length === 0) {
                const rawFlags = Array.isArray(displayJob.risk_flags) ? displayJob.risk_flags : String(displayJob.risk_flags).split(",");
                flags = rawFlags.map((f: unknown) => String(f).trim()).filter((f: string) => f !== "" && f.toLowerCase() !== "none");
            }

            const scoreRaw = Number(displayJob.grade_score) || Number(displayJob.grading_result?.score) || 0;
            let score = typeof scoreRaw === 'object' ? ((scoreRaw as any).value || 0) : Number(scoreRaw);
            if (score > 10) score = score / 10;

            const pass_fail_raw = displayJob.pass_fail || displayJob.grading_result?.pass_fail;
            const isTrulyPass = score >= 7.5 || (String(pass_fail_raw).toLowerCase() === 'pass' && score > 3);

            return {
                score: score,
                pass_fail: (isTrulyPass ? "pass" : "fail") as "pass" | "fail",
                risk_flags: flags,
                reasoning_summary: reasoning || "No evaluation reason provided."
            };
        }
        return null;
    };

    const graderData = getGraderData();

    const formatOutputToMarkdown = (raw: any): string => {
        if (!raw) return "";
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            // Strip markdown code fences wrapping JSON
            const stripped = trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim();
            if ((stripped.startsWith('{') && stripped.endsWith('}')) || (stripped.startsWith('[') && stripped.endsWith(']'))) {
                try { return formatOutputToMarkdown(JSON.parse(stripped)); } catch { /* fall through */ }
            }
            return raw;
        }
        if (typeof raw !== 'object') return String(raw);

        let md = "";
        const summary = raw.deliverable_summary || raw.summary;
        if (summary) md += `# Executive Summary\n\n${summary}\n\n`;

        // executive_summary field (richer narrative)
        if (raw.executive_summary && raw.executive_summary !== summary) {
            md += `${raw.executive_summary}\n\n`;
        }

        // sections array
        const sections = raw.sections || (Array.isArray(raw.content) ? raw.content : raw.content?.sections);
        if (sections && Array.isArray(sections)) {
            md += sections.map((s: any) => {
                const title = s.title || s.header || "Section";
                const body = s.body || s.content || s.text || "";
                return `## ${title}\n\n${body}\n\n`;
            }).join("\n");
            return md;
        }

        // report-style structure
        if (raw.title || raw.findings) {
            if (raw.title) md = `# ${raw.title}\n\n` + md;
            if (raw.details) md += `${raw.details}\n\n`;
            const listItems = raw.findings || raw.steps || raw.items || raw.results;
            if (Array.isArray(listItems)) {
                if (raw.findings) md += `### Key Findings\n\n`;
                md += listItems.map((item: any) => {
                    if (typeof item === 'string') return `* ${item}`;
                    if (typeof item === 'object') {
                        const label = item.title || item.label || item.name;
                        const val = item.body || item.content || item.value || item.description;
                        if (label && val) return `* **${label}:** ${val}`;
                        return `* ${JSON.stringify(item)}`;
                    }
                    return `* ${String(item)}`;
                }).join("\n");
            }
            if (md) return md;
        }

        if (typeof raw.content === 'string') return raw.content;
        // Final fallback: pretty JSON inside code fence
        return "```json\n" + JSON.stringify(raw, null, 2) + "\n```";
    };



    const getArtifactContent = () => {
        // Priority for new runtime_context results
        if (displayJob.runtime_context?.final_result) {
            return formatOutputToMarkdown(displayJob.runtime_context.final_result);
        }
        if (displayJob.runtime_context?.worker_result) {
            return formatOutputToMarkdown(displayJob.runtime_context.worker_result);
        }
        if (displayJob.artifact) {
            return formatOutputToMarkdown(displayJob.artifact);
        }

        // check artifacts array for 'deliverable' or 'worker_result'
        if (artifacts && artifacts.length > 0) {
            const deliverable = artifacts.find(a => ['deliverable', 'artifact_produce', 'produce_artifact', 'report', 'final', 'worker_result', 'worker'].includes(a.artifact_type || ''));
            if (deliverable?.artifact_content) {
                return formatOutputToMarkdown(deliverable.artifact_content);
            }
        }

        // if artifact is missing, look into output
        if (displayJob.output && displayJob.output.length > 0) {
            const firstMsg = displayJob.output[0];
            if (firstMsg.content && firstMsg.content.length > 0) {
                const textObj = firstMsg.content[0].text;
                return formatOutputToMarkdown(textObj);
            }
        }
        return null;
    };

    const artifactContent = getArtifactContent();

    const getValidValue = (...values: any[]) => {
        for (const v of values) {
            if (v && typeof v === 'string' && v.toUpperCase() !== 'N/A' && v.toLowerCase() !== 'unknown') {
                return v;
            }
        }
        return null;
    };

    const resolvedProvider = getValidValue(displayJob.model_provider, displayJob.provider, (envelope as any)?.provider, (envelope as any)?.model_provider) || "Standby";
    const resolvedModel = getValidValue(displayJob.model_used, (displayJob as any).model, (envelope as any)?.model, (envelope as any)?.model_used) || "Pending...";


    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

            {/* Side Panel */}
            <div className="relative w-full max-w-2xl h-full bg-slate-950 border-l border-white/10 tech-grid scanline animate-in slide-in-from-right duration-500 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 border border-cyan-500/30 flex items-center justify-center scifi-clip bg-cyan-500/5">
                            <Cpu className="w-6 h-6 text-cyan-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Job Trace <span className="text-cyan-500">#{displayJob.job_id?.slice(-6) || "......"}</span></h2>
                                <button
                                    onClick={refresh}
                                    disabled={refreshing}
                                    className="p-1.5 hover:bg-white/5 rounded-full transition-all group"
                                    title="Refresh job details"
                                >
                                    <RefreshCw className={cn("w-3.5 h-3.5 text-cyan-500/50 group-hover:text-cyan-500 cursor-target", refreshing && "animate-spin")} />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className={cn("text-[8px] font-black uppercase tracking-[0.2em] border px-2 py-0.5", statusColors[envelope?.fallback_suggested ? 'fallback_pending' : displayJob.status] || "text-slate-400")}>
                                    {envelope?.fallback_suggested ? "FALLBACK PENDING" : (displayJob.status === "quarantined" ? (
                                        displayJob.reason?.toLowerCase().includes("lease") || displayJob.reason?.toLowerCase().includes("fork") || displayJob.block_reason?.toLowerCase().includes("fork")
                                            ? "BLOCKED (LEASE CONFLICT)"
                                            : "QUARANTINED (IDENTITY FAILURE)"
                                    ) : displayJob.status)}
                                </span>
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {displayJob.updated_at ? new Date(displayJob.updated_at).toLocaleString() : (displayJob.created_at ? new Date(displayJob.created_at).toLocaleString() : "Syncing...")}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors cursor-target">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-white/5 bg-black/20">
                    {[
                        { id: "execution", label: "Execution Trace", icon: Cpu },
                        { id: "nexus", label: "Nexus Intelligence", icon: Layers },
                        { id: "grading", label: "Analytical Grade", icon: ShieldCheckIcon },
                        { id: "governance", label: "Governance Control", icon: ShieldCheckIcon },
                        { id: "resurrection", label: "Continuity Restore", icon: RotateCw },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={cn(
                                "flex-1 py-4 flex flex-col items-center gap-1 transition-all relative group",
                                activeTab === tab.id ? "text-cyan-400 bg-cyan-500/5" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            <tab.icon className="w-4 h-4" />
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] cursor-target">{tab.label}</span>
                            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />}
                        </button>
                    ))}
                </div>

                {/* Global Error Banner (Actions) */}
                {error && (
                    <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/30 scifi-clip flex flex-col gap-2 animate-in slide-in-from-top-4 duration-300 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rotate-45 translate-x-16 -translate-y-16" />
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-rose-500 animate-pulse" />
                            <div className="flex-1">
                                <p className="text-[10px] text-rose-500 uppercase font-black tracking-[0.3em]">Critical Protocol Breach Detected</p>
                                <p className="text-[11px] text-rose-200/90 font-mono mt-1 leading-tight">{error}</p>
                            </div>
                            <button onClick={clearError} className="p-1 hover:bg-rose-500/10 rounded transition-colors self-start">
                                <X className="w-4 h-4 text-rose-500/50 hover:text-rose-500" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Integrity Breach / Execution Failed Banner (Job Reason) */}
                {(() => {
                    const failureReason = String(displayJob?.failure_reason || envelope?.failure_reason || "");
                    const isFailed = String(displayJob?.status || "").toLowerCase() === "failed" || envelope?.status === "failed";
                    const isMissingConfig = failureReason.includes("MISSING_INTELLIGENCE_CONFIG") || failureReason.includes("MISSING_API_KEY") || failureReason.includes("API key");

                    if (!isFailed || !failureReason) return null;

                    return (
                        <div className="mx-6 mt-4 p-4 border border-rose-500/30 bg-rose-500/10 space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
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
                                    className="w-full py-2 border border-rose-500/30 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all group cursor-target"
                                >
                                    Configure Intelligence Providers
                                    <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                        </div>
                    );
                })()}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
                    {activeTab === "execution" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <HUDFrame title="Initial Prompt" variant="glass">
                                <p className="text-sm font-medium text-slate-300 leading-relaxed italic border-l-2 border-cyan-500/50 pl-4 py-1">
                                    "{displayJob.prompt}"
                                </p>
                            </HUDFrame>

                            {/* Fallback Intervention Banner */}
                            {envelope?.fallback_suggested && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/30 scifi-clip flex flex-col gap-3 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rotate-45 translate-x-16 -translate-y-16" />
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 border border-rose-500/30 flex items-center justify-center scifi-clip bg-rose-500/5 shrink-0">
                                            <AlertTriangle className="w-6 h-6 text-rose-500 animate-pulse" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Intervention Required</h3>
                                            <p className="text-[10px] text-rose-400 font-black uppercase tracking-[0.2em] mt-0.5">Agent Engine Fallback Protocol Triggered</p>
                                        </div>
                                    </div>

                                    <div className="bg-black/40 border border-rose-500/20 p-3 scifi-clip-sm">
                                        <p className="text-[10px] text-rose-200/90 leading-relaxed font-mono">
                                            <span className="text-rose-500 font-black mr-2">CAUSE:</span>
                                            BYO-LLM configuration missing for organization: The provider &apos;{(envelope?.fallback_metadata as any)?.failed_provider || 'anthropic'}&apos; is not enabled for your environment.
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-3 mt-1">
                                        <button
                                            onClick={() => router.push('/system-config')}
                                            className="w-full sm:w-auto px-4 py-2 bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 transition-all text-rose-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-target"
                                        >
                                            <SettingsIcon className="w-3.5 h-3.5" />
                                            Configure API Keys
                                        </button>
                                        <div className="flex-1 flex items-center gap-2 px-2">
                                            <div className="w-1.5 h-1.5 bg-rose-500 animate-ping rounded-full" />
                                            <span className="text-[8px] text-rose-400/60 uppercase font-black tracking-widest">Awaiting Manual Configuration</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Phase 2 Envelope Inspector */}
                            {(displayJob.execution_id || displayJob.envelope_id) && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                                    <EnvelopeInspector
                                        executionId={displayJob.execution_id || displayJob.envelope_id!}
                                    />
                                </div>
                            )}

                            {(displayJob.runtime_context?.plan || displayJob.runtime_context?.research_result || displayJob.runtime_context?.worker_result) && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-[1px] flex-1 bg-white/10" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-cyan-500/50">Execution Insights</span>
                                        <div className="h-[1px] flex-1 bg-white/10" />
                                    </div>

                                    {displayJob.runtime_context?.plan && (
                                        <HUDFrame title="Strategic Plan" variant="dark">
                                            <div className="p-1">
                                                <p className="text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                                                    {typeof displayJob.runtime_context.plan === 'object'
                                                        ? JSON.stringify(displayJob.runtime_context.plan, null, 2)
                                                        : displayJob.runtime_context.plan}
                                                </p>
                                            </div>
                                        </HUDFrame>
                                    )}

                                    {displayJob.runtime_context?.research_result && (
                                        <HUDFrame title="Intelligence Report" variant="dark">
                                            <div className="p-1">
                                                <p className="text-[11px] text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                                                    {typeof displayJob.runtime_context.research_result === 'object'
                                                        ? JSON.stringify(displayJob.runtime_context.research_result, null, 2)
                                                        : displayJob.runtime_context.research_result}
                                                </p>
                                            </div>
                                        </HUDFrame>
                                    )}

                                    {displayJob.runtime_context?.worker_result && (
                                        <HUDFrame title="Operational Output" variant="dark">
                                            <div className="p-1">
                                                <p className="text-[11px] text-emerald-400/90 leading-relaxed font-mono whitespace-pre-wrap">
                                                    {typeof displayJob.runtime_context.worker_result === 'object'
                                                        ? JSON.stringify(displayJob.runtime_context.worker_result, null, 2)
                                                        : displayJob.runtime_context.worker_result}
                                                </p>
                                            </div>
                                        </HUDFrame>
                                    )}
                                </div>
                            )}

                            <HUDFrame title="Metadata Matrix" variant="dark">
                                <div className="grid grid-cols-2 gap-4 py-2">
                                    <div className="space-y-1">
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Node Operator</p>
                                        <p className="text-xs font-bold text-white uppercase">{String(displayJob.agent_role || displayJob.job_type || "Pending...")}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Neural Provider</p>
                                        <p className="text-xs font-bold text-cyan-500 uppercase">{String(resolvedProvider)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Compute Model</p>
                                        <p className="text-xs font-mono text-slate-400 truncate">{String(resolvedModel)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Compute Cost</p>
                                        <p className="text-xs font-mono text-emerald-500">${Number((typeof displayJob.token_usage === 'object' ? displayJob.token_usage?.cost : null) ?? displayJob.cost ?? 0).toFixed(6)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Token Usage</p>
                                        <p className="text-xs font-mono text-slate-400">{Number(typeof displayJob.token_usage === 'object' ? displayJob.token_usage?.total_tokens ?? 0 : displayJob.token_usage ?? 0).toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Dimensional ID</p>
                                        <p className="text-xs font-mono text-slate-400 truncate">{String(displayJob.job_id)}</p>
                                    </div>
                                </div>
                            </HUDFrame>

                            <HUDFrame title="Fork Protection (SIMULATOR)" variant="glass">
                                <div className="space-y-4 py-2">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[8px] uppercase font-black tracking-widest text-slate-500 flex items-center gap-1">
                                                <FingerprintIcon className="w-2 h-2" /> Agent Fingerprint
                                            </p>
                                            <p className="text-xs font-mono text-purple-400 font-bold">{(() => { const raw = displayJob.identity_fingerprint || displayJob.identity_id; if (!raw) return "PENDING_REGISTRATION"; return "0x" + String(raw).replace(/^hex:0x|^0x|^hex:/i, ''); })()}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] uppercase font-black tracking-widest text-slate-500 flex items-center gap-1">
                                                <BoxSelect className="w-2 h-2" /> Canonical ID
                                            </p>
                                            <p className="text-xs font-mono text-white truncate">{typeof displayJob.canonical_job_id === 'object' ? JSON.stringify(displayJob.canonical_job_id) : String(displayJob.canonical_job_id || "ORIGIN")}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between p-3 bg-white/5 border border-white/5 scifi-clip">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 h-8 flex items-center justify-center scifi-clip bg-black/40 border",
                                                (attemptsCount > 0 || displayJob.event_id || displayJob.fork_attempted) ? "border-rose-500/50 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" : "border-emerald-500/30 text-emerald-500"
                                            )}>
                                                <ShieldAlert className={cn("w-4 h-4", (attemptsCount > 0 || displayJob.event_id || displayJob.fork_attempted) && "animate-pulse")} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase text-white leading-none">Fork Attempts (SIMULATED)</p>
                                                <p className="text-[8px] uppercase font-bold text-slate-500 mt-1">
                                                    {(attemptsCount > 0 || displayJob.event_id || displayJob.fork_attempted) ? `${Math.max(attemptsCount, displayJob.event_id ? 1 : 0, displayJob.fork_attempted ? 1 : 0)} Detection Event${Math.max(attemptsCount, displayJob.event_id ? 1 : 0, displayJob.fork_attempted ? 1 : 0) > 1 ? 's' : ''}` : "Clean Lineage Verified"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-xl font-black italic tracking-tighter text-white tabular-nums">
                                            {Math.max(attemptsCount, displayJob.event_id ? 1 : 0, displayJob.fork_attempted ? 1 : 0)}
                                        </div>
                                    </div>

                                    {(latestEvent || displayJob.event_id || displayJob.fork_last_at) && (
                                        <div className="space-y-3 p-3 bg-rose-500/5 border border-rose-500/20 scifi-clip animate-in fade-in duration-500">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-[8px] uppercase font-black tracking-widest text-rose-500 leading-none">Latest Attempt</p>
                                                    <p className="text-[10px] text-white font-mono mt-1">
                                                        {latestEvent ? new Date(latestEvent.created_at).toLocaleString() : (displayJob.updated_at ? new Date(displayJob.updated_at).toLocaleString() : "Recent Event Detected")}
                                                    </p>
                                                </div>
                                                <div className="px-2 py-0.5 bg-rose-500 text-black text-[8px] font-black uppercase tracking-tighter scifi-clip">
                                                    {latestEvent?.action_taken || displayJob.action_taken || "quarantined"}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Block Reason</p>
                                                    <p className="text-[10px] text-rose-400 font-bold uppercase break-words whitespace-pre-wrap">
                                                        {typeof (latestEvent?.block_reason || displayJob.block_reason) === 'object' ? JSON.stringify(latestEvent?.block_reason || displayJob.block_reason) : String(latestEvent?.block_reason || displayJob.block_reason || "SHADOW_FORK_ALERT")}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Detected Reason</p>
                                                    <p className="text-[10px] text-slate-300 italic break-words whitespace-pre-wrap">
                                                        "{typeof (latestEvent?.reason || displayJob.reason) === 'object' ? JSON.stringify(latestEvent?.reason || displayJob.reason) : String(latestEvent?.reason || displayJob.reason || "Autonomous Forking Signature")}"
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSimulateFork}
                                        disabled={isProcessing || forkLoading}
                                        className="w-full h-10 border border-white/5 bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all flex items-center justify-center gap-2 group cursor-target"
                                    >
                                        <Network className={cn("w-3.5 h-3.5 text-slate-500 group-hover:text-rose-500", isProcessing && "animate-spin")} />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-rose-500">Trigger Fork Simulation (SIMULATOR)</span>
                                    </button>
                                </div>
                            </HUDFrame>

                            <HUDFrame
                                title="Artifact Output"
                                variant="glass"
                                isProcessing={displayJob.status === 'in_progress'}
                                headerAction={
                                    <button
                                        disabled={
                                            isProcessing ||
                                            !artifactContent ||
                                            artifactContent.length < 50 ||
                                            ['grading', 'awaiting_approval', 'approved', 'completed', 'graded'].indexOf(displayJob.status) === -1
                                        }
                                        onClick={() => {
                                            let md = `# Intelligence Report: ${displayJob.job_id}\n\n`;
                                            md += `## Audit Metadata\n\n`;
                                            md += `* **Job ID:** ${displayJob.job_id}\n`;
                                            md += `* **Envelope ID:** ${envelope?.envelope_id || displayJob.envelope_id || displayJob.execution_id || 'N/A'}\n`;
                                            md += `* **Status:** ${displayJob.status?.toUpperCase() || 'UNKNOWN'}\n`;
                                            md += `* **Neural Provider:** ${resolvedProvider.toUpperCase()}\n`;
                                            md += `* **Compute Model:** ${resolvedModel}\n`;
                                            md += `* **Compute Cost:** $${Number((typeof displayJob.token_usage === 'object' ? displayJob.token_usage?.cost : null) ?? displayJob.cost ?? 0).toFixed(6)}\n`;
                                            md += `* **Token Usage:** ${Number(typeof displayJob.token_usage === 'object' ? displayJob.token_usage?.total_tokens ?? 0 : displayJob.token_usage ?? 0).toLocaleString()}\n`;
                                            md += `* **Generated At:** ${new Date().toLocaleString()}\n\n`;

                                            if (displayJob.prompt) {
                                                md += `## Strategic Intent\n\n`;
                                                md += `> ${displayJob.prompt}\n\n`;
                                            }

                                            if (displayJob.runtime_context?.plan) {
                                                md += `## Strategic Plan\n\n`;
                                                md += `${typeof displayJob.runtime_context.plan === 'string' ? displayJob.runtime_context.plan : JSON.stringify(displayJob.runtime_context.plan, null, 2)}\n\n`;
                                            }

                                            if (graderData) {
                                                md += `## Governance Grading\n\n`;
                                                md += `* **Score**: ${graderData.score.toFixed(1)}/10\n`;
                                                md += `* **Verdict**: ${graderData.pass_fail?.toUpperCase() || 'N/A'}\n`;
                                                const evaluationArtifact = artifacts.find(a => ['evaluation', 'grading', 'evaluate'].includes(a.artifact_type || ''));
                                                const evaluationContent: any = (() => {
                                                    const raw = evaluationArtifact?.artifact_content;
                                                    if (!raw) return null;
                                                    if (typeof raw === 'object') return raw;
                                                    try { return JSON.parse(raw as string); } catch { return null; }
                                                })();
                                                const graderObj = evaluationContent || displayJob?.runtime_context?.grading_result || displayJob?.grading_result || displayJob?.grader_params || displayJob;
                                                const rationale = graderObj?.reason || graderObj?.reasoning || graderObj?.reasoning_summary || graderObj?.summary || graderObj?.grading_summary || graderObj?.feedback || "*No reasoning provided.*";
                                                if (rationale) md += `* **Evaluation Reason:** ${typeof rationale === 'object' ? JSON.stringify(rationale) : rationale}\n`;
                                                if (graderData.risk_flags && Array.isArray(graderData.risk_flags) && graderData.risk_flags.length > 0) {
                                                    md += `* **Risk Flags:** ${graderData.risk_flags.join(', ')}\n`;
                                                }
                                                md += `\n`;
                                            }

                                            let workerData: any = displayJob.runtime_context?.final_result || displayJob.runtime_context?.worker_result || displayJob.artifact;
                                            if (typeof workerData === 'string' && workerData.trim().startsWith('{')) {
                                                try { workerData = JSON.parse(workerData.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/i, '').trim()); } catch (e) { }
                                            }

                                            if (workerData?.grounding_report) {
                                                const gr = workerData.grounding_report;
                                                md += `## Grounding & Verification\n\n`;
                                                md += `* **Fabrication Check**: ${gr.fabrication_check && gr.fabrication_check !== 'UNKNOWN' ? gr.fabrication_check : ((gr.kb_chunks_cited > 0 || workerData._grounding_meta?.kb_chunks_used > 0) ? 'VERIFIED' : 'UNKNOWN')}\n`;
                                                md += `* **Knowledge Density**: ${gr.kb_chunks_cited || workerData._grounding_meta?.kb_chunks_used || 0} Knowledge References\n`;
                                                md += `* **Web Intelligence**: ${workerData._grounding_meta?.web_results_used || gr.web_sources_cited || 0} Web Sources\n\n`;
                                            }

                                            md += `## Final Deliverable Content\n\n`;
                                            const pdfRawContent = displayJob.runtime_context?.final_result || displayJob.runtime_context?.worker_result || displayJob.artifact;
                                            const pdfFormatted = pdfRawContent ? formatOutputToMarkdown(pdfRawContent) : (artifactContent || '');
                                            md += pdfFormatted || "*No deliverable content was generated for this job.*";
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

                                            exportToPDF(md, `job-${displayJob.job_id}-full-report.pdf`);
                                        }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 border scifi-clip transition-all text-[9px] uppercase font-black tracking-wider",
                                            ['awaiting_approval', 'graded', 'approved', 'completed'].includes(displayJob.status) && artifactContent
                                                ? "text-cyan-500 border-cyan-500/50 hover:bg-cyan-500/10 cursor-target"
                                                : "text-slate-500 border-white/10 opacity-50 cursor-not-allowed"
                                        )}
                                        title={displayJob.status === 'awaiting_approval' ? "Save as PDF" : "Available when awaiting approval"}
                                    >
                                        <Download className="w-3 h-3" />
                                        Save PDF
                                    </button>
                                }
                            >
                                {artifactContent ? (
                                    <div className="bg-black/40 border border-white/5 p-4 scifi-clip">
                                        <MarkdownReport content={artifactContent} />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-12 text-slate-600 border border-dashed border-white/10 scifi-clip">
                                        <RotateCw className="w-8 h-8 animate-spin mb-4 opacity-20" />
                                        <p className="text-[10px] uppercase font-black tracking-widest">Waiting for execution stream...</p>
                                    </div>
                                )}
                            </HUDFrame>
                        </div>
                    )}

                    {activeTab === "nexus" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <HUDFrame title="Kernel Integrity Status" variant="glass">
                                <div className="grid grid-cols-2 gap-3 py-2">
                                    <KernelStatusBadge
                                        kernel="identity"
                                        status={
                                            Object.values((envelope as any)?.identity_contexts || {}).every((ctx: any) => ctx.verified)
                                                ? "verified"
                                                : "active"
                                        }
                                    />
                                    <KernelStatusBadge
                                        kernel="authority"
                                        status={
                                            Object.values((envelope as any)?.authority_leases || {}).some((l: any) => l.status === "active")
                                                ? "granted"
                                                : "idle"
                                        }
                                    />
                                    <KernelStatusBadge
                                        kernel="execution"
                                        status={envelope?.status === "executing" ? "active" : "idle"}
                                    />
                                    <KernelStatusBadge
                                        kernel="persistence"
                                        status="verified"
                                    />
                                </div>
                            </HUDFrame>

                            <HUDFrame title="Deterministic Plan Trace" variant="dark">
                                <div className="p-4 bg-black/40 border border-white/5 scifi-clip">
                                    <StepGraph steps={steps} currentStepId={envelope?.current_step_id} />
                                </div>
                            </HUDFrame>

                            <HUDFrame title="Covenant Context" variant="glass">
                                <div className="space-y-4 py-2">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Execution ID</span>
                                        <span className="text-[10px] font-mono text-cyan-500 tracking-tighter truncate max-w-[200px]">{envelope?.envelope_id || job?.execution_id || "LEGACY_CONTEXT"}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                        <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Active Leases</span>
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-widest",
                                            Object.keys((envelope as any)?.authority_leases || {}).length > 0 ? "text-emerald-500" : "text-amber-500"
                                        )}>
                                            {Object.keys((envelope as any)?.authority_leases || {}).length} GRANTED
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Protocol Shard</span>
                                        <span className="text-[10px] font-mono text-slate-400">#us#.shard.01</span>
                                    </div>
                                </div>
                            </HUDFrame>

                            <HUDFrame title="Intelligence Grounding (Phase 3)" variant="glass">
                                <div className="space-y-4 py-2">
                                    {/* Knowledge Base Grounding */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] uppercase font-black tracking-widest text-slate-500 flex items-center gap-1">
                                                <Layers className="w-2 h-2 text-cyan-500" /> Knowledge Grounding
                                            </span>
                                            <span className={cn(
                                                "text-[8px] font-black px-2 py-0.5 border scifi-clip",
                                                envelope?.knowledge_context?.enabled ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-slate-500 border-white/5"
                                            )}>
                                                {envelope?.knowledge_context?.enabled ? "ACTIVE" : "INACTIVE"}
                                            </span>
                                        </div>
                                        {envelope?.knowledge_context?.enabled && (
                                            <div className="pl-3 border-l border-white/10 space-y-3 mt-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Collections</span>
                                                    <span className="text-[9px] text-white font-mono">{envelope.knowledge_context.collections?.length || 0} Targeted</span>
                                                </div>

                                                {/* Progressive Status for each collection */}
                                                <div className="space-y-3">
                                                    {envelope.knowledge_context.collections?.map((cid: string) => {
                                                        const status = collectionsStatus[cid];
                                                        const isReady = status?.status === "ready";
                                                        const isIndexing = status?.status === "indexing";
                                                        const progress = status?.progress || 0;

                                                        return (
                                                            <div key={cid} className="space-y-1.5">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="text-[8px] font-mono text-slate-500 truncate max-w-[150px]">{status?.name || cid}</span>
                                                                    <span className={cn(
                                                                        "text-[7px] font-black uppercase tracking-tighter px-1 border",
                                                                        isReady ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                                                                            isIndexing ? "text-cyan-500 border-cyan-500/20 bg-cyan-500/5 animate-pulse" :
                                                                                "text-slate-500 border-white/5"
                                                                    )}>
                                                                        {status?.status || "PENDING"}
                                                                    </span>
                                                                </div>
                                                                {!isReady && (
                                                                    <div className="h-1 w-full bg-white/5 border border-white/5 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={cn(
                                                                                "h-full transition-all duration-500 ease-out shadow-[0_0_8px_currentColor]",
                                                                                isIndexing ? "bg-cyan-500 text-cyan-500" : "bg-slate-700 text-slate-700"
                                                                            )}
                                                                            style={{ width: `${isIndexing ? Math.max(progress, 5) : 0}%` }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex justify-between items-center pt-1 border-t border-white/5">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Total Grounding Data</span>
                                                    <span className="text-[9px] text-cyan-400 font-mono">{envelope.knowledge_context.chunks_used || 0} Segmented Chunks</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Web Search Context */}
                                    <div className="space-y-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] uppercase font-black tracking-widest text-slate-500 flex items-center gap-1">
                                                <Network className="w-2 h-2 text-cyan-500" /> Web Intelligence
                                            </span>
                                            <span className={cn(
                                                "text-[8px] font-black px-2 py-0.5 border scifi-clip",
                                                envelope?.web_search_context?.enabled ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-slate-500 border-white/5"
                                            )}>
                                                {envelope?.web_search_context?.enabled ? "ENABLED" : "DISABLED"}
                                            </span>
                                        </div>
                                        {envelope?.web_search_context?.enabled && (
                                            <div className="pl-3 border-l border-white/10 space-y-2 mt-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Queries Executed</span>
                                                    <span className="text-[9px] text-white font-mono">{envelope.web_search_context.queries?.length || 0} Deep Searches</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Sources Cited</span>
                                                    <span className="text-[9px] text-emerald-400 font-mono">{envelope.web_search_context.sources_used?.length || 0} External</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Instruction Profiles */}
                                    <div className="space-y-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[8px] uppercase font-black tracking-widest text-slate-500 flex items-center gap-1">
                                                <ShieldCheckIcon className="w-2 h-2 text-cyan-500" /> Custom Protocols
                                            </span>
                                            <span className={cn(
                                                "text-[8px] font-black px-2 py-0.5 border scifi-clip",
                                                envelope?.instruction_context?.enabled ? "text-cyan-500 border-cyan-500/30 bg-cyan-500/5" : "text-slate-500 border-white/5"
                                            )}>
                                                {envelope?.instruction_context?.enabled ? "ACTIVE" : "INACTIVE"}
                                            </span>
                                        </div>
                                        {envelope?.instruction_context?.enabled && envelope.instruction_context.profiles && (
                                            <div className="pl-3 border-l border-white/10 flex flex-wrap gap-1 mt-2">
                                                {envelope.instruction_context.profiles.map((p: string) => (
                                                    <span key={p} className="text-[7px] font-mono text-cyan-500/70 bg-cyan-500/5 px-1.5 py-0.5 border border-cyan-500/20">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </HUDFrame>
                        </div>
                    )}

                    {activeTab === "grading" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {graderData ? (
                                <>
                                    <HUDFrame title="Analytical Integrity Index" variant="glass" className="py-8">
                                        <div className="flex flex-col items-center justify-center relative">
                                            {/* Radial Gauge SVG */}
                                            <div className="relative w-48 h-48 flex items-center justify-center">
                                                <svg className={cn(
                                                    "w-full h-full transform -rotate-90",
                                                    displayJob.status === 'in_progress' || displayJob.status === 'awaiting_approval' ? "animate-breathing" : ""
                                                )}>
                                                    <circle
                                                        cx="96"
                                                        cy="96"
                                                        r="88"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="4"
                                                        className="text-white/5"
                                                    />
                                                    <circle
                                                        cx="96"
                                                        cy="96"
                                                        r="88"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        strokeWidth="6"
                                                        strokeDasharray={552.92}
                                                        strokeDashoffset={552.92 - (552.92 * graderData.score) / 10}
                                                        strokeLinecap="round"
                                                        className={cn(
                                                            "transition-all duration-1000 ease-out",
                                                            graderData.pass_fail === 'pass' ? "text-emerald-500 ai-breathing-green" :
                                                                graderData.pass_fail === 'fail' ? "text-rose-500 ai-breathing-red" : "text-amber-500"
                                                        )}
                                                        style={{ filter: `drop-shadow(0 0 8px currentColor)` }}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className={cn(
                                                        "text-5xl font-black italic tracking-tighter tabular-nums drop-shadow-sm",
                                                        graderData.pass_fail === 'pass' ? "text-emerald-400" : "text-rose-400"
                                                    )}>
                                                        {graderData.score.toFixed(1)}<span className="text-xl opacity-50 ml-1">/10</span>
                                                    </span>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mt-1">Reliability</span>
                                                        {displayJob.grader_model && (
                                                            <span className="text-[7px] font-bold uppercase tracking-widest text-cyan-500/50 mt-1">{String(displayJob.grader_model)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="mt-8 flex items-center gap-6">
                                                <div className="flex flex-col items-center">
                                                    <div className={cn(
                                                        "px-4 py-1 border text-[10px] font-black uppercase tracking-widest scifi-clip bg-black/40",
                                                        graderData.pass_fail === "pass" ? "border-emerald-500/50 text-emerald-500" : "border-rose-500/50 text-rose-500"
                                                    )}>
                                                        {graderData.pass_fail === "pass" ? "Protocol Verified" : "Integrity Failure"}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </HUDFrame>

                                    <div className="grid grid-cols-1 gap-6">
                                        <HUDFrame title="Risk Vector Assessment" isProcessing={displayJob.status === 'awaiting_approval'}>
                                            <div className="grid grid-cols-2 gap-3 py-2">
                                                {graderData.risk_flags.length > 0 ? graderData.risk_flags.map((flag: string, i: number) => (
                                                    <div key={i} className="flex items-center gap-3 px-3 py-2 bg-rose-500/5 border border-rose-500/20 text-rose-500 scifi-clip transition-all hover:bg-rose-500/10">
                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] uppercase font-black tracking-wider truncate">{typeof flag === 'object' ? JSON.stringify(flag) : String(flag)}</span>
                                                    </div>
                                                )) : (
                                                    <div className="col-span-2 flex items-center justify-center gap-3 px-3 py-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-500 scifi-clip">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        <span className="text-[10px] uppercase font-black tracking-[0.2em]">All Systems Nominal - No Hazards Detected</span>
                                                    </div>
                                                )}
                                            </div>
                                        </HUDFrame>

                                        <HUDFrame title="Evaluation Reason (Grader Logic)">
                                            <div className="space-y-4">
                                                <div className="bg-black/30 border border-white/5 p-5 text-sm text-slate-300 leading-relaxed font-medium tech-dots relative">
                                                    <div className="absolute top-2 right-2 flex gap-1">
                                                        <div className="w-1 h-1 bg-cyan-500/50" />
                                                        <div className="w-1 h-1 bg-cyan-500/30" />
                                                        <div className="w-1 h-1 bg-cyan-500/10" />
                                                    </div>
                                                    <p className="italic leading-relaxed">
                                                        {typeof graderData.reasoning_summary === 'object' ? JSON.stringify(graderData.reasoning_summary) : graderData.reasoning_summary}
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest block">Operational Result Summary</label>
                                                    <div className={cn(
                                                        "text-xs leading-relaxed p-4 bg-black/40 border rounded-sm",
                                                        graderData.pass_fail === 'pass' ? "text-emerald-400/90 border-emerald-500/20" : "text-red-400/90 border-red-500/20"
                                                    )}>
                                                        {(() => {
                                                            const result = displayJob.runtime_context?.final_result || displayJob.runtime_context?.worker_result || displayJob.artifact;
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
                                        </HUDFrame>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-20 text-slate-600 border border-dashed border-white/10 scifi-clip">
                                    <ShieldCheck className="w-12 h-12 mb-4 opacity-10" />
                                    <p className="text-[10px] uppercase font-black tracking-[.3em]">Awaiting Automated Grading</p>
                                    <p className="text-[8px] uppercase font-bold text-slate-700 mt-2 italic">Neural vetting will begin upon completion</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "governance" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <HUDFrame title="Decision Interface">
                                <div className="space-y-4 py-2">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold leading-relaxed">
                                        Governance actions require <span className="text-white">Operator Validation</span>. Once approved, the job response is marked as canonical. Once rejected, it is removed from the active pipeline.
                                    </p>

                                    <div className="grid grid-cols-2 gap-4 mt-2">
                                        <div className="space-y-1">
                                            <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Policy Version</p>
                                            <p className="text-xs font-mono text-cyan-400">{typeof displayJob.policy_version === 'object' ? JSON.stringify(displayJob.policy_version) : String(displayJob.policy_version || "v1_legacy")}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] uppercase font-black tracking-widest text-slate-500">Gate Level</p>
                                            <p className="text-xs font-mono text-cyan-400">{typeof displayJob.gate_level === 'object' ? JSON.stringify(displayJob.gate_level) : String(displayJob.gate_level || "G0_UNRESTRICTED")}</p>
                                        </div>
                                    </div>

                                    {(displayJob.status === "graded" || displayJob.status === "awaiting_approval") ? (
                                        <div className="flex flex-col gap-4">
                                            {!showRejectInput ? (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <button
                                                        disabled={isProcessing}
                                                        onClick={handleApprove}
                                                        className="bg-emerald-500 hover:bg-emerald-400 text-black py-4 scifi-clip font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.2)] cursor-target"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Approve Result
                                                    </button>
                                                    <button
                                                        disabled={isProcessing}
                                                        onClick={() => setShowRejectInput(true)}
                                                        className="bg-rose-500/10 border border-rose-500/30 text-rose-500 py-4 scifi-clip font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-target"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Reject Result
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="space-y-2">
                                                        <label className="text-[8px] uppercase font-black tracking-widest text-rose-500">Rejection Reason Terminal</label>
                                                        <textarea
                                                            value={rejectReason}
                                                            onChange={(e) => setRejectReason(e.target.value)}
                                                            placeholder="Enter failure reason or operator notes..."
                                                            className="w-full bg-black/40 border border-rose-500/20 scifi-clip p-4 text-sm font-mono text-rose-400 focus:outline-none focus:border-rose-500/50 resize-none h-32"
                                                        />
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <button
                                                            disabled={isProcessing}
                                                            onClick={handleReject}
                                                            className="flex-1 bg-rose-500 text-black py-4 scifi-clip font-black text-xs uppercase tracking-[0.2em] transition-all cursor-target"
                                                        >
                                                            Confirm Rejection
                                                        </button>
                                                        <button
                                                            disabled={isProcessing}
                                                            onClick={() => {
                                                                setShowRejectInput(false);
                                                                setRejectReason("");
                                                            }}
                                                            className="flex-1 bg-slate-800 text-slate-400 py-4 scifi-clip font-black text-xs uppercase tracking-[0.2em] transition-all cursor-target"
                                                        >
                                                            Abort
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-white/5 border border-white/5 p-8 flex flex-col items-center justify-center text-center scifi-clip">
                                            <Lock className="w-8 h-8 text-slate-700 mb-4" />
                                            <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 italic">Governance Controls Locked</p>
                                            <p className="text-[8px] uppercase font-bold text-slate-600 mt-2">
                                                State must be <span className="text-orange-500">graded</span> or <span className="text-amber-500">awaiting approval</span> to unlock decisions. Current: <span className="text-cyan-500">{displayJob.status}</span>
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </HUDFrame>

                            {(displayJob.approved_at || displayJob.rejected_at) && (
                                <HUDFrame title="Decision Audit Log">
                                    <div className="space-y-4 py-2">
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Decision Outcome</span>
                                            <span className={cn("text-xs font-black uppercase tracking-widest italic", displayJob.approved_at ? "text-emerald-500" : "text-rose-500")}>
                                                {displayJob.approved_at ? "Approved" : "Rejected"}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                            <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Validator ID</span>
                                            <span className="text-xs font-bold text-white uppercase">{displayJob.approved_by || displayJob.rejected_by || "System Admin"}</span>
                                        </div>
                                        {displayJob.failure_reason && (
                                            <div className="space-y-1">
                                                <span className="text-[8px] uppercase font-black tracking-widest text-slate-500">Failure Reason</span>
                                                <p className="text-xs text-rose-400/80 italic">"{displayJob.failure_reason}"</p>
                                            </div>
                                        )}
                                    </div>
                                </HUDFrame>
                            )}
                        </div>
                    )}

                    {activeTab === "resurrection" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <HUDFrame title="Continuity Operations">
                                {(() => {
                                    const status = String(displayJob.status || "").toLowerCase();
                                    const isFailedOrRejected = status === "failed" || status === "rejected";
                                    const isStalledJob = isStalled && !["completed", "approved", "rejected", "failed"].includes(status);

                                    return (
                                        <>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold leading-relaxed">
                                                Jobs in <span className="text-rose-500">failed</span>, <span className="text-rose-500">rejected</span>, or <span className="text-amber-500">stalled</span> states can be resurrected into the active lifecycle. This creates an immutable lineage event. (Continuity Restore)
                                            </p>

                                            {(isFailedOrRejected || isStalledJob) && (
                                                <div className="space-y-4">
                                                    {!showResurrectInput ? (
                                                        <button
                                                            disabled={isProcessing}
                                                            onClick={() => setShowResurrectInput(true)}
                                                            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-5 scifi-clip font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(6,182,212,0.2)] cursor-target"
                                                        >
                                                            <RotateCw className={cn("w-5 h-5", isProcessing && "animate-spin")} />
                                                            {isStalledJob ? "Execute Stall Recovery Protocol" : "Execute Continuity Restore Protocol"}
                                                        </button>
                                                    ) : (
                                                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                                            <div className="space-y-2">
                                                                <label className="text-[8px] uppercase font-black tracking-widest text-cyan-500">Continuity Restore Authorization Terminal</label>
                                                                <textarea
                                                                    value={resurrectReason}
                                                                    onChange={(e) => setResurrectReason(e.target.value)}
                                                                    placeholder="Enter authorization reason for lineage restoration..."
                                                                    className="w-full bg-black/40 border border-cyan-500/20 scifi-clip p-4 text-sm font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 resize-none h-32"
                                                                />
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <button
                                                                    disabled={isProcessing || !resurrectReason}
                                                                    onClick={handleResurrect}
                                                                    className="flex-1 bg-cyan-500 text-black py-4 scifi-clip font-black text-xs uppercase tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-target"
                                                                >
                                                                    Confirm Continuity Restore
                                                                </button>
                                                                <button
                                                                    disabled={isProcessing}
                                                                    onClick={() => {
                                                                        setShowResurrectInput(false);
                                                                        setResurrectReason("");
                                                                    }}
                                                                    className="flex-1 bg-slate-800 text-slate-400 py-4 scifi-clip font-black text-xs uppercase tracking-[0.2em] transition-all cursor-target"
                                                                >
                                                                    Abort
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) || (
                                                    <div className="bg-white/5 border border-white/5 p-8 flex flex-col items-center justify-center text-center scifi-clip">
                                                        <AlertCircle className="w-8 h-8 text-slate-700 mb-4" />
                                                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 italic">Continuity Restore Unavailable</p>
                                                        {isStalledJob ? (
                                                            <p className="text-[8px] uppercase font-bold text-cyan-500 mt-2 animate-pulse">
                                                                Stall detected. Lineage restoration is available in the terminal.
                                                            </p>
                                                        ) : (
                                                            <p className="text-[8px] uppercase font-bold text-slate-600 mt-2 italic">
                                                                Dimensional lineage is intact. Standard terminal state not reached.
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                        </>
                                    );
                                })()}
                            </HUDFrame>

                            {displayJob.resurrected_at && (
                                <HUDFrame title="Continuity Restore Event Log">
                                    <div className="space-y-4 py-2 border-l-2 border-cyan-500/30 pl-4 ml-2">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] uppercase font-black tracking-widest text-cyan-500">Identity: #{displayJob.job_id.slice(-4)}</span>
                                                <span className="text-[8px] text-slate-600">|</span>
                                                <span className="text-[8px] font-mono text-slate-500">{new Date(displayJob.resurrected_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-[10px] text-white font-bold italic uppercase tracking-tight">
                                                " {typeof displayJob.resurrection_reason === 'object' ? JSON.stringify(displayJob.resurrection_reason) : String(displayJob.resurrection_reason)} "
                                            </p>
                                            <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest mt-1">Authorized by: <span className="text-cyan-500">{typeof displayJob.resurrected_by === 'object' ? JSON.stringify(displayJob.resurrected_by) : String(displayJob.resurrected_by)}</span></p>
                                        </div>
                                    </div>
                                </HUDFrame>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer info bar */}
                <div className="p-4 bg-black/60 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-500/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        Live Telemetry Link Active
                    </div>
                    <div className="text-[8px] uppercase font-bold text-slate-600 tracking-tighter italic">
                        ACEPLACE-CORE V1.0.5-DELTA
                    </div>
                </div>
            </div>
        </div>
    );
}

function Lock(props: any) {
    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}
