"use client";

import React, { useState, useEffect } from "react";
import { KnowledgeBasePanel, type KBCollection, type InstructionProfile, type KnowledgeSnippet } from "@/components/KnowledgeBasePanel";
import {
    Database, Brain, Sparkles, Shield, Cpu,
    Layers, Activity, Info, Zap, Book,
    FileText, Search, PlusCircle, LayoutGrid
} from "lucide-react";
import { aceApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export default function KnowledgePage() {
    const [stats, setStats] = useState({
        totalCollections: 0,
        totalChunks: 0,
        totalProfiles: 0,
        totalSnippets: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [collRes, profRes, snipRes] = await Promise.all([
                    aceApi.secureFetchPublic("/api/knowledge/collections"),
                    aceApi.secureFetchPublic("/api/instructions"),
                    aceApi.secureFetchPublic("/api/user/knowledge-snippets")
                ]);

                const colls = await collRes.json();
                const profs = await profRes.json();
                const snips = await snipRes.json();

                const totalChunks = (colls.collections || []).reduce((acc: number, c: KBCollection) => acc + (c.chunk_count || 0), 0);

                setStats({
                    totalCollections: colls.collections?.length || 0,
                    totalChunks,
                    totalProfiles: profs.profiles?.length || 0,
                    totalSnippets: snips.snippets?.length || 0
                });
            } catch (err) {
                console.error("Failed to load knowledge stats", err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    return (
        <div className="min-h-screen relative flex flex-col">
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4" />
                <div className="absolute inset-0 tech-grid opacity-[0.03]" />
            </div>

            <div className="relative z-10 p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header Area */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-white/5">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                <Database className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="h-px w-12 bg-gradient-to-r from-cyan-500/50 to-transparent" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500/70">Intelligence Core</span>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tighter flex items-baseline gap-4">
                                Knowledge Base
                                <span className="text-sm font-mono not-italic text-slate-500 tracking-normal bg-white/5 px-2 py-0.5 rounded border border-white/5">SYSTEM_01</span>
                            </h1>
                            <p className="text-slate-400 text-sm font-medium max-w-2xl leading-relaxed">
                                Deploy advanced grounding contexts for your autonomous agents. Manage technical documentation,
                                behavioral protocols, and real-time knowledge injections within the ACEPLACE environment.
                            </p>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 min-w-[320px]">
                        {[
                            { label: "Collections", value: stats.totalCollections, icon: Layers, color: "text-cyan-400" },
                            { label: "Data Indexed Context Units", value: stats.totalChunks, icon: Cpu, color: "text-purple-400" },
                            { label: "Instruction Profiles", value: stats.totalProfiles, icon: Book, color: "text-amber-400" },
                            { label: "Context Blocks", value: stats.totalSnippets, icon: Activity, color: "text-emerald-400" }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white/[0.02] border border-white/5 p-3 rounded-lg backdrop-blur-sm group hover:border-white/10 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    <stat.icon className={cn("w-3 h-3", stat.color)} />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <div className="text-xl font-mono font-black text-white">
                                    {loading ? <div className="w-8 h-5 bg-white/5 animate-pulse rounded" /> : stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="w-full space-y-6">
                    <div className="relative group/panel">
                        {/* Animated Border Effect */}
                        <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl opacity-50 blur-[2px] group-hover/panel:opacity-100 transition-opacity duration-1000" />

                        <div className="relative bg-[#020617]/80 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <div className="h-1 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-cyan-500/40" />

                            <div className="p-1 lg:p-4">
                                <div className="flex items-center justify-between p-4 lg:px-8 lg:pt-6">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                            <LayoutGrid className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white uppercase italic tracking-tight">Configuration Matrix</h2>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Matrix_ID: ACE-KM-99</p>
                                        </div>
                                    </div>

                                </div>

                                <div className="p-4 lg:p-8 pt-2">
                                    <KnowledgeBasePanel className="max-w-none border-none bg-transparent" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Footer */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-6 h-6 rounded-full border border-[#020617] bg-slate-800 flex items-center justify-center">
                                        <Info className="w-3 h-3 text-slate-400" />
                                    </div>
                                ))}
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">3 active system monitors linked to this matrix</span>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black text-white uppercase">Cloud Sync: Active</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                                <span className="text-[10px] font-black text-white uppercase">Local DB: 98% Optimal</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
