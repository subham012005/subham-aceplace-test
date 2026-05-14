"use client";

import React from "react";
import { HUDFrame } from "./HUDFrame";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PurgeConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
}

export function PurgeConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description
}: PurgeConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            {/* Modal Container */}
            <div className="relative w-full max-w-md animate-in zoom-in-95 duration-300">
                <HUDFrame 
                    title="SECURITY PROTOCOL" 
                    subtitle="PURGE CONFIRMATION" 
                    variant="dark"
                    className="border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.1)]"
                >
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-none shrink-0 relative">
                                <div className="absolute inset-0 bg-rose-500/10 animate-ping rounded-none" />
                                <AlertTriangle className="w-8 h-8 text-rose-500 relative z-10" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] glitch-text">{title}</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1.5 leading-relaxed">
                                    {description}
                                </p>
                            </div>
                        </div>

                        <div className="bg-rose-500/5 border-l-2 border-rose-500 p-4 space-y-3">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-[0.25em]">Critical Warning:</p>
                            <ul className="text-[10px] text-rose-400/80 uppercase tracking-[0.15em] space-y-1.5 list-none">
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-rose-500 rotate-45" />
                                    Permanent removal from dimensional database
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-rose-500 rotate-45" />
                                    Termination of associated execution envelopes
                                </li>
                                <li className="flex items-center gap-2">
                                    <div className="w-1 h-1 bg-rose-500 rotate-45" />
                                    This action cannot be rolled back
                                </li>
                            </ul>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 border border-white/10 hover:bg-white/5 transition-all text-xs font-black uppercase tracking-[0.3em] text-slate-500 hover:text-white scifi-clip-sm cursor-target"
                            >
                                Abort
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className="flex-1 py-3 bg-rose-500/10 border border-rose-500/50 hover:bg-rose-500 hover:text-black transition-all text-xs font-black uppercase tracking-[0.3em] text-rose-500 scifi-clip-sm cursor-target"
                            >
                                Confirm Purge
                            </button>
                        </div>
                    </div>
                </HUDFrame>
            </div>
        </div>
    );
}
