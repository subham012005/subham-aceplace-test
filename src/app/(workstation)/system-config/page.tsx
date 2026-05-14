"use client";

import React from 'react';
import Image from "next/image";
import { Switch } from "@/components/ui/switch";
import { Shield, Copy, Check, Cpu, Globe, Settings as SettingsIcon } from "lucide-react";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { IntelligenceProviders } from "@/components/IntelligenceProviders";

export default function SystemConfigPage() {
    const [activeTab, setActiveTab] = React.useState<"ui" | "providers">("ui");
    const [copied, setCopied] = React.useState(false);
    const userId = auth.currentUser?.uid || "Not Authenticated";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(userId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="min-h-screen relative flex flex-col">
            {/* Ambient Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4" />
                <div className="absolute inset-0 tech-grid opacity-[0.03]" />
            </div>

            <div className="relative z-10 p-6 lg:p-10 space-y-8 max-w-[1200px] mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Header Area */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-white/5">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                <SettingsIcon className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="h-px w-12 bg-gradient-to-r from-cyan-500/50 to-transparent" />
                            <span className="text-[11px] font-black uppercase tracking-[0.4em] text-cyan-500/70">Governance Control</span>
                        </div>
                        
                        <div className="space-y-2">
                            <h1 className="text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tighter flex items-baseline gap-4">
                                System Config
                                <span className="text-sm font-mono not-italic text-slate-500 tracking-normal bg-white/5 px-2 py-0.5 rounded border border-white/5">CORE_v0.4.2</span>
                            </h1>
                            <p className="text-slate-400 text-sm font-medium max-w-2xl leading-relaxed">
                                Global orchestration parameters and security protocols for the ACEPLACE runtime environment. 
                                Configure API integration signatures and intelligence provider weighting.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Content Layout */}
                <div className="w-full">
                    <div className="relative group/panel">
                        {/* Animated Border Effect */}
                        <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl opacity-50 blur-[2px] group-hover/panel:opacity-100 transition-opacity duration-1000" />
                        
                        <div className="relative bg-[#020617]/80 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                            <div className="h-1 bg-gradient-to-r from-cyan-500/40 via-purple-500/40 to-cyan-500/40" />
                            
                            <div className="p-1 lg:p-4">
                                <div className="flex items-center gap-6 p-4 lg:px-8 border-b border-white/5">
                                    <button
                                        onClick={() => setActiveTab("ui")}
                                        className={cn(
                                            "pb-2 text-[11px] font-black uppercase tracking-widest transition-all relative",
                                            activeTab === "ui" ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        Interface Control
                                        {activeTab === "ui" && <div className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("providers")}
                                        className={cn(
                                            "pb-2 text-[11px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap",
                                            activeTab === "providers" ? "text-amber-400" : "text-slate-500 hover:text-slate-300"
                                        )}
                                    >
                                        Intelligence Providers
                                        {activeTab === "providers" && <div className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />}
                                    </button>
                                </div>

                                <div className="p-4 lg:p-8">
                                    {activeTab === "ui" ? (
                                        <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
                                            {/* User Identity Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-[11px] uppercase font-black text-cyan-500/60 tracking-[0.2em] mb-2">
                                                    <Shield className="w-3.5 h-3.5" /> Identity Signature
                                                </div>
                                                <div className="p-6 border border-white/5 bg-white/[0.02] rounded-xl flex items-center justify-between hover:border-cyan-500/30 transition-all group group relative overflow-hidden">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className="space-y-1 min-w-0 flex-1 mr-4 relative z-10">
                                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Local UID Signature</span>
                                                        <p className="text-sm font-mono text-cyan-400 truncate">{userId}</p>
                                                    </div>
                                                    <button
                                                        onClick={copyToClipboard}
                                                        className="relative z-10 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all active:scale-95"
                                                    >
                                                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-cyan-500" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Interface Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 text-[11px] uppercase font-black text-cyan-500/60 tracking-[0.2em] mb-2">
                                                    <Shield className="w-3.5 h-3.5" /> System Security
                                                </div>

                                                <div className="p-6 border border-white/5 bg-white/[0.02] rounded-xl flex items-center justify-between opacity-50 cursor-not-allowed">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Shield className="w-4 h-4 text-purple-400" />
                                                            <span className="text-xs font-black uppercase tracking-wider italic text-white">Biometric Auth</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 font-bold leading-tight">Status: OFFLINE. Requires hardware bridge verification.</p>
                                                    </div>
                                                    <Switch checked={false} disabled className="cursor-not-allowed" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                            <IntelligenceProviders />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Footer */}
                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-tighter">Build Hash: 0xACE_77_ALPHA</span>
                                <span className="text-[10px] font-mono text-cyan-500/40 uppercase tracking-widest animate-pulse">ACEPLACE-CORE_STABLE</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black text-white uppercase">Encryption: AES-256</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Globe className="w-3 h-3 text-cyan-500" />
                                <span className="text-[10px] font-black text-white uppercase">Global Node: Active</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
