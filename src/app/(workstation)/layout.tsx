"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Menu, Zap } from "lucide-react";

export default function WorkstationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="h-[100dvh] stardust-bg flex items-center justify-center w-full">
                <Zap className="w-8 h-8 text-cyan-500 animate-pulse" />
            </div>
        );
    }

    return (
        <div className="h-[100dvh] stardust-bg overflow-hidden flex flex-col lg:flex-row w-full">
            {/* Mobile Header */}
            <header className="lg:hidden h-16 border-b border-white/10 bg-black/20 backdrop-blur-xl flex items-center justify-between px-4 z-40 shrink-0">
                <div className="flex items-center gap-3">
                    <img src="/ace-symbol.png" alt="ACEPLACE Symbol" className="h-10 w-auto object-contain" />
                    <div className="flex flex-col">
                        <span className="font-black text-lg tracking-tighter text-white uppercase italic leading-none">ACEPLACE</span>
                        <span className="text-[10px] uppercase text-cyan-500 shadow-sm tracking-[0.2em] font-black font-mono">Workstation</span>
                    </div>
                </div>
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                    <Menu className="w-6 h-6" />
                </button>
            </header>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative z-0 block">
                {children}
            </main>
        </div>
    );
}
