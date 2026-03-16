"use client";

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/context/SettingsContext";
import { Settings, MousePointer2, Target, Zap, Shield, Cpu } from "lucide-react";

interface SettingsModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
    const { settings, updateCursorStyle } = useSettings();

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="bg-black/95 border border-cyan-500/20 text-white scifi-clip-lg backdrop-blur-3xl sm:max-w-[425px] overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.1)]">
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
                        <img src="/nxq-symbol.png" alt="NXQ Symbol" className="h-10 w-auto object-contain" />
                        <span className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">System Config</span>
                    </DialogTitle>
                    <DialogDescription className="text-cyan-500/40 text-[9px] uppercase font-black tracking-[0.2em] mt-2 flex items-center gap-2">
                        <Cpu className="w-3 h-3 animate-pulse" /> Core interface parameters
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6 space-y-6 relative z-10">
                    {/* Interface Section */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[9px] uppercase font-black text-cyan-500/60 tracking-widest mb-1">
                            <Zap className="w-3 h-3" /> User Interface
                        </div>

                        <div className="p-4 border border-white/5 bg-white/5 scifi-clip flex items-center justify-between hover:border-cyan-500/30 transition-all group cursor-target">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-black uppercase tracking-wider italic text-slate-200 group-hover:text-white">Targeting Cursor</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold leading-tight group-hover:text-slate-400 transition-colors">Enable high-fidelity GSAP snapping <br />and parallax effects.</p>
                            </div>
                            <Switch
                                checked={settings.cursorStyle === 'targeting'}
                                onCheckedChange={(checked) => updateCursorStyle(checked ? 'targeting' : 'normal')}
                                className="data-[state=checked]:bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                            />
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

                    {/* Meta Section */}
                    <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-mono text-slate-600 uppercase tracking-tighter">Build v0.4.2-ALPHA</span>
                            <span className="text-[8px] font-mono text-cyan-500/40 uppercase tracking-widest animate-pulse">NXQ-CORE LOADED</span>
                        </div>
                        <div className="w-8 h-8 opacity-20 grayscale brightness-200">
                            <img src="/nxq-symbol.png" alt="NXQ Symbol" className="w-full h-full object-contain" />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
