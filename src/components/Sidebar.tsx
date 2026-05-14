"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    PlusSquare,
    Database,
    X,
    Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/context/SettingsContext";

const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Database, label: "Knowledge Base", href: "/dashboard/knowledge" },
    { icon: PlusSquare, label: "Task Composer", href: "/dashboard/composer" },
    { icon: Settings, label: "System Config", href: "/system-config" },
];

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Backdrop for mobile */}
            <div
                className={cn(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            <div className={cn(
                "w-64 h-screen bg-black/20 backdrop-blur-3xl border-r border-white/10 flex flex-col !fixed lg:!relative left-0 top-0 z-50 tech-grid scanline transition-transform duration-300 transform lg:translate-x-0 overflow-hidden",
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Sidebar Glow Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                <div className="p-6 border-b border-white/10 flex items-center justify-between relative">
                    <div className="flex items-center gap-3">
                        <Image src="/ace-symbol.png" alt="ACEPLACE Symbol" width={48} height={48} className="h-12 w-auto object-contain" />
                        <div className="flex flex-col">
                            <span className="font-black text-xl tracking-tighter text-white uppercase italic leading-none">ACEPLACE</span>
                            <span className="text-[11px] font-mono text-cyan-500/60 tracking-[0.2em] font-bold">WORKSTATION</span>
                        </div>
                    </div>

                    {/* Close button for mobile */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-3 overflow-y-auto relative">
                    <div className="text-[11px] uppercase font-black text-slate-600 tracking-[0.2em] mb-4 ml-2">Main Interface</div>
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || 
                            (item.href === "/dashboard" && pathname.startsWith("/dashboard/jobs")) ||
                            (item.href === "/dashboard" && pathname === "/dashboard");
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => {
                                    if (window.innerWidth < 1024) onClose();
                                }}
                                className={cn(
                                    "group flex items-center justify-between px-4 py-3 transition-all duration-300 relative scifi-clip border cursor-target",
                                    isActive
                                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]"
                                        : "text-slate-500 border-transparent hover:bg-white/5 hover:text-slate-200"
                                )}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <item.icon className={cn("w-4 h-4", isActive ? "text-cyan-400" : "group-hover:text-cyan-400")} />
                                    <span className="text-[11px] font-bold uppercase tracking-wider italic">{item.label}</span>
                                </div>
                                {isActive && (
                                    <div className="absolute inset-y-0 left-0 w-[2px] bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </>
    );
}
