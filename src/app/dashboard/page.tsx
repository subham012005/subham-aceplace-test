"use client";

import React from "react";
import {
    Users,
    Cpu,
    Activity,
    CheckCircle2,
    RotateCw,
    ShieldCheck,
    Fingerprint,
    Share2,
    AlertTriangle,
    X,
    Plus,
    LogOut,
    Lock,
    Terminal,
    Clipboard,
    Check,
    Hash,
    DollarSign,
    Settings as SettingsIcon
} from "lucide-react";
import { subscribeToUserStats } from "@/lib/user-stats";
import { HUDFrame } from "@/components/HUDFrame";
import { TaskComposer } from "@/components/TaskComposer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SettingsModal from "@/components/SettingsModal";
import { cn } from "@/lib/utils";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useJobs, Job } from "@/hooks/useJobs";
import { TaskDetail } from "@/components/TaskDetail";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";
import { aceApi } from "@/lib/api-client";
import { AceWaveform } from "@/components/AceWaveform";
import { RuntimeStats } from "@/components/RuntimeStats";
import { LeaseManager } from "@/components/LeaseManager";
import { IdentityPanel } from "@/components/IdentityPanel";
import { AgentIdentityMini } from "@/components/AgentIdentityMini";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useEnvelopes } from "@/hooks/useEnvelopes";
import { TraceStreamPanel } from "@/components/TraceStreamPanel";
import type { ExecutionEnvelope } from "@aceplace/runtime-core/shared";

interface ActivityLog {
    id: string;
    assigned_agent: string;
    job_type: string;
    status: string;
    timestamp: any;
    location?: string;
}

interface DashboardData {
    stats: {
        licensees: number;
        totalAgents: number;
        resurrectionEvents: number;
        averagePassRate: string;
        identityLogs: string;
        lineageVerified: string;
    };
    missionQueue: Array<{ task: string; active: boolean }>;
    agents: Array<{ name: string; intel: string; gate: string; color: string; status?: string }>;
    systemStatus: {
        licenseeCap: { current: number; max: number };
        activeAgents: { current: number; max: number };
        gateLevels: number;
    };
}

const parseFirestoreDate = (date: any) => {
    if (!date) return null;
    if (typeof date === 'object' && typeof date._seconds === 'number') {
        return new Date(date._seconds * 1000);
    }
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
};

const AGENT_ROSTER = [
    { name: "COO",        agentId: "agent_coo",        color: "text-blue-400",    border: "border-blue-500/30",    bg: "bg-blue-500/10" },
    { name: "Researcher", agentId: "agent_researcher",  color: "text-purple-400",  border: "border-purple-500/30",  bg: "bg-purple-500/10" },
    { name: "Worker",     agentId: "agent_worker",      color: "text-amber-400",   border: "border-amber-500/30",   bg: "bg-amber-500/10" },
    { name: "Grader",     agentId: "agent_grader",      color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/10" },
] as const;

function AgentIdentityRoster() {
    const [activeAgent, setActiveAgent] = React.useState<string>("agent_coo");
    const active = AGENT_ROSTER.find(a => a.agentId === activeAgent) ?? AGENT_ROSTER[0];

    return (
        <div className="border border-white/5 bg-black/40 overflow-hidden">
            {/* Header */}
            <div className="px-3 pt-3 pb-0">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2">Agent Identity Registry</p>
                {/* Agent Tabs */}
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {AGENT_ROSTER.map(a => (
                        <button
                            key={a.agentId}
                            onClick={() => setActiveAgent(a.agentId)}
                            className={cn(
                                "text-[7px] font-black uppercase tracking-widest px-2 py-1 border transition-all whitespace-nowrap shrink-0",
                                activeAgent === a.agentId
                                    ? `${a.color} ${a.border} ${a.bg}`
                                    : "text-slate-600 border-white/5 hover:text-slate-400"
                            )}
                        >
                            {a.name}
                        </button>
                    ))}
                </div>
            </div>
            {/* Identity Panel for active agent */}
            <div className="border-t border-white/5 mt-2">
                <IdentityPanel agentId={activeAgent} />
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { user, loading: authLoading, signOut: handleSignOut } = useAuth();
    const router = useRouter();
    const [userUid, setUserUid] = React.useState<string | undefined>(undefined);

    // Sync context user to local state for compatibility with existing hooks
    React.useEffect(() => {
        if (!authLoading) {
            if (user) {
                setUserUid(user.uid);
            } else {
                router.push("/login");
            }
        }
    }, [user, authLoading, router]);

    const {
        jobs,
        loading: jobsLoading,
        refreshing: jobsRefreshing,
        refresh: refreshJobs,
        updateJobInList
    } = useJobs(userUid);

    // Envelope data — canonical source of truth for execution status
    const { envelopes } = useEnvelopes(userUid ?? null);

    // Build a fast job_id → envelope lookup map
    const jobEnvelopeMap = React.useMemo(() => {
        const map = new Map<string, ExecutionEnvelope>();
        envelopes.forEach(env => {
            if (env.job_id) map.set(env.job_id, env);
            // Also index by envelope_id in case job.envelope_id is set
            if (env.envelope_id) map.set(env.envelope_id, env);
        });
        return map;
    }, [envelopes]);

    const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
    const [isComposerOpen, setIsComposerOpen] = React.useState(false);
    const { settings, isSettingsOpen, setIsSettingsOpen } = useSettings();
    const [isSpeaking, setIsSpeaking] = React.useState(false);
    const [data, setData] = React.useState<DashboardData | null>(null);
    const [statsLoading, setStatsLoading] = React.useState(false);
    const [hasAttemptedInitialFetch, setHasAttemptedInitialFetch] = React.useState(false);
    const [viewedJobIds, setViewedJobIds] = React.useState<Set<string>>(new Set());
    const [logs, setLogs] = React.useState<string[]>(["[SYSTEM] Dimensional link established.", "[AUTH] Identity verified: " + (user?.email || "Unknown")]);
    const [retryCount, setRetryCount] = React.useState(0);
    const [totalRequestCount, setTotalRequestCount] = React.useState(0);
    const [lastSyncFailed, setLastSyncFailed] = React.useState(false);
    const [hoveredAgent, setHoveredAgent] = React.useState<string | null>(null);
    const [errorStatus, setErrorStatus] = React.useState<number | null>(null);
    const maxRetries = 10;
    const initialFetchRef = React.useRef(false);
    const fetchingJobIdsRef = React.useRef<Set<string>>(new Set());

    const addLog = React.useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
    }, []);

    const deriveHomeStatus = React.useCallback((job: Job): string => {
        // ── 0. Manual governance states are absolute ─────────────────
        if (job.approved_at) return 'approved';
        if (job.rejected_at) return 'rejected';

        const rawJobStatus = String(job.status || '').toLowerCase();

        // Ensure "graded" state takes precedence so UI doesn't falsely display "rejected" 
        // when the operator hasn't enacted a governance decision yet.
        if (rawJobStatus === 'graded' || rawJobStatus === 'awaiting_approval') {
            return 'graded';
        }

        // ── 1. Look up the linked envelope ──────────────────────────────────
        const envelope =
            jobEnvelopeMap.get(job.job_id) ||
            jobEnvelopeMap.get(job.id) ||
            (job.envelope_id ? jobEnvelopeMap.get(job.envelope_id) : undefined);

        if (envelope) {
            const envStatus = envelope.status;

            // ── 1a. Envelope terminal / governance states ─────────────────
            if (envStatus === 'approved') return 'approved';
            if (envStatus === 'rejected') {
                // If we have grading data but no manual rejected_at, it's still 'graded'
                const hasGradeData = !!(
                    job.grading_result ||
                    job.runtime_context?.grading_result ||
                    job.grader_params ||
                    job.compliance_score ||
                    job.grade_score
                );
                if (hasGradeData && !job.rejected_at) {
                    return 'graded';
                }
                return 'rejected';
            }
            if (envStatus === 'quarantined') return 'quarantined';
            if (envStatus === 'failed') return 'failed';
            if (envStatus === 'completed') return 'completed';
            // awaiting_human = grading is done, waiting for operator decision
            if (envStatus === 'awaiting_human') return 'graded';

            // ── 1b. Derive sub-stage from completed steps ─────────────────
            if (envStatus === 'executing' || envStatus === 'planned' || envStatus === 'leased') {
                const steps = envelope.steps || [];
                const hasEvalDone = steps.some(s =>
                    (s.step_type === 'evaluation' || s.step_type === 'evaluate') &&
                    s.status === 'completed'
                );
                if (hasEvalDone) return 'graded';

                const hasArtifactDone = steps.some(s =>
                    (s.step_type === 'artifact_produce' || s.step_type === 'produce_artifact') &&
                    s.status === 'completed'
                );
                if (hasArtifactDone) return 'worker_execution';

                const hasAssignDone = steps.some(s =>
                    s.step_type === 'assign' && s.status === 'completed'
                );
                if (hasAssignDone) return 'research_execution';

                const hasPlanDone = steps.some(s =>
                    s.step_type === 'plan' && s.status === 'completed'
                );
                if (hasPlanDone) return 'coo_planning';
            }
        }

        // ── 2. Fallback: job.status + grading heuristics ────────────────────
        let rawStatus = String(job.status || 'queued').toLowerCase();
        if (rawStatus === 'awaiting_approval') rawStatus = 'graded';

        const hasGradingData = !!(
            job.grade_score !== undefined ||
            job.grading_result !== undefined ||
            job.grading_summary !== undefined ||
            job.runtime_context?.grading_result !== undefined
        );

        const terminalStates = ['approved', 'rejected', 'failed', 'completed', 'quarantined'];
        const preExecutionStates = ['queued', 'created'];

        if (hasGradingData && !terminalStates.includes(rawStatus) && !preExecutionStates.includes(rawStatus)) return 'graded';

        if (rawStatus === 'executing') {
            if (hasGradingData) return 'graded';
            if (job.runtime_context?.worker_result) return 'worker_execution';
            if (job.runtime_context?.research_result) return 'research_execution';
            if (job.runtime_context?.plan) return 'coo_planning';
        }

        return rawStatus;
    }, [jobEnvelopeMap]);

    const realStats = React.useMemo(() => {
        if (!jobs) {
            return {
                totalTokens: 0,
                totalCost: 0,
                totalRequests: 0,
                totalAgents: 0,
                activeAgents: 0,
                resurrectionEvents: 0,
                tasksCompleted: "0",
                failedTasks: "0",
                continuityAlert: false
            };
        }

        let totalEstTokens = 0;
        let activeAgentCount = 0;

        jobs.forEach(j => {
            const rawStatus = deriveHomeStatus(j);
            if (["queued", "assigned", "executing", "in_progress", "coo_planning", "research_execution", "worker_execution", "grading", "lease_check"].includes(rawStatus)) {
                activeAgentCount++;
            }

            // Estimate tokens if none are natively persisted (Phase 2 Deterministic Runtime doesn't pass tokens down)
            const steps = (j as any).steps || [];
            totalEstTokens += steps.filter((s: any) => s.status === 'completed').length * 2400; // Approx 2400 context/completion tokens per agent phase.
        });

        const resurrections = jobs.reduce((acc, j) => acc + (Number(j.resurrection_count) || 0), 0);
        const gradedJobs = jobs.filter(j => typeof j.grade_score === 'number');
        const avgPass = gradedJobs.length > 0
            ? Math.round(gradedJobs.reduce((acc, j) => acc + (j.grade_score || 0), 0) / gradedJobs.length)
            : 100;

        const completedCount = jobs.filter(j => ["completed", "graded", "approved"].includes(deriveHomeStatus(j))).length;
        const failedCount = jobs.filter(j => ["rejected", "failed"].includes(deriveHomeStatus(j))).length;

        const tokens = jobs.reduce((acc, j) => {
            const tu = j.token_usage as any;
            const jTokens = tu?.total_tokens ?? (typeof tu === 'number' ? tu : null) ?? j.runtime_context?.token_usage?.total_tokens;
            return acc + (jTokens ? Number(jTokens) : 0);
        }, 0);

        const cost = jobs.reduce((acc, j) => {
            const tu = j.token_usage as any;
            const explicitCost = tu?.cost ?? j.runtime_context?.token_usage?.cost ?? j.cost;
            if (explicitCost !== undefined && explicitCost !== null) {
                return acc + (Number(explicitCost) || 0);
            }
            return acc;
        }, 0);

        return {
            totalTokens: tokens,
            totalCost: cost,
            totalRequests: jobs.length,
            totalAgents: 4, // Master node count (COO, Researcher, Worker, Grader)
            activeAgents: activeAgentCount,
            resurrectionEvents: resurrections,
            tasksCompleted: completedCount.toString(),
            failedTasks: failedCount.toString(),
            continuityAlert: failedCount > 0
        };
    }, [jobs, deriveHomeStatus]);

    const fetchStats = React.useCallback(async () => {
        if (!userUid) return;
        setStatsLoading(true);
        try {
            const response = await fetch(`/api/dashboard/stats?user_id=${userUid}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Stats failed (${response.status})`);
            setData(result);
        } catch (error: any) {
            const isUnconfigured =
                error.message?.includes("ADMIN_NOT_INITIALIZED") ||
                error.message?.includes("Backend not configured");

            if (!isUnconfigured) {
                console.error("Failed to fetch dashboard stats:", error);
                addLog(`[ERROR] Stats Sync: ${error.message}`);
                throw error;
            }
        } finally {
            setStatsLoading(false);
        }
    }, [userUid, addLog]);

    const handleGlobalRefresh = React.useCallback(async () => {
        addLog("[INFO] Initializing User-Space Synchronizaton...");
        setViewedJobIds(new Set());
        try {
            await Promise.all([
                refreshJobs(),
                fetchStats()
            ]);
            addLog("[SUCCESS] Local dimensions synchronized.");
            setRetryCount(0); // Reset on success
            setLastSyncFailed(false);
            setErrorStatus(null);
        } catch (error: any) {
            const isUnconfigured =
                error.message?.includes("ADMIN_NOT_INITIALIZED") ||
                error.message?.includes("Backend not configured");

            if (!isUnconfigured) {
                setRetryCount(prev => prev + 1);
                setLastSyncFailed(true);

                // Extract status code if possible from error message
                const statusMatch = error.message.match(/status (\d+)/);
                if (statusMatch) {
                    setErrorStatus(parseInt(statusMatch[1]));
                } else {
                    setErrorStatus(500); // Default to generic error
                }

                addLog(`[CRITICAL] Sync Failure: ${error.message}`);
            } else {
                // Silently reset state for unconfigured backend
                setLastSyncFailed(false);
                setErrorStatus(null);
            }
        }
    }, [refreshJobs, fetchStats, addLog]);

    const handleCopyTerminalLogs = React.useCallback(() => {
        const logEntries = logs.join("\n");
        navigator.clipboard.writeText(logEntries).then(() => {
            addLog("[SYSTEM] Diagnostic logs copied to clipboard.");
        }).catch(err => {
            console.error("Failed to copy logs:", err);
            addLog(`[ERROR] Copy failed: ${err.message}`);
        });
    }, [logs, addLog]);

    // Track persistent request count from Firestore
    React.useEffect(() => {
        if (!userUid) return;
        const unsubscribe = subscribeToUserStats(userUid, (stats) => {
            setTotalRequestCount(stats?.total_requests || 0);
        });
        return () => unsubscribe();
    }, [userUid]);


    // Refresh jobs when user comes to dashboard
    React.useEffect(() => {
        if (userUid && !initialFetchRef.current) {
            initialFetchRef.current = true;
            handleGlobalRefresh().then(() => setHasAttemptedInitialFetch(true));
        }
    }, [userUid, handleGlobalRefresh]);

    const isJobsSyncing = jobsLoading || jobsRefreshing;

    // Retry mechanism if a synchronization error occurs
    React.useEffect(() => {
        // DO NOT retry if status is 404 (Persistent Config Error)
        const isPersistentError = errorStatus === 404;

        if (hasAttemptedInitialFetch && lastSyncFailed && !isPersistentError && !isJobsSyncing && userUid && retryCount < maxRetries) {
            const retryTimer = setTimeout(() => {
                addLog(`[RETRY] Attempt ${retryCount + 1}/${maxRetries}...`);
                handleGlobalRefresh();
            }, 5 * 1000 * (retryCount + 1)); // Exponential backoff style
            return () => clearTimeout(retryTimer);
        } else if (retryCount >= maxRetries && lastSyncFailed) {
            addLog("[CRITICAL] Maximum synchronization attempts reached. Dimensional link unstable.");
        } else if (isPersistentError) {
            addLog("[SYSTEM] Persistent 404 detected. Verification link broken or workflow engine inactive.");
        }
    }, [hasAttemptedInitialFetch, lastSyncFailed, errorStatus, isJobsSyncing, userUid, handleGlobalRefresh, retryCount, maxRetries, addLog]);

    // Filter active jobs for the Mission Queue
    const activeJobs = jobs.filter(j =>
        ["queued", "assigned", "in_progress", "executing", "awaiting_approval", "resurrected", "created"].includes(j.status)
    );
    const completedJobs = jobs.filter(j =>
        ["completed", "graded", "approved", "rejected", "failed"].includes(j.status)
    );


    // Auto-fetch details for top 5 jobs
    React.useEffect(() => {
        if (!jobs || jobs.length === 0 || isJobsSyncing) return;

        // Auto-fetch details for all visible jobs to ensure scores are sync'd
        const visibleJobs = jobs.slice(0, 20);

        // Fetch immediately if they haven't been viewed
        visibleJobs.forEach(job => {
            const id = job.job_id || job.id;
            if (!viewedJobIds.has(id) && !fetchingJobIdsRef.current.has(id)) {
                // Mark as fetching immediately
                fetchingJobIdsRef.current.add(id);

                aceApi.getJob(id).then((fullJob: any) => {
                    if (fullJob) {
                        // Parse stringified fields (runtime_context) before updating
                        const parsed = { ...fullJob, id: fullJob.id || fullJob.job_id };
                        if (typeof parsed.runtime_context === 'string') {
                            try { parsed.runtime_context = JSON.parse(parsed.runtime_context); } catch (e) { }
                        }
                        updateJobInList(parsed as Job);
                        setViewedJobIds(prev => new Set(prev).add(id));
                    }
                }).catch((e: any) => {
                    const isUnconfigured =
                        e.message?.includes("ADMIN_NOT_INITIALIZED") ||
                        e.message?.includes("Backend not configured");
                    if (!isUnconfigured) {
                        console.error("Initial auto-fetch error:", e);
                    }
                }).finally(() => {
                    // Remove from fetching set after completion/error
                    fetchingJobIdsRef.current.delete(id);
                });
            }
        });
    }, [jobs, isJobsSyncing, viewedJobIds, updateJobInList]);

    const statusColorMap: Record<string, string> = {
        queued: "text-blue-500 border-blue-500/30 bg-blue-500/5",
        assigned: "text-yellow-500 border-yellow-500/30 bg-yellow-500/5",
        lease_check: "text-indigo-400 border-indigo-400/30 bg-indigo-400/5",
        executing: "text-cyan-500 border-cyan-500/30 bg-cyan-500/5",
        coo_planning: "text-blue-400 border-blue-400/30 bg-blue-400/5",
        research_execution: "text-cyan-400 border-cyan-400/30 bg-cyan-400/5",
        worker_execution: "text-purple-400 border-purple-400/30 bg-purple-400/5",
        grading: "text-pink-400 border-pink-400/30 bg-pink-400/5",
        in_progress: "text-yellow-500 border-yellow-500/30 bg-yellow-500/5",
        completed: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
        approved: "text-emerald-500 border-emerald-500/30 bg-emerald-500/5",
        standby: "text-amber-500 border-amber-500/30 bg-amber-500/5",
        graded: "text-orange-500 border-orange-500/30 bg-orange-500/5",
        rejected: "text-rose-500 border-rose-500/30 bg-rose-500/5",
        failed: "text-rose-500 border-rose-500/30 bg-rose-500/5",
        resurrected: "text-cyan-500 border-cyan-500/30 bg-cyan-500/5",
        awaiting_approval: "text-orange-500 border-orange-500/30 bg-orange-500/5",
    };

    const formatStatus = (s: string) => {
        if (!s) return '';
        if (s === 'awaiting_approval') return 'graded';
        return s.replace(/_/g, ' ');
    };

    const isStatsSyncing = statsLoading && !data;

    const statsConfig = [
        { label: "Total Requests", value: isJobsSyncing ? "--" : realStats.totalRequests.toString(), icon: Hash, sub: "Operation Count" },
        { label: "Total Tokens", value: isJobsSyncing ? "--" : realStats.totalTokens.toLocaleString(), icon: Cpu, sub: "Compute Used" },
        { label: "Total Agents", value: isJobsSyncing ? "--" : realStats.totalAgents.toString(), icon: Users, sub: "Control Nodes" },
        { label: "Continuity Restore", value: isJobsSyncing ? "--" : realStats.resurrectionEvents.toString(), icon: RotateCw, sub: "Events" },
        { label: "Total Cost", value: isJobsSyncing ? "--" : `$${realStats.totalCost.toFixed(4)}`, icon: DollarSign, sub: "Usage Spend" }
    ];

    if (authLoading || (!user && !userUid)) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center tech-grid scanline">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-cyan-500 tracking-[0.5em] uppercase">Securing Dimensional Link...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="text-slate-300 p-2 md:p-4 space-y-4 tech-grid scanline font-sans mt-2 lg:mt-0 overflow-x-hidden pb-20">

            {/* Top Navigation / Header Bar - Hidden on mobile if layout header is used */}
            <div className="hidden lg:flex flex-col sm:flex-row items-center justify-between border-b border-white/10 pb-4 mb-2 shrink-0 gap-4">
                <div className="flex items-center gap-4 md:gap-6 w-full sm:w-auto overflow-hidden">
                    <div className="flex items-center gap-3 shrink-0">
                        <img src="/ace-symbol.png" alt="ACEPLACE Symbol" className="h-12 w-auto object-contain" />
                        <span className="text-xl md:text-2xl font-black text-white italic tracking-tighter glitch-text">ACEPLACE</span>
                        <span className="text-lg md:text-xl font-bold text-white tracking-widest uppercase glitch-text">WORKSTATION</span>
                    </div>
                    <span className="hidden lg:block text-[10px] text-cyan-500/50 font-black tracking-[0.3em] uppercase border-l border-white/10 pl-6 border-cyan-500/20 whitespace-nowrap">AgentSpace Control Panel</span>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <SettingsModal isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />

                    <button
                        onClick={handleGlobalRefresh}
                        disabled={statsLoading || isJobsSyncing}
                        className="p-2 border border-white/5 hover:border-cyan-500/30 transition-all group scifi-clip bg-white/5 cursor-target"
                        title="Global Refresh"
                    >
                        <RotateCw className={cn("w-4 h-4 text-cyan-500/50 group-hover:text-cyan-500 transition-colors", (statsLoading || isJobsSyncing) && "animate-spin")} />
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="p-2 border border-rose-500/20 hover:border-rose-500/50 transition-all group scifi-clip bg-rose-500/5 cursor-target"
                        title="Lock Terminal"
                    >
                        <Lock className="w-4 h-4 text-rose-500/50 group-hover:text-rose-500 transition-colors" />
                    </button>

                    <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black tracking-widest text-white truncate max-w-[150px]">
                                {user?.email?.split('@')[0].toUpperCase() || "ADMINISTRATOR"}
                            </p>
                            <p className="text-[9px] text-cyan-500/50 uppercase tracking-tighter font-bold">
                                {user?.email || "ACEPLACE System User"}
                            </p>
                        </div>

                        <div className="group relative">
                            <HUDFrame variant="dark" className="p-0 border-cyan-500/30 overflow-hidden shrink-0" showRefLines={false}>
                                <Avatar className="h-9 w-9 md:h-10 md:w-10 rounded-none">
                                    <AvatarImage src="/avatar.jpg" />
                                    <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                                        {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                                    </AvatarFallback>
                                    <AvatarFallback className="bg-cyan-500/10 text-cyan-500">
                                        {user?.email?.substring(0, 2).toUpperCase() || "AD"}
                                    </AvatarFallback>
                                </Avatar>
                            </HUDFrame>

                            <button
                                onClick={handleSignOut}
                                className="absolute -top-1 -right-1 bg-rose-500 text-white p-1 rounded-none border border-rose-900 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                title="Terminate Session"
                            >
                                <LogOut className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Stats Segment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4 shrink-0">
                {statsConfig.map(stat => (
                    <HUDFrame key={stat.label} showRefLines={false} className="min-w-0 bg-cyan-950/10 border-white/5 cursor-target">
                        <div className="flex items-center gap-3 md:gap-4 w-full h-full min-w-0 overflow-hidden">
                            <div className="relative shrink-0 flex items-center justify-center">
                                <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-cyan-500 opacity-60" />
                                <div className="absolute -inset-1 bg-cyan-500/10 blur-sm rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                                <div className="flex items-baseline justify-between gap-2 w-full">
                                    <span className="text-[9px] md:text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 truncate" title={stat.label}>
                                        {stat.label}
                                    </span>
                                    {isJobsSyncing || isStatsSyncing ? (
                                        <div className="shrink-0 flex flex-col gap-1.5 justify-center ml-2">
                                            <div className="w-8 h-0.5 bg-cyan-900 overflow-hidden relative rounded-full">
                                                <div className="absolute inset-y-0 w-1/2 bg-cyan-400 opacity-80 animate-[ping_1.5s_infinite]" />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="shrink-0 text-lg md:text-xl font-black text-white italic ml-2">
                                            {stat.value}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[8px] uppercase text-cyan-500/40 font-bold tracking-[0.3em] leading-none mt-1 truncate" title={stat.sub}>
                                    {stat.sub}
                                </p>
                            </div>
                        </div>
                    </HUDFrame>
                ))}
            </div>

            {/* Runtime Engine Section */}
            <ErrorBoundary title="Runtime Engine">
                <HUDFrame
                    title="Runtime Engine"
                    subtitle="Deterministic Execution Monitor"
                    className="shrink-0 bg-purple-950/10 border-purple-500/10"
                    showRefLines={false}
                >
                    <div className="pt-2">
                        <RuntimeStats />
                    </div>
                </HUDFrame>
            </ErrorBoundary>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4 lg:pb-0">

                {/* Left Sidebar: MISSION QUEUE */}
                <div className="col-span-1 md:col-span-12 lg:col-span-2 flex flex-col h-auto lg:h-full lg:overflow-hidden order-2 lg:order-1 gap-4">
                    <HUDFrame
                        title="Mission Archive"
                        subtitle="Completed Tasks"
                        className="flex-1 overflow-y-auto scrollbar-hide overflow-x-hidden shrink-0"
                    >
                        <div className="space-y-3 pt-1">
                            {completedJobs.length > 0 ? completedJobs.map((job) => (
                                <div
                                    key={job.id || job.job_id}
                                    onClick={() => {
                                        router.push(`/dashboard/jobs/${job.job_id || job.id}`);
                                    }}
                                    className="group border border-white/5 p-2 md:p-3 flex items-center gap-3 md:gap-4 bg-white/5 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden cursor-target"
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-4 h-4 border border-emerald-500/50 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-80" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-400 truncate">{job.prompt}</span>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[7px] uppercase font-bold text-slate-600 tracking-tighter italic shrink-0">Status: {formatStatus(deriveHomeStatus(job))}</span>
                                            <span className="text-[7px] font-mono text-purple-500/60 uppercase truncate">{(() => { const raw = job.identity_fingerprint || job.identity_id; if (!raw) return "PENDING_REGISTRATION"; return "0x" + String(raw).replace(/^hex:0x|^0x|^hex:/i, ""); })()}</span>
                                            <span className="text-[6px] font-mono text-slate-700 tracking-tighter shrink-0">ID: {(job.job_id || job.id || "").slice(-6)}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-4 text-center border border-dashed border-white/5 text-[9px] uppercase font-black tracking-widest text-slate-600 italic">No completed tasks</div>
                            )}
                        </div>
                    </HUDFrame>
                    <HUDFrame
                        title="Mission Queue"
                        subtitle="Active Tasks"
                        className="flex-1 overflow-y-auto scrollbar-hide overflow-x-hidden shrink-0"
                        isProcessing={activeJobs.length > 0}
                        headerAction={
                            <button
                                onClick={handleGlobalRefresh}
                                disabled={isJobsSyncing}
                                className="p-1 hover:bg-white/5 rounded transition-colors group cursor-target"
                            >
                                <RotateCw className={cn("w-3 h-3 text-slate-500 group-hover:text-cyan-500", isJobsSyncing && "animate-spin")} />
                            </button>
                        }
                    >
                        <div className="space-y-3 pt-1">
                            {isJobsSyncing ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="group border border-cyan-500/20 p-2 md:p-3 flex items-center gap-3 bg-cyan-950/10 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/5 to-transparent w-[200%] animate-[pulse_2s_infinite]" />
                                        <div className="w-4 h-4 border border-cyan-500/30 flex items-center justify-center shrink-0">
                                            <RotateCw className="w-3 h-3 text-cyan-500/70 animate-spin" />
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1 justify-center gap-1.5">
                                            <div className="h-1.5 w-3/4 bg-cyan-500/20 rounded animate-pulse" />
                                            <div className="flex items-center justify-between">
                                                <div className="h-1 w-1/3 bg-cyan-500/20 rounded animate-pulse" />
                                                <div className="h-1 w-1/4 bg-cyan-500/20 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : activeJobs.length > 0 ? activeJobs.map((job, index) => (
                                <div
                                    key={job.job_id || job.id || `active-job-${index}`}
                                    onClick={() => {
                                        router.push(`/dashboard/jobs/${job.job_id || job.id}`);
                                    }}
                                    className={cn(
                                        "group border border-white/5 p-2 md:p-3 flex items-center gap-3 md:gap-4 bg-white/5 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden cursor-target",
                                        (job.status === 'in_progress' || job.status === 'executing') && "animate-breathing"
                                    )}
                                >
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-4 h-4 border border-cyan-500/50 flex items-center justify-center shrink-0">
                                        {job.status === "graded" ? <ShieldCheck className="w-3 h-3 text-orange-500" /> : <CheckCircle2 className="w-3 h-3 text-cyan-500 opacity-80" />}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-0.5">
                                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-cyan-400 truncate">{job.prompt}</span>
                                            {(() => {
                                                const env = jobEnvelopeMap.get(job.job_id || job.id || "");
                                                const chunks = env?.knowledge_context?.chunks_used || 0;
                                                const hasKb = env?.knowledge_context?.enabled;
                                                if (!hasKb) return null;
                                                return (
                                                    <div className="flex items-center gap-1.5 shrink-0" title={`${chunks} knowledge segments retrieved`}>
                                                        <div className="w-12 h-1 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] transition-all duration-1000"
                                                                style={{ width: `${Math.min((chunks / 10) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[7px] font-black text-cyan-400/80 font-mono">KB:{chunks}</span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[7px] uppercase font-bold text-slate-600 tracking-tighter italic shrink-0">Status: {formatStatus(deriveHomeStatus(job))}</span>
                                            <span className="text-[7px] font-mono text-purple-500/60 uppercase truncate">{(() => { const raw = job.identity_fingerprint || job.identity_id; if (!raw) return "PENDING_REGISTRATION"; return "0x" + String(raw).replace(/^hex:0x|^0x|^hex:/i, ""); })()}</span>
                                            <span className="text-[6px] font-mono text-slate-700 tracking-tighter shrink-0">ID: {(job.job_id || job.id || "").slice(-6)}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-4 text-center border border-dashed border-white/5 text-[9px] uppercase font-black tracking-widest text-slate-600 italic">No active missions sync'd</div>
                            )}
                        </div>
                    </HUDFrame>

                </div>

                {/* Center Canvas: AGENT OVERVIEW + ACTIVITY */}
                <div className="col-span-1 md:col-span-12 lg:col-span-7 space-y-4 flex flex-col h-auto lg:h-[800px] lg:h-full lg:overflow-hidden order-1 lg:order-2">

                    {/* Agent Overview Grid */}
                    <HUDFrame title="Agent Overview" subtitle="Live Node View" className="h-auto lg:min-h-[420px] lg:h-[420px] shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 h-full py-1">
                            {isStatsSyncing ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="border border-cyan-500/20 bg-cyan-950/10 h-full min-h-[200px] flex flex-col items-center justify-center p-4">
                                        <RotateCw className="w-10 h-10 text-cyan-500/30 animate-spin mb-4" />
                                        <div className="h-2 w-16 bg-cyan-500/20 rounded animate-pulse" />
                                    </div>
                                ))
                            ) : [
                                { name: "COO",        agentId: "agent_coo",        capability: "planning",    modelClass: "high_reasoning", gate: "Omega-V" },
                                { name: "Researcher", agentId: "agent_researcher",  capability: "research",     modelClass: "high_reasoning", gate: "Sigma-II" },
                                { name: "Worker",     agentId: "agent_worker",      capability: "execution",    modelClass: "standard",       gate: "Alpha-X" },
                                { name: "Grader",     agentId: "agent_grader",      capability: "evaluation",   modelClass: "standard",       gate: "Delta-VII" }
                            ].map((agent: { name: string; agentId: string; capability: string; modelClass: string; gate: string }, i) => (
                                <div
                                    key={agent.name}
                                    className="relative group border border-white/10 bg-black/60 overflow-hidden flex flex-col p-[1px] hover:border-cyan-500/40 transition-colors h-full min-h-[200px] lg:min-h-0 animate-in fade-in zoom-in-[0.5] slide-in-from-bottom-12 duration-1000"
                                    style={{ animationFillMode: 'backwards', animationDelay: `${i * 150}ms` }}
                                    onMouseEnter={() => setHoveredAgent(agent.name)}
                                    onMouseLeave={() => setHoveredAgent(null)}
                                >
                                    <div className="p-4 flex-1 space-y-1 z-10">
                                        <h3 className="text-xs font-black text-white italic uppercase tracking-[0.2em] border-b border-white/10 pb-2 mb-3">{agent.name}</h3>
                                        <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest leading-relaxed">Capability: <br /><span className="text-cyan-300">{agent.capability}</span></p>
                                        <p className="text-[8px] uppercase text-slate-500 font-bold tracking-widest mt-1 leading-relaxed">Model Class: <br /><span className="text-amber-400/80">{agent.modelClass}</span></p>
                                        <p className="text-[9px] uppercase text-slate-500 font-bold tracking-widest mt-2 leading-relaxed">Status: <br /><span className="text-emerald-400">AVAILABLE</span> — {agent.gate}</p>
                                        {/* Per-agent identity sub-panel */}
                                        <AgentIdentityMini agentId={agent.agentId} />
                                    </div>

                                    {/* High-Tech Node Core */}
                                    <div className="mt-auto p-4 flex flex-col items-center relative z-10 cursor-target">
                                        <div className={cn("w-16 h-16 md:w-20 md:h-20 relative flex items-center justify-center transition-transform duration-700", hoveredAgent === agent.name && "scale-110")}>
                                            {agent.name === "COO" && (() => {
                                                const isHovered = hoveredAgent === "COO";
                                                return (
                                                    <>
                                                        {/* COO: Command Center Shape */}
                                                        <div className={cn("absolute inset-0 blur-xl transition-opacity animate-breathing bg-blue-500", isHovered ? "opacity-60" : "opacity-20")} />
                                                        <div
                                                            className="absolute inset-0 border-2 border-blue-500/30 shadow-[0_0_15px_#3b82f6] animate-spin transition-colors duration-1000"
                                                            style={{ animationDuration: isHovered ? "4s" : "10s", borderColor: isHovered ? "rgb(96,165,250)" : undefined }}
                                                        />
                                                        <div
                                                            className="absolute inset-2 border border-dashed border-cyan-400/50 animate-spin transition-colors duration-1000"
                                                            style={{ animationDuration: isHovered ? "5s" : "15s", animationDirection: "reverse", borderColor: isHovered ? "rgb(103,232,249)" : undefined }}
                                                        />
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center animate-spin"
                                                            style={{ animationDuration: isHovered ? "3s" : "12s" }}
                                                        >
                                                            <div className={cn("w-4 h-4 shadow-[0_0_15px_#3b82f6] rotate-45 transition-colors duration-500 animate-breathing", isHovered ? "bg-cyan-300 scale-150" : "bg-blue-400")} />
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                            {agent.name === "Researcher" && (() => {
                                                const isHovered = hoveredAgent === "Researcher";
                                                return (
                                                    <>
                                                        {/* Researcher: Radar / Scanner Shape */}
                                                        <div className={cn("absolute inset-0 blur-xl transition-opacity animate-breathing bg-purple-500", isHovered ? "opacity-60" : "opacity-20")} />
                                                        <div className="absolute inset-0 rounded-full border border-purple-500/50 shadow-[0_0_15px_#a855f7] animate-breathing" />
                                                        <div
                                                            className="absolute inset-0 rounded-full border-t-2 border-r-2 animate-spin transition-opacity duration-1000"
                                                            style={{ animationDuration: isHovered ? "2s" : "8s", borderColor: isHovered ? "rgb(216,180,254)" : "rgb(196,181,253,0.5)", opacity: isHovered ? 1 : 0.3 }}
                                                        />
                                                        <div
                                                            className="absolute inset-2 rounded-full border border-dotted animate-spin transition-colors duration-700"
                                                            style={{ animationDuration: isHovered ? "3s" : "12s", animationDirection: "reverse", borderColor: isHovered ? "rgb(240,171,252)" : "rgb(232,121,249,0.4)", opacity: isHovered ? 1 : 0.5 }}
                                                        />
                                                        <div className={cn("relative w-3 h-3 rounded-full shadow-[0_0_15px_#a855f7] transition-all duration-500 animate-breathing", isHovered ? "bg-fuchsia-300 scale-150" : "bg-purple-400")} />
                                                    </>
                                                );
                                            })()}
                                            {agent.name === "Worker" && (() => {
                                                const isHovered = hoveredAgent === "Worker";
                                                return (
                                                    <>
                                                        {/* Worker: Industrial / Gear / Block Shape */}
                                                        <div className={cn("absolute inset-0 blur-xl transition-opacity animate-breathing bg-amber-500", isHovered ? "opacity-60" : "opacity-20")} />
                                                        <div
                                                            className="absolute inset-1 rounded-sm border-2 border-amber-500/40 shadow-[0_0_15px_#f59e0b] animate-spin transition-colors duration-700"
                                                            style={{ animationDuration: isHovered ? "5s" : "20s", borderColor: isHovered ? "rgb(251,191,36)" : undefined, opacity: isHovered ? 1 : 0.6 }}
                                                        />
                                                        <div
                                                            className="absolute inset-1 rounded-sm border-2 border-orange-500/40 animate-spin transition-colors duration-700"
                                                            style={{ animationDuration: isHovered ? "5s" : "20s", animationDirection: "reverse", borderColor: isHovered ? "rgb(249,115,22)" : undefined, opacity: isHovered ? 1 : 0.6 }}
                                                        />
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center w-5 h-5 m-auto animate-spin transition-all duration-500"
                                                            style={{ animationDuration: isHovered ? "2s" : "10s" }}
                                                        >
                                                            <div className="absolute inset-0 border-2 border-amber-300" />
                                                            <div className="w-1.5 h-1.5 bg-amber-200 shadow-[0_0_10px_#fcd34d] animate-breathing" />
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                            {agent.name === "Grader" && (() => {
                                                const isHovered = hoveredAgent === "Grader";
                                                return (
                                                    <>
                                                        {/* Grader: Evaluator / Precise Crosshair */}
                                                        <div className={cn("absolute inset-0 blur-xl transition-opacity animate-breathing bg-emerald-500", isHovered ? "opacity-60" : "opacity-20")} />
                                                        <div className="absolute inset-0 rounded-full border border-emerald-500/40 shadow-[0_0_15px_#10b981] animate-breathing" />
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center animate-spin transition-opacity duration-500"
                                                            style={{ animationDuration: isHovered ? "3s" : "15s", opacity: isHovered ? 1 : 0.4 }}
                                                        >
                                                            <div className="w-full h-[1px] bg-emerald-400 absolute" />
                                                            <div className="h-full w-[1px] bg-emerald-400 absolute" />
                                                        </div>
                                                        <div
                                                            className="absolute inset-3 border border-emerald-300/60 animate-spin transition-colors duration-700"
                                                            style={{ animationDuration: isHovered ? "2s" : "10s", animationDirection: "reverse", opacity: isHovered ? 1 : 0.7 }}
                                                        />
                                                        <div className={cn("relative w-2 h-2 bg-emerald-300 shadow-[0_0_10px_#6ee7b7] transition-all duration-500 animate-[pulse_2s_infinite]", isHovered && "scale-[2.5]")} />
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        <div className={cn(
                                            "h-[1.5px] mt-4 transition-all duration-700 relative",
                                            hoveredAgent === agent.name ? "w-full opacity-100" : "w-[80px] opacity-40",
                                            agent.name === "COO" ? "bg-gradient-to-r from-transparent via-blue-500 to-transparent" :
                                                agent.name === "Researcher" ? "bg-gradient-to-r from-transparent via-purple-500 to-transparent" :
                                                    agent.name === "Worker" ? "bg-gradient-to-r from-transparent via-amber-500 to-transparent" :
                                                        "bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
                                        )}>
                                            <div className={cn(
                                                "absolute inset-0 blur-[3px] animate-breathing",
                                                agent.name === "COO" ? "bg-blue-500" :
                                                    agent.name === "Researcher" ? "bg-purple-500" :
                                                        agent.name === "Worker" ? "bg-amber-500" :
                                                            "bg-emerald-500"
                                            )} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </HUDFrame>

                    {/* Agent Activity Log */}
                    <HUDFrame
                        title="Agent Activity Log"
                        className="flex-1 overflow-hidden min-h-[300px] lg:min-h-0"
                        headerAction={
                            <button
                                onClick={refreshJobs}
                                disabled={jobsRefreshing}
                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-cyan-400 transition-colors mr-4 cursor-target"
                            >
                                <RotateCw className={cn("w-3 h-3", jobsRefreshing && "animate-spin")} />
                                Refresh Terminal
                            </button>
                        }
                    >
                        <div className="w-full min-h-full pr-2 custom-scroll relative">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead className="sticky top-0 bg-black/80 z-20">
                                    <tr className="border-b border-white/10">
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500">Project ID</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500">Envelope ID</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500">Role</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500">Task</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500">Status</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500 text-cyan-500/80">Grader Score</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-purple-500/80">Agent Fingerprint</th>
                                        <th className="py-2 text-[9px] uppercase font-black tracking-widest text-slate-500">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {isJobsSyncing ? (
                                        Array.from({ length: 6 }).map((_, i) => (
                                            <tr key={i} className="border-b border-cyan-500/10 bg-cyan-950/5 relative overflow-hidden">
                                                <td colSpan={8} className="p-0">
                                                    <div className="flex items-center px-4 py-3 gap-4">
                                                        <div className="w-12 h-2 bg-cyan-500/20 rounded animate-pulse" />
                                                        <div className="w-24 h-2 bg-cyan-500/20 rounded animate-pulse" />
                                                        <div className="w-16 h-2 bg-cyan-500/20 rounded animate-pulse" />
                                                        <div className="flex-1 h-2 bg-cyan-500/10 rounded animate-pulse" />
                                                        <div className="w-12 h-4 border border-cyan-500/20 bg-cyan-500/5 rounded animate-pulse" />
                                                        <div className="w-8 h-2 bg-cyan-500/20 rounded animate-pulse" />
                                                        <div className="w-12 h-2 bg-cyan-500/20 rounded animate-pulse" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : jobs.length > 0 ? jobs.map((job) => (
                                        <tr
                                            key={job.job_id || job.id}
                                            onClick={() => {
                                                router.push(`/dashboard/jobs/${job.job_id || job.id}`);
                                            }}
                                            className="group hover:bg-white/5 transition-colors cursor-pointer cursor-target"
                                        >
                                            <td className="py-3 text-[10px] font-mono text-cyan-500/80 tracking-tighter">
                                                {(job.job_id || job.id || "").slice(-6)}
                                            </td>
                                            <td className="py-3 text-[10px] font-mono text-purple-400/80 tracking-tighter">
                                                {job.execution_id || job.envelope_id || "--"}
                                            </td>
                                            <td className="py-3 text-[10px] font-black text-slate-400 tracking-widest uppercase">
                                                {job.agent_role || job.job_type || "CORE"}
                                            </td>
                                            <td className="py-3 text-[10px] font-bold text-slate-300 truncate max-w-[120px]">
                                                {job.prompt}
                                            </td>
                                            <td className="py-3 text-nowrap">
                                                <span className={cn(
                                                    "px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border",
                                                    statusColorMap[deriveHomeStatus(job)] || "text-cyan-500 border-cyan-500/30 bg-cyan-500/5"
                                                )}>
                                                    {formatStatus(deriveHomeStatus(job))}
                                                </span>
                                            </td>
                                            <td className="py-3">
                                                {(() => {
                                                    // Parse grading_result — may be object, stringified JSON, or nested
                                                    let gr = job?.grading_result;
                                                    if (typeof gr === 'string') { try { gr = JSON.parse(gr); } catch { gr = null; } }
                                                    let rtGr = job?.runtime_context?.grading_result;
                                                    if (typeof rtGr === 'string') { try { rtGr = JSON.parse(rtGr); } catch { rtGr = null; } }

                                                    // Also check grader step artifacts embedded in job.steps[]
                                                    let stepGr: any = null;
                                                    const steps: any[] = (job as any)?.steps ?? [];
                                                    const graderStep = steps.find((s: any) => s?.step_type === 'evaluation' && s?.status === 'completed');
                                                    if (graderStep?.output_ref) {
                                                        // output_ref is an artifact ID — content not inline, skip
                                                    }
                                                    // Check grading_result inside steps output if available inline
                                                    if (graderStep?.result) {
                                                        stepGr = typeof graderStep.result === 'string' ? (() => { try { return JSON.parse(graderStep.result); } catch { return null; } })() : graderStep.result;
                                                    }

                                                    const govScoreRaw = job?.grade_score ??
                                                        gr?.overall_score ??
                                                        gr?.score ??
                                                        gr?.value ??
                                                        rtGr?.overall_score ??
                                                        rtGr?.score ??
                                                        rtGr?.value ??
                                                        stepGr?.overall_score ??
                                                        stepGr?.score ??
                                                        gr?.compliance_score ??
                                                        job?.compliance_score ??
                                                        job?.grader_params?.score;

                                                    if (govScoreRaw === undefined || govScoreRaw === null) {
                                                        return <span className="text-[10px] text-slate-700 italic font-bold">--</span>;
                                                    }

                                                    let score = typeof govScoreRaw === 'object' ? ((govScoreRaw as any).value || 0) : Number(govScoreRaw);
                                                    if (score <= 10 && score > 0) score = score * 10;

                                                    const gradeLabel = job?.grade_label || gr?.grade || stepGr?.grade || (score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F");

                                                    return (
                                                        <span className={cn(
                                                            "text-[10px] font-black tracking-tighter",
                                                            score >= 70 ? "text-emerald-500" : score >= 50 ? "text-amber-500" : "text-rose-500"
                                                        )}>
                                                            {Math.round(score)}/100 <span className="text-[8px] opacity-70">({gradeLabel})</span>
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="py-3 text-[9px] font-mono text-purple-400/70 tracking-tighter max-w-[100px] truncate" title={(() => { const raw = job.identity_fingerprint || job.identity_id; return raw ? "0x" + String(raw).replace(/^hex:0x|^0x|^hex:/i, '') : undefined; })()}>
                                                {(() => { const raw = job.identity_fingerprint || job.identity_id; if (!raw) return <span className="text-slate-700 italic">PENDING_REGISTRATION</span>; return "0x" + String(raw).replace(/^hex:0x|^0x|^hex:/i, ''); })()}
                                            </td>
                                            <td className="py-3 text-[9px] font-mono text-slate-500 italic">
                                                {(() => {
                                                    const date = parseFirestoreDate(job.updated_at || job.created_at);
                                                    return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently";
                                                })()}
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr key="empty-logs">
                                            <td colSpan={8} className="py-12 text-center text-[9px] uppercase font-black tracking-[0.3em] text-slate-600 italic">
                                                Trace logs empty. Initialize dimensionality.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </HUDFrame>

                    {/* Real-time Execution Trace Stream */}
                    <ErrorBoundary title="Trace Stream">
                        <TraceStreamPanel
                            userId={userUid}
                            maxItems={50}
                            className="flex-none shrink-0"
                        />
                    </ErrorBoundary>
                </div>

                {/* Right Sidebar: COMMAND + MONITOR */}
                <div className="col-span-1 md:col-span-12 lg:col-span-3 space-y-4 flex flex-col h-auto lg:h-full lg:overflow-hidden order-3 min-h-0">

                    {/* Agent Identity Roster — all 4 agents */}
                    <ErrorBoundary title="Agent Identity Roster">
                        <AgentIdentityRoster />
                    </ErrorBoundary>

                    {/* Lease Manager */}
                    <ErrorBoundary title="Lease Manager">
                        <LeaseManager />
                    </ErrorBoundary>

                    {/* ACEPLACE COMMAND */}
                    <HUDFrame title="ACEPLACE COMMAND" className="min-h-[300px] lg:min-h-[350px] flex-none shrink-0 flex flex-col relative overflow-hidden group">
                        {/* Background subtle glow */}
                        <div className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-[180%] bg-cyan-500/10 blur-[80px] rounded-full transition-opacity duration-1000", isSpeaking ? "opacity-100" : "opacity-0")} />

                        <div
                            className="flex-1 flex flex-col items-center justify-center relative z-10 cursor-target p-4"
                            onClick={() => setIsSpeaking(!isSpeaking)}
                        >
                            {/* Premium Glow Orb */}
                            <div className="relative flex items-center justify-center mb-6 transition-transform duration-700 group-hover:scale-105 active:scale-95">
                                <div className="w-32 h-32 md:w-40 md:h-40 relative flex items-center justify-center">
                                    {/* Pulse ring when scanning */}
                                    <div className={cn("absolute inset-0 rounded-full border border-cyan-500/30 transition-all duration-1000", isSpeaking ? "scale-125 opacity-0 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] shadow-[0_0_30px_rgba(6,182,212,0.3)]" : "scale-100 opacity-100")} />

                                    <AceWaveform
                                        isSpeaking={isSpeaking}
                                        className="w-full h-full"
                                    />
                                </div>
                            </div>

                            {/* Label & Dynamic Status Matrix */}
                            <div className="mt-auto flex flex-col items-center w-full">
                                <div className="text-center transition-all duration-500 group-hover:drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                                    <h4 className="text-xl md:text-2xl font-black text-white tracking-[0.25em] flex items-baseline justify-center gap-1">
                                        ACEPLACE VOICE COMMAND<span className="text-[10px] align-top font-bold text-cyan-500/80">™</span>
                                    </h4>
                                </div>

                                <div className="h-6 mt-2 relative w-full flex justify-center items-center overflow-hidden">
                                    {/* Dynamic visualizer shown only when active */}
                                    <div className={cn("absolute inset-y-0 flex gap-1 items-end justify-center transition-all duration-500", isSpeaking ? "opacity-100 scale-100" : "opacity-0 scale-90 translate-y-4")}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]"
                                                style={{
                                                    height: isSpeaking ? `${40 + Math.random() * 60}%` : '20%',
                                                    animationDelay: `${i * 0.1}s`,
                                                    animationDuration: '0.6s'
                                                }}
                                            />
                                        ))}
                                    </div>

                                    {/* Standby prompt */}
                                    <p className={cn(
                                        "absolute inset-y-0 flex items-center justify-center text-[10px] font-bold tracking-[0.15em] transition-all duration-500 uppercase",
                                        isSpeaking ? "text-cyan-400 opacity-0 -translate-y-4" : "text-slate-500 opacity-80 translate-y-0"
                                    )}>
                                        Ready for voice routing
                                    </p>
                                </div>

                                <p className="mt-4 text-[8px] uppercase text-cyan-500/30 font-black tracking-[0.4em] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">Tap Orb to Initialize</p>
                            </div>
                        </div>
                    </HUDFrame>

                    {/* System Monitor */}
                    <HUDFrame title="System Monitor" className="flex-1 space-y-4 overflow-y-auto scrollbar-hide overflow-x-hidden">
                        <div className="space-y-4 pt-5">
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">Total Compute Node</span>
                                <span className="text-sm font-black text-white italic">{isJobsSyncing ? "--" : realStats.totalRequests} <span className="text-slate-700">/ 100</span></span>
                            </div>
                            <div className="h-1 bg-white/5 border border-white/5 relative overflow-hidden">
                                <div
                                    className="absolute inset-y-0 left-0 bg-cyan-500 shadow-[0_0_10px_#06b6d4] transition-all duration-500"
                                    style={{ width: `${isJobsSyncing ? 0 : Math.min(100, (realStats.totalRequests / 100) * 100)}%` }}
                                />
                            </div>

                            <div className="flex justify-between items-end">
                                <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">Active Agents</span>
                                <div className="flex gap-[1px] md:gap-[2px]">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-[4px] md:w-[6px] h-3 transition-colors duration-500",
                                                !isJobsSyncing && i < (realStats.activeAgents / Math.max(1, realStats.totalRequests)) * 15 ? (i < 10 ? "bg-cyan-500 shadow-[0_0_5px_#06b6d2]" : "bg-emerald-500 shadow-[0_0_5px_#10b981]") : "bg-white/5"
                                            )}
                                        />
                                    ))}
                                    <span className="text-[9px] md:text-[10px] font-black text-white ml-2 tracking-tighter self-center whitespace-nowrap">
                                        {isJobsSyncing ? "-- / --" : `${realStats.activeAgents} / ${realStats.totalRequests}`}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-[9px] uppercase font-black tracking-widest text-slate-500">Gate Level Access</span>
                                <div className="flex justify-between text-[9px] md:text-[10px] font-black text-slate-500 border border-white/5 p-2 bg-black/20">
                                    {Array.from({ length: 9 }).map((_, i) => (
                                        <span key={i} className={i < parseInt(realStats.tasksCompleted) ? "text-cyan-500 glow-text" : ""}>{i + 1}</span>
                                    ))}
                                </div>
                            </div>

                            <div className={cn(
                                "flex items-center gap-3 p-3 border group transition-all",
                                realStats.continuityAlert
                                    ? "bg-rose-500/10 border-rose-500/50 hover:bg-rose-500/20 cursor-help"
                                    : "bg-emerald-500/5 border-emerald-500/20"
                            )}>
                                {realStats.continuityAlert ? (
                                    <>
                                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-500">Continuity Alerts</span>
                                        <div className="ml-auto w-1.5 h-1.5 bg-rose-500 animate-ping rounded-full" />
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-500">Systems Nominal</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </HUDFrame>

                    {/* Diagnostic terminal */}
                    <HUDFrame
                        title="Diagnostic Terminal"
                        className="h-[250px] flex flex-col overflow-hidden"
                        headerAction={
                            <button
                                onClick={handleCopyTerminalLogs}
                                className="p-1.5 hover:bg-white/5 rounded transition-colors group flex items-center gap-2 border border-white/5 bg-black/20 cursor-target"
                                title="Copy Diagnostic Logs"
                            >
                                <Clipboard className="w-3 h-3 text-slate-500 group-hover:text-cyan-500" />
                                <span className="text-[7px] uppercase font-black text-slate-500 group-hover:text-cyan-500">Copy Logs</span>
                            </button>
                        }
                    >
                        <div className="flex-1 overflow-y-auto scrollbar-hide font-mono text-[9px] p-2 space-y-1 bg-black/40 border border-white/5 scifi-clip-sm mt-4">
                            {logs.length > 0 ? logs.map((log, i) => (
                                <div key={i} className={cn(
                                    "border-l-2 pl-2 py-0.5 leading-relaxed break-all",
                                    log.includes("[ERROR]") || log.includes("[CRITICAL]") ? "border-rose-500 text-rose-400 bg-rose-500/5" :
                                        log.includes("[SUCCESS]") ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" :
                                            log.includes("[RETRY]") ? "border-amber-500 text-amber-400 bg-amber-500/5" :
                                                "border-cyan-500/30 text-cyan-400/70"
                                )}>
                                    {log}
                                </div>
                            )) : (
                                <div className="text-slate-600 italic">No diagnostic events recorded.</div>
                            )}
                            <div className="h-4" /> {/* Spacer for bottom scroll padding */}
                        </div>
                    </HUDFrame>
                </div>
            </div>

            {/* Footer Segment: AGENTSPACE STATUS */}
            <HUDFrame title="AgentSpace Status" className="h-auto lg:h-[90px] shrink-0 bg-cyan-950/20 py-2 lg:py-0">
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 h-full">
                    {/* Stats boxes in footer */}
                    {[
                        { label: "Total Requests", value: isJobsSyncing || isStatsSyncing ? "--" : realStats.totalRequests.toString(), icon: Hash, color: "text-cyan-400" },
                        { label: "Tasks Completed", value: isJobsSyncing || isStatsSyncing ? "--" : realStats.tasksCompleted, icon: CheckCircle2, color: "text-blue-400" },
                        { label: "Failed Tasks", value: isJobsSyncing || isStatsSyncing ? "--" : realStats.failedTasks, icon: AlertTriangle, color: "text-purple-400" },
                        { label: "Active Tasks", value: isJobsSyncing || isStatsSyncing ? "--" : realStats.activeAgents.toString(), icon: Activity, color: "text-emerald-400" },
                        { label: "Continuity Restores", value: isJobsSyncing || isStatsSyncing ? "--" : realStats.resurrectionEvents.toString(), icon: RotateCw, color: "text-blue-400" }
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-3 md:gap-4 px-2 md:px-4 border-r border-white/5 last:border-0 group cursor-pointer hover:bg-white/5 transition-all h-full min-h-[60px] lg:min-h-0 cursor-target">
                            <div className="p-2 bg-white/5 group-hover:bg-cyan-500/10 transition-colors shrink-0">
                                <item.icon className={cn("w-4 h-4 md:w-5 md:h-5", item.color)} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[7px] md:text-[8px] uppercase text-slate-500 font-bold tracking-widest truncate">{item.label}</p>
                                {isJobsSyncing || isStatsSyncing ? (
                                    <div className="mt-1.5 flex items-center">
                                        <div className="w-10 h-0.5 bg-cyan-900 overflow-hidden relative rounded-full">
                                            <div className="absolute inset-y-0 w-1/2 bg-cyan-400 animate-[ping_1.5s_infinite]" />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-base md:text-lg font-black text-white italic leading-none">{item.value}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </HUDFrame>

            {/* Task Composer Modal */}
            {isComposerOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                        onClick={() => setIsComposerOpen(false)}
                    />

                    {/* Modal Content */}
                    <div className="relative w-full max-w-2xl animate-in zoom-in-95 duration-300">
                        <HUDFrame title="Task Orchestration" showRefLines={true}>
                            <div className="relative">
                                <button
                                    onClick={() => setIsComposerOpen(false)}
                                    className="absolute -top-12 -right-4 p-2 text-slate-500 hover:text-white transition-colors cursor-target"
                                >
                                    <X className="w-6 h-6" />
                                </button>

                                <div className="p-4 custom-scroll max-h-[80vh] overflow-y-auto">
                                    <TaskComposer
                                        onSuccess={(jobId) => {
                                            // Close modal and refresh jobs list without redirecting
                                            setIsComposerOpen(false);
                                            refreshJobs();
                                        }}
                                    />
                                </div>
                            </div>
                        </HUDFrame>
                    </div>
                </div>
            )}

            {/* Task Detail Modal */}
            {selectedJob && (
                <TaskDetail
                    job={selectedJob}
                    userId={userUid}
                    onClose={() => setSelectedJob(null)}
                    onUpdate={updateJobInList}
                />
            )}
        </div>
    );
}
