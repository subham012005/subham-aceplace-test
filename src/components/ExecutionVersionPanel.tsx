"use client";

/**
 * ExecutionVersionPanel
 * 
 * Renders one collapsible version panel for a single execution cycle.
 * Used by TaskDetail to show Version 1, Version 2… etc. as the user
 * edits/continues a job.
 * 
 * Each panel has four collapsible inner sections:
 *   → Mission Strategy  (COO plan)
 *   → Intelligence Report (Researcher output)
 *   → Final Deliverable  (Worker artifact)
 *   → Governance Grading (Grader score + reasoning)
 */

import React, { useState, useEffect } from "react";
import {
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    RotateCw,
    Zap,
    BookOpen,
    FileText,
    ShieldCheck,
    Edit2,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownReport } from "./MarkdownReport";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface VersionGradeData {
    score: number;
    pass_fail: "pass" | "fail";
    reasoning_summary: string;
    risk_flags: string[];
}

export interface ExecutionVersionPanelProps {
    versionNumber: number;       // 1-indexed display number
    instruction: string | null;  // null for v1 (original mission)
    artifactContent: string | null;
    planContent: any | null;
    researchContent: any | null;
    gradeData: VersionGradeData | null;
    tokenCount: number;
    tokenCost: number;
    isActive: boolean;           // true = currently executing
    isLive: boolean;             // true = real-time streaming
    defaultOpen: boolean;
    steps: any[];                // steps belonging to this version
}

// ─────────────────────────────────────────────
// Inner Section Component
// ─────────────────────────────────────────────

interface SectionProps {
    icon: React.ReactNode;
    title: string;
    badge?: string;
    badgeColor?: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    isLoading?: boolean;
}

function Section({ icon, title, badge, badgeColor, children, defaultOpen = false, isLoading }: SectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border border-white/5 bg-black/20">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all group"
            >
                <span className="text-slate-500 group-hover:text-cyan-500 transition-colors shrink-0">
                    {icon}
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-white transition-colors flex-1 text-left">
                    {title}
                </span>
                {isLoading && (
                    <span className="flex items-center gap-1.5 text-[9px] text-cyan-500 font-black uppercase tracking-widest animate-pulse">
                        <div className="w-1 h-1 bg-cyan-500 rounded-full animate-ping" />
                        Live
                    </span>
                )}
                {badge && !isLoading && (
                    <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border", badgeColor || "text-slate-500 border-slate-500/30 bg-slate-500/5")}>
                        {badge}
                    </span>
                )}
                {open
                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                    : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                }
            </button>

            {open && (
                <div className="border-t border-white/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────
// Score Pill
// ─────────────────────────────────────────────

function ScorePill({ score, pass_fail }: { score: number; pass_fail: "pass" | "fail" }) {
    const isPass = pass_fail === "pass";
    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 border",
            isPass
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/40 bg-rose-500/10 text-rose-400"
        )}>
            {isPass
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <AlertCircle className="w-3.5 h-3.5" />
            }
            <span className="text-sm font-black italic tracking-tighter">
                {score.toFixed(1)}<span className="text-xs opacity-50 ml-0.5">/10</span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">
                {isPass ? "PASS" : "FAIL"}
            </span>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────

export function ExecutionVersionPanel({
    versionNumber,
    instruction,
    artifactContent,
    planContent,
    researchContent,
    gradeData,
    tokenCount,
    tokenCost,
    isActive,
    isLive,
    defaultOpen,
    steps,
}: ExecutionVersionPanelProps) {
    const [open, setOpen] = useState(defaultOpen);

    // Auto-open when version becomes active
    useEffect(() => {
        if (isActive) setOpen(true);
    }, [isActive]);

    const completedSteps = steps.filter(s => s.status === "completed").length;
    const totalSteps = steps.length;
    const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    const headerBorderColor = isActive
        ? "border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.08)]"
        : "border-white/8";

    return (
        <div className={cn("border bg-black/30 transition-all duration-300", headerBorderColor)}>
            {/* ── Version Header ── */}
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-all group"
            >
                {/* Version badge */}
                <div className={cn(
                    "w-8 h-8 flex items-center justify-center border shrink-0 text-xs font-black italic",
                    isActive
                        ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                        : "border-white/10 text-slate-500 bg-white/5"
                )}>
                    {isActive ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        `V${versionNumber}`
                    )}
                </div>

                {/* Title */}
                <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                            "text-sm font-black uppercase italic tracking-tighter",
                            isActive ? "text-cyan-400" : "text-white"
                        )}>
                            Version {versionNumber}
                        </span>
                        {versionNumber === 1 && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-700/50 px-1.5 py-0.5">
                                Original
                            </span>
                        )}
                        {isActive && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-cyan-500 border border-cyan-500/30 bg-cyan-500/5 px-1.5 py-0.5 animate-pulse">
                                ● Live
                            </span>
                        )}
                        {!isActive && gradeData && (
                            <ScorePill score={gradeData.score} pass_fail={gradeData.pass_fail} />
                        )}
                    </div>

                    {/* Instruction preview */}
                    {instruction && (
                        <p className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-md">
                            <Edit2 className="w-2.5 h-2.5 inline mr-1 opacity-50" />
                            {instruction}
                        </p>
                    )}
                </div>

                {/* Token count */}
                {tokenCount > 0 && (
                    <div className="shrink-0 text-right hidden sm:block">
                        <p className="text-[10px] font-mono text-slate-500">
                            {tokenCount.toLocaleString()} tokens
                        </p>
                        {tokenCost > 0 && (
                            <p className="text-[10px] font-mono text-emerald-500/70">
                                ${tokenCost.toFixed(4)}
                            </p>
                        )}
                    </div>
                )}

                {/* Progress bar (if active) */}
                {isActive && totalSteps > 0 && (
                    <div className="shrink-0 w-16 space-y-1">
                        <div className="h-1 bg-white/5 border border-white/5 relative overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 bg-cyan-500 shadow-[0_0_8px_#06b6d4] transition-all duration-700"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <p className="text-[9px] font-mono text-slate-600 text-right">
                            {completedSteps}/{totalSteps}
                        </p>
                    </div>
                )}

                {open
                    ? <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                }
            </button>

            {/* ── Collapsible Body ── */}
            {open && (
                <div className="border-t border-white/5 space-y-px animate-in fade-in slide-in-from-top-2 duration-300">

                    {/* ── Mission Strategy ── */}
                    <Section
                        icon={<Zap className="w-3.5 h-3.5" />}
                        title="Mission Strategy"
                        badge={planContent ? "Complete" : isActive ? undefined : "Pending"}
                        badgeColor={planContent ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : undefined}
                        isLoading={isActive && !planContent}
                        defaultOpen={false}
                    >
                        {planContent ? (
                            <div className="bg-black/40 border border-white/5 p-4">
                                {typeof planContent === "object" ? (
                                    <div className="space-y-3">
                                        {planContent.strategic_objective && (
                                            <div>
                                                <p className="text-[9px] uppercase font-black tracking-widest text-cyan-500/70 mb-1">
                                                    Strategic Objective
                                                </p>
                                                <p className="text-xs text-slate-300 leading-relaxed">
                                                    {planContent.strategic_objective}
                                                </p>
                                            </div>
                                        )}
                                        {planContent.assignments && Array.isArray(planContent.assignments) && (
                                            <div>
                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-2">
                                                    {planContent.assignments.length} Tactical Units
                                                </p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {planContent.assignments.map((a: any, i: number) => (
                                                        <div key={i} className="px-3 py-2 bg-black/30 border border-white/5 text-xs text-slate-400">
                                                            <span className="text-cyan-500 font-black uppercase text-[9px] tracking-widest">
                                                                {a.role || `Agent ${i + 1}`}
                                                            </span>
                                                            <p className="mt-0.5 text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                                                                {a.task || a.description || ""}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {!planContent.strategic_objective && !planContent.assignments && (
                                            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                                                {JSON.stringify(planContent, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                                        {String(planContent)}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-4 text-slate-600">
                                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                <span className="text-[10px] uppercase font-black tracking-widest">
                                    COO Planning in progress...
                                </span>
                            </div>
                        )}
                    </Section>

                    {/* ── Intelligence Report ── */}
                    <Section
                        icon={<BookOpen className="w-3.5 h-3.5" />}
                        title="Intelligence Report"
                        badge={researchContent ? "Complete" : isActive ? undefined : "Pending"}
                        badgeColor={researchContent ? "text-blue-400 border-blue-400/30 bg-blue-400/5" : undefined}
                        isLoading={isActive && !!planContent && !researchContent}
                        defaultOpen={false}
                    >
                        {researchContent ? (
                            <div className="bg-black/40 border border-white/5 p-4">
                                {typeof researchContent === "object" ? (
                                    <div className="space-y-3">
                                        {researchContent.intelligence_summary && (
                                            <div>
                                                <p className="text-[9px] uppercase font-black tracking-widest text-blue-400/70 mb-1">
                                                    Intelligence Summary
                                                </p>
                                                <p className="text-xs text-slate-300 leading-relaxed italic">
                                                    {researchContent.intelligence_summary}
                                                </p>
                                            </div>
                                        )}
                                        {researchContent.findings && Array.isArray(researchContent.findings) && (
                                            <div>
                                                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-2">
                                                    {researchContent.findings.length} Intelligence Findings
                                                </p>
                                                <div className="space-y-2">
                                                    {researchContent.findings.slice(0, 5).map((f: any, i: number) => (
                                                        <div key={i} className="flex gap-2 text-xs">
                                                            <span className="w-4 h-4 text-[9px] font-black text-cyan-500 shrink-0 mt-0.5 text-center">
                                                                {i + 1}
                                                            </span>
                                                            <p className="text-slate-400 leading-relaxed line-clamp-2">
                                                                {typeof f === "string" ? f : f.title || f.finding || f.insight || JSON.stringify(f)}
                                                            </p>
                                                        </div>
                                                    ))}
                                                    {researchContent.findings.length > 5 && (
                                                        <p className="text-[9px] text-slate-600 italic pl-6">
                                                            + {researchContent.findings.length - 5} more findings...
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {!researchContent.intelligence_summary && !researchContent.findings && (
                                            <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">
                                                {JSON.stringify(researchContent, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-300 leading-relaxed italic whitespace-pre-wrap">
                                        {String(researchContent)}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-4 text-slate-600">
                                {isActive && planContent ? (
                                    <>
                                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                        <span className="text-[10px] uppercase font-black tracking-widest">
                                            Research in progress...
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-[10px] uppercase font-black tracking-widest">
                                        Awaiting research phase...
                                    </span>
                                )}
                            </div>
                        )}
                    </Section>

                    {/* ── Final Deliverable ── */}
                    <Section
                        icon={<FileText className="w-3.5 h-3.5" />}
                        title="Final Deliverable"
                        badge={artifactContent ? "Complete" : isActive ? undefined : "Pending"}
                        badgeColor={artifactContent ? "text-purple-400 border-purple-400/30 bg-purple-400/5" : undefined}
                        isLoading={isActive && !!researchContent && !artifactContent}
                        defaultOpen={false}
                    >
                        {artifactContent ? (
                            <div className="bg-black/40 border border-white/5 p-4">
                                <MarkdownReport content={artifactContent} />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-4 text-slate-600">
                                {isActive && researchContent ? (
                                    <>
                                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                        <span className="text-[10px] uppercase font-black tracking-widest">
                                            Worker producing artifact...
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-[10px] uppercase font-black tracking-widest">
                                        Awaiting artifact production...
                                    </span>
                                )}
                            </div>
                        )}
                    </Section>

                    {/* ── Governance Grading ── */}
                    <Section
                        icon={<ShieldCheck className="w-3.5 h-3.5" />}
                        title="Governance Grading"
                        badge={gradeData ? (gradeData.pass_fail === "pass" ? "Pass" : "Fail") : isActive ? undefined : "Pending"}
                        badgeColor={
                            gradeData
                                ? gradeData.pass_fail === "pass"
                                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                                    : "text-rose-500 border-rose-500/30 bg-rose-500/5"
                                : undefined
                        }
                        isLoading={isActive && !!artifactContent && !gradeData}
                        defaultOpen={false}
                    >
                        {gradeData ? (
                            <div className="space-y-4">
                                {/* Score */}
                                <div className="flex items-center gap-4">
                                    <ScorePill score={gradeData.score} pass_fail={gradeData.pass_fail} />
                                    <div>
                                        <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">
                                            AI Integrity Score
                                        </p>
                                        <p className="text-xs font-bold text-white">
                                            {gradeData.score.toFixed(1)} / 10
                                        </p>
                                    </div>
                                </div>

                                {/* Reasoning */}
                                {gradeData.reasoning_summary && (
                                    <div className="bg-black/30 border border-white/5 p-4">
                                        <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-2">
                                            Evaluation Reasoning
                                        </p>
                                        <p className="text-xs text-slate-300 leading-relaxed italic">
                                            {typeof gradeData.reasoning_summary === "object"
                                                ? JSON.stringify(gradeData.reasoning_summary)
                                                : gradeData.reasoning_summary
                                            }
                                        </p>
                                    </div>
                                )}

                                {/* Risk Flags */}
                                {gradeData.risk_flags.length > 0 && (
                                    <div>
                                        <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-2">
                                            Risk Vectors
                                        </p>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {gradeData.risk_flags.map((flag, i) => (
                                                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-rose-500/5 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider">
                                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                                    {typeof flag === "object" ? JSON.stringify(flag) : String(flag)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {gradeData.risk_flags.length === 0 && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                                        No Risk Flags Detected
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-4 text-slate-600">
                                {isActive && artifactContent ? (
                                    <>
                                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                        <span className="text-[10px] uppercase font-black tracking-widest">
                                            Grader evaluating artifact...
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-[10px] uppercase font-black tracking-widest">
                                        Awaiting governance evaluation...
                                    </span>
                                )}
                            </div>
                        )}
                    </Section>
                </div>
            )}
        </div>
    );
}
