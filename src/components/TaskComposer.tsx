"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Send,
    Terminal,
    AlertCircle,
    CheckCircle2,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aceApi } from "@/lib/api-client";
import { SciFiFrame } from "@/components/SciFiFrame";

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

    const maxChars = 2000;
    const charPercentage = Math.min((task.length / maxChars) * 100, 100);

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

            await aceApi.dispatchFromDashboard({
                prompt: task,
                job_id: generatedJobId,
                agent_id: "agent_coo",
            });

            // Trigger Firestore logging in parallel
            import("@/lib/user-stats").then(({ incrementUserRequestCount }) => {
                incrementUserRequestCount(userId).catch(console.error);
            });

            // Notify parent of success
            if (onSuccess) onSuccess(generatedJobId);

            setSuccess(true);
            setTask("");

            // Redirect to job detail page
            setTimeout(() => {
                router.push(`jobs/${generatedJobId}`);
            }, 1000); // Small delay to show success state

        } catch (err: unknown) {
            const error = err as Error;
            console.error("Orchestration failed:", error);
            setError(error.message || "Dimensional link failed. Check workflow engine status.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
            <SciFiFrame
                title="Tactical Command Orchestrator"
                variant="glass"
                className="overflow-hidden"
            >
                {/* Advanced HUD Header */}
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
                            {/* Decorative terminal garnish */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-30">
                                <div className="w-1 h-3 bg-cyan-500/50" />
                                <div className="w-1 h-3 bg-cyan-500/20" />
                            </div>
                            <div className="absolute bottom-4 right-4 text-[8px] font-mono text-cyan-500/20 pointer-events-none select-none">
                                CMD_ID: {Math.random().toString(16).slice(2, 10).toUpperCase()}
                            </div>
                        </div>
                    </div>

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
                            {/* Animated Background Gradients */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out" />

                            {success && (
                                <div className="absolute inset-0 bg-white animate-out fade-out duration-700 pointer-events-none z-50" />
                            )}

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
    );
}
