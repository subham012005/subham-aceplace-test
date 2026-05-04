"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Terminal, AlertCircle, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { aceApi } from "@/lib/api-client";
import { SciFiFrame } from "@/components/SciFiFrame";
import { KnowledgeBasePanel, type Phase3Context } from "@/components/KnowledgeBasePanel";

interface TaskComposerProps {
    onSuccess?: (jobId?: string) => void;
    className?: string;
}

export function TaskComposer({ onSuccess, className }: TaskComposerProps) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [task, setTask] = useState("");

    // Phase 3 context
    const [phase3Ctx, setPhase3Ctx] = useState<Phase3Context>({
        knowledge_collections: [],
        instruction_profiles: [],
        web_search_enabled: true,
    });

    // Sync knowledge from localStorage on mount
    React.useEffect(() => {
        try {
            const STORAGE_KEYS = {
                COLLECTIONS: "ace_kb_selected_collections",
                PROFILES: "ace_kb_selected_profiles",
                DIRECT_TEXT: "ace_kb_direct_text_draft",
                SNIPPETS: "ace_kb_selected_snippets"
            };

            const savedColls = localStorage.getItem(STORAGE_KEYS.COLLECTIONS);
            const savedProfs = localStorage.getItem(STORAGE_KEYS.PROFILES);
            const savedDirect = localStorage.getItem(STORAGE_KEYS.DIRECT_TEXT);
            const savedSnips = localStorage.getItem(STORAGE_KEYS.SNIPPETS);

            const collections = savedColls ? JSON.parse(savedColls) : [];
            const profiles = savedProfs ? JSON.parse(savedProfs) : [];
            const directText = savedDirect || "";
            const snippetIds = savedSnips ? JSON.parse(savedSnips) : [];

            // We don't have the snippets content here easily without fetching, 
            // but the dispatch logic handles the IDs/text we provide.
            // Actually, the panel handles joining snippets into direct_text.
            // For now, let's just ensure we have the IDs and basic text.
            
            setPhase3Ctx(prev => ({
                ...prev,
                knowledge_collections: Array.isArray(collections) ? collections : [],
                instruction_profiles: Array.isArray(profiles) ? profiles : [],
                direct_text: directText
            }));
        } catch (e) {
            console.error("Failed to sync knowledge in composer", e);
        }
    }, []);

    const maxChars = 2000;
    const charPercentage = Math.min((task.length / maxChars) * 100, 100);

    const handlePhase3Change = useCallback((ctx: Phase3Context) => {
        setPhase3Ctx(ctx);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!task.trim()) return;

        setIsSubmitting(true);
        setError(null);
        setSuccess(false);

        try {
            const { auth } = await import("@/lib/firebase");
            const userId = auth.currentUser?.uid;

            if (!userId) {
                throw new Error("Authorization required for agent dispatch.");
            }

            const generatedJobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            const hasDirectText = !!phase3Ctx.direct_text?.trim();
            const knowledgeContext = {
                collections: phase3Ctx.knowledge_collections,
                direct_text: phase3Ctx.direct_text,
                enabled: phase3Ctx.knowledge_collections.length > 0 || hasDirectText,
            };
            const instructionContext = {
                profiles: phase3Ctx.instruction_profiles,
                enabled: phase3Ctx.instruction_profiles.length > 0,
            };
            const webSearchContext = {
                enabled: true, // always on
                queries: [],
                sources_used: [],
            };

            await aceApi.dispatchFromDashboard({
                root_task: task,
                job_id: generatedJobId,
                execution_policy: { entry_agent: "agent_coo" },
                knowledge_context: knowledgeContext,
                instruction_context: instructionContext,
                web_search_context: webSearchContext,
            });

            import("@/lib/user-stats").then(({ incrementUserRequestCount }) => {
                incrementUserRequestCount(userId).catch(console.error);
            });

            if (onSuccess) onSuccess(generatedJobId);

            setSuccess(true);
            setTask("");

            setTimeout(() => {
                router.push(`jobs/${generatedJobId}`);
            }, 1000);

        } catch (err: unknown) {
            const error = err as Error;
            console.error("Orchestration failed:", error);
            setError(error.message || "Dimensional link failed. Check workflow engine status.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={cn("space-y-3", className)}>
            <form onSubmit={handleSubmit} className="space-y-3">
                <SciFiFrame
                    title="Tactical Command Orchestrator"
                    variant="glass"
                    className="overflow-hidden"
                >
                    {/* HUD Header */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-cyan-500/5 mb-4 -mx-4 -mt-2">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_#06b6d4]" />
                                <span className="text-[9px] font-black text-white tracking-widest uppercase italic">Link: Synced</span>
                            </div>
                            <div className="h-3 w-[1px] bg-white/10" />
                            <span className="text-[8px] font-bold text-slate-500 tracking-widest uppercase">Latency: 24ms</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-bold text-cyan-500/60 tracking-widest uppercase">Encryption:</span>
                                <span className="text-[9px] font-black text-cyan-400 tracking-tighter">RSA_OMEGA_4096</span>
                            </div>
                            <div className="h-3 w-[1px] bg-white/10" />
                            <span className="text-[8px] font-bold tracking-widest uppercase text-amber-400">
                                Deterministic Runtime ON
                            </span>
                        </div>
                    </div>

                    <div className="space-y-6 py-2">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[9px] uppercase font-black tracking-[0.2em] text-cyan-500/70 flex items-center gap-2">
                                    <Terminal className="w-3 h-3" />
                                    Direct Command Sequence
                                </label>
                                <div className="flex items-center gap-3">
                                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Buffer Status</span>
                                    <div className="w-24 h-1 bg-white/5 border border-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-500",
                                                charPercentage > 90 ? "bg-rose-500" : "bg-cyan-500 shadow-[0_0_8px_#06b6d4]"
                                            )}
                                            style={{ width: `${charPercentage}%` }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="relative group">
                                <textarea
                                    required
                                    placeholder="Enter strategic instructions for the COO Agent..."
                                    value={task}
                                    onChange={(e) => setTask(e.target.value)}
                                    rows={8}
                                    className="w-full bg-slate-950/60 border border-white/10 scifi-clip px-5 py-4 text-sm font-mono text-cyan-400 placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/50 transition-all resize-none shadow-inner"
                                />
                                <div className="absolute top-2 right-2 flex gap-1.5 opacity-30">
                                    <div className="w-1 h-3 bg-cyan-500/50" />
                                    <div className="w-1 h-3 bg-cyan-500/20" />
                                </div>
                                <div className="absolute bottom-4 right-4 text-[8px] font-mono text-cyan-500/20 pointer-events-none select-none">
                                    CMD_ID: {Math.random().toString(16).slice(2, 10).toUpperCase()}
                                </div>
                            </div>
                        </div>

                        {/* Phase 3 context summary badge */}
                        {(phase3Ctx.knowledge_collections.length > 0 || phase3Ctx.instruction_profiles.length > 0 || !!phase3Ctx.direct_text?.trim()) && (
                            <div className="flex items-center gap-3 px-3 py-2 bg-cyan-500/5 border border-cyan-500/20 text-[9px]">
                                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <span className="text-cyan-400 font-bold">Grounding active:</span>
                                <span className="text-slate-400 font-mono">
                                    🌐 Web Search
                                    {phase3Ctx.direct_text?.trim() && ` · ⚡ Direct Knowledge`}
                                    {phase3Ctx.knowledge_collections.length > 0 && ` · 📚 ${phase3Ctx.knowledge_collections.length} KB collection${phase3Ctx.knowledge_collections.length > 1 ? "s" : ""}`}
                                    {phase3Ctx.instruction_profiles.length > 0 && ` · 📋 ${phase3Ctx.instruction_profiles.length} instruction${phase3Ctx.instruction_profiles.length > 1 ? "s" : ""}`}
                                </span>
                                <button 
                                    type="button"
                                    onClick={() => router.push("/dashboard/knowledge")}
                                    className="ml-auto text-[8px] font-black text-cyan-500 hover:text-cyan-400 uppercase tracking-widest border-b border-cyan-500/30 transition-colors"
                                >
                                    Manage
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-4 p-4 bg-rose-500/10 border border-rose-500/20 scifi-clip animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                                <p className="text-[9px] text-rose-400 uppercase leading-relaxed font-black tracking-wider">
                                    DISPATCH FAILURE: {error}
                                </p>
                            </div>
                        )}

                        <div className="flex items-start gap-4 p-4 bg-cyan-500/5 border border-white/5 scifi-clip relative overflow-hidden group">
                            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
                            <Zap className="w-5 h-5 text-cyan-500 shrink-0 animate-pulse mt-0.5" />
                            <div>
                                <p className="text-[9px] text-slate-400 uppercase leading-relaxed font-bold tracking-tight">
                                    <span className="text-cyan-500 font-black">Strategic Guidance:</span> Parameters are non-blocking. The COO will orchestrate Researcher and Worker agents autonomously after deployment.
                                </p>
                            </div>
                        </div>

                        <div className="pt-2 px-1">
                            <button
                                disabled={isSubmitting || !task.trim()}
                                className={cn(
                                    "w-full py-6 scifi-clip text-xs font-black uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-4 active:scale-[0.98] cursor-target overflow-hidden relative group/btn",
                                    success
                                        ? "bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                                        : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_40px_rgba(6,182,212,0.3)] disabled:bg-slate-900 disabled:text-slate-600 disabled:shadow-none disabled:border-slate-800",
                                    isSubmitting && "opacity-50 cursor-not-allowed",
                                    success && "animate-pulse-fast"
                                )}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out" />
                                {success && <div className="absolute inset-0 bg-white animate-out fade-out duration-700 pointer-events-none z-50" />}

                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        <span>Transmitting...</span>
                                    </>
                                ) : success ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" />
                                        <span>Agent Dispatched</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                                        <span className="glitch-text">Launch Tactical Agent</span>
                                    </>
                                )}
                            </button>

                            <div className="mt-4 flex items-center justify-between px-2">
                                <div className="flex gap-1">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                "w-3 h-1 rounded-full transition-colors duration-500",
                                                task.length > 0 ? "bg-cyan-500/40" : "bg-white/5"
                                            )}
                                            style={{ transitionDelay: `${i * 100}ms` }}
                                        />
                                    ))}
                                </div>
                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">Deploy readiness: {task.trim() ? "READY" : "STANDBY"}</span>
                            </div>
                        </div>
                    </div>
                </SciFiFrame>
            </form>

            {/* Knowledge Management Shortcut if none selected */}
            {!(phase3Ctx.knowledge_collections.length > 0 || phase3Ctx.instruction_profiles.length > 0 || !!phase3Ctx.direct_text?.trim()) && (
                <div 
                    onClick={() => router.push("/dashboard/knowledge")}
                    className="p-4 bg-slate-900/40 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-cyan-500/10 rounded group-hover:bg-cyan-500/20 transition-colors">
                            <Zap className="w-4 h-4 text-cyan-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">Enhance Agent Precision</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Click to attach knowledge collections or instruction profiles</p>
                        </div>
                        <Send className="ml-auto w-3 h-3 text-slate-700 group-hover:text-cyan-500 transition-all rotate-45" />
                    </div>
                </div>
            )}
        </div>
    );
}
