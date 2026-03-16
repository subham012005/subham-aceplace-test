"use client";

import React from "react";
import {
    Terminal,
    Cpu,
    Database,
    CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskComposer } from "@/components/TaskComposer";

export default function TaskComposerPage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500 pb-12 pt-12">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                <img src="/nxq-symbol.png" alt="NXQ Symbol" className="h-12 w-auto object-contain" />
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic flex items-center gap-3">
                        TASK <span className="text-cyan-500">COMPOSER</span>
                    </h1>
                    <p className="text-[10px] text-slate-500 font-mono tracking-[0.3em] font-bold uppercase">Configure and Dispatch Dimensional Agents</p>
                </div>
            </div>

            <TaskComposer />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Latency", value: "124ms", icon: Cpu, color: "text-blue-400" },
                    { label: "Persistence", value: "ENABLED", icon: Database, color: "text-purple-400" },
                    { label: "Reliability", value: "99.9%", icon: CheckCircle2, color: "text-emerald-400" },
                ].map((item) => (
                    <div key={item.label} className="glass p-5 scifi-clip border border-white/5 flex items-center gap-4 group hover:border-white/10 transition-all">
                        <div className="w-10 h-10 scifi-clip bg-white/5 flex items-center justify-center transition-transform group-hover:scale-110">
                            <item.icon className={cn("w-5 h-5", item.color)} />
                        </div>
                        <div>
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{item.label}</p>
                            <p className="text-sm font-black text-white tracking-widest italic">{item.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
