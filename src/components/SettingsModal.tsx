"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import { Switch } from "@/components/ui/switch";
import { Shield, Copy, Check } from "lucide-react";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import ApiIntegration from "./ApiIntegration";

interface SettingsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
    const [activeTab, setActiveTab] = React.useState<"ui" | "api">("ui");
    const [copied, setCopied] = React.useState(false);
    const userId = auth.currentUser?.uid || "Not Authenticated";

    const copyToClipboard = () => {
        navigator.clipboard.writeText(userId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-black/95 border border-cyan-500/20 text-white scifi-clip-lg backdrop-blur-3xl sm:max-w-xl max-h-[85vh] overflow-y-auto overflow-x-hidden shadow-[0_0_50px_rgba(6,182,212,0.1)]">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                <div className="absolute left-0 top-0 h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
                <div className="absolute right-0 top-0 h-full w-[1px] bg-gradient-to-b from-transparent via-purple-500/20 to-transparent" />

                <div className="absolute top-2 right-2 flex gap-1 opacity-20">
                    <div className="w-1 h-1 bg-cyan-500" />
                    <div className="w-1 h-1 bg-cyan-500" />
                    <div className="w-4 h-1 bg-cyan-500" />
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                <DialogHeader className="relative z-10">
                    <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tighter italic">
                        <Image src="/ace-symbol.png" alt="ACEPLACE Symbol" width={40} height={40} className="h-10 w-auto object-contain" />
                        <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">System Config</span>
                    </DialogTitle>
                    <div className="flex items-center gap-4 mt-6 border-b border-white/10 relative z-10">
                        <button
                            onClick={() => setActiveTab("ui")}
                            className={cn(
                                "pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative",
                                activeTab === "ui" ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            Interface Control
                            {activeTab === "ui" && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />}
                        </button>
                        <button
                            onClick={() => setActiveTab("api")}
                            className={cn(
                                "pb-2 text-[10px] font-black uppercase tracking-widest transition-all relative",
                                activeTab === "api" ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
                            )}
                        >
                            API Integration
                            {activeTab === "api" && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />}
                        </button>
                    </div>
                </DialogHeader>

                <div className="py-6 space-y-6 relative z-10">
                    {activeTab === "ui" ? (
                        <>
                            {/* User Identity Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[9px] uppercase font-black text-cyan-500/60 tracking-widest mb-1">
                                    <Shield className="w-3 h-3" /> Identity Signature
                                </div>
                                <div className="p-4 border border-white/5 bg-white/5 scifi-clip flex items-center justify-between hover:border-cyan-500/30 transition-all group">
                                    <div className="space-y-1 min-w-0 flex-1 mr-4">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Local UID</span>
                                        <p className="text-[11px] font-mono text-cyan-400 truncate">{userId}</p>
                                    </div>
                                    <button
                                        onClick={copyToClipboard}
                                        className="p-2 border border-white/10 bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all"
                                    >
                                        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-cyan-500" />}
                                    </button>
                                </div>
                            </div>

                            {/* Interface Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-[9px] uppercase font-black text-cyan-500/60 tracking-widest mb-1">
                                    <Shield className="w-3 h-3" /> System Security
                                </div>

                                <div className="p-4 border border-white/5 bg-white/5 scifi-clip flex items-center justify-between opacity-50 cursor-not-allowed">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs font-black uppercase tracking-wider italic">Biometric Auth</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold leading-tight">Status: OFFLINE. Requires <br />hardware bridge.</p>
                                    </div>
                                    <Switch checked={false} disabled className="cursor-not-allowed" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <ApiIntegration />
                        </div>
                    )}

                    {/* Meta Section */}
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">Build v0.4.2-ALPHA</span>
                            <span className="text-[8px] font-mono text-cyan-500/40 uppercase tracking-widest animate-pulse">ACEPLACE-CORE LOADED</span>
                        </div>
                        <div className="w-8 h-8 opacity-20 grayscale brightness-200">
                            <Image src="/ace-symbol.png" alt="ACEPLACE Symbol" width={32} height={32} className="w-full h-full object-contain" />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
