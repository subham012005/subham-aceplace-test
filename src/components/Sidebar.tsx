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
    Settings,
    Info,
    Rocket,
    Lightbulb,
    Gauge,
    Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type MenuItem = {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    href: string;
    accent?: "neon-green";
};

const primaryMenuItems: MenuItem[] = [
    { icon: LayoutDashboard, label: "Dashboard",      href: "/dashboard" },
    { icon: Settings,        label: "System Config",  href: "/system-config" },
    { icon: Database,        label: "Knowledge Base", href: "/dashboard/knowledge" },
    { icon: PlusSquare,      label: "Task Composer",  href: "/dashboard/composer", accent: "neon-green" },
];

const secondaryMenuItems: MenuItem[] = [
    { icon: Info,      label: "About ACEPLACE",    href: "/dashboard/about" },
    { icon: Rocket,    label: "Quick Setup Guide", href: "/dashboard/setup" },
    { icon: Lightbulb, label: "Runtime Ideas",     href: "/dashboard/runtime-ideas" },
];

const runtimeUsageItem: MenuItem = {
    icon: Gauge,
    label: "Runtime Usage",
    href: "/dashboard/runtime-usage",
};

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

function NavLink({
    item,
    pathname,
    onClose,
}: {
    item: MenuItem;
    pathname: string;
    onClose: () => void;
}) {
    const isActive =
        pathname === item.href ||
        (item.href === "/dashboard" && pathname.startsWith("/dashboard/jobs")) ||
        (item.href !== "/dashboard" && item.href !== "/" && pathname.startsWith(item.href));

    const tourId = `tour-${item.label.toLowerCase().replace(/\s+/g, "-")}`;
    const isNeonGreen = item.accent === "neon-green";

    return (
        <Link
            href={item.href}
            id={tourId}
            onClick={() => {
                if (window.innerWidth < 1024) onClose();
            }}
            className={cn(
                "group flex items-center justify-between px-4 py-3 transition-all duration-300 relative scifi-clip border cursor-target",
                isNeonGreen
                    ? isActive
                        ? "bg-[#39FF14]/10 text-[#39FF14]/85 border-[#39FF14]/30 shadow-[inset_0_0_20px_rgba(57,255,20,0.06)]"
                        : "text-[#39FF14]/25 border-transparent hover:bg-[#39FF14]/5"
                    : isActive
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[inset_0_0_20px_rgba(6,182,212,0.05)]"
                        : "text-slate-500 border-transparent hover:bg-white/5 hover:text-slate-200"
            )}
        >
            <div className="flex items-center gap-3 relative z-10">
                <item.icon
                    className={cn(
                        "w-4 h-4 transition-all duration-300",
                        isNeonGreen
                            ? isActive
                                ? "text-[#39FF14]/85 drop-shadow-[0_0_5px_rgba(57,255,20,0.35)]"
                                : "text-[#39FF14]/25 group-hover:text-[#39FF14]/70 group-hover:drop-shadow-[0_0_8px_rgba(57,255,20,0.45)]"
                            : isActive
                                ? "text-cyan-400"
                                : "group-hover:text-cyan-400"
                    )}
                />
                <span
                    className={cn(
                        "text-[11px] font-bold uppercase tracking-wider italic transition-all duration-300",
                        isNeonGreen &&
                            (isActive
                                ? "text-[#39FF14]/85 drop-shadow-[0_0_4px_rgba(57,255,20,0.3)]"
                                : "text-[#39FF14]/25 group-hover:text-[#39FF14]/70 group-hover:drop-shadow-[0_0_6px_rgba(57,255,20,0.4)]")
                    )}
                >
                    {item.label}
                </span>
            </div>
            {isActive && (
                <div
                    className={cn(
                        "absolute inset-y-0 left-0 w-[2px] shadow-[0_0_10px]",
                        isNeonGreen
                            ? "bg-[#39FF14]/70 shadow-[0_0_8px_rgba(57,255,20,0.5)]"
                            : "bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                    )}
                />
            )}
        </Link>
    );
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const { user, signOut } = useAuth();

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
                "w-64 h-screen bg-black/20 backdrop-blur-3xl border-r border-white/10 flex flex-col !fixed lg:!relative left-0 top-0 z-50 tech-grid scanline transition-transform duration-300 transform lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Sidebar Glow Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />

                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between relative shrink-0">
                    <div id="tour-logo" className="flex items-center gap-3">
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

                {/* Nav */}
                <nav className="flex-1 flex flex-col min-h-0 p-4 relative">
                    <div className="flex-1 overflow-y-auto custom-scroll space-y-1 min-h-0">
                        <div className="text-[11px] uppercase font-black text-slate-600 tracking-[0.2em] mb-4 ml-2">Main Interface</div>
                        {primaryMenuItems.map((item) => (
                            <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
                        ))}
                    </div>
                    <div className="shrink-0 pt-3 mt-auto border-t border-white/5 space-y-1">
                        {secondaryMenuItems.map((item) => (
                            <NavLink key={item.href} item={item} pathname={pathname} onClose={onClose} />
                        ))}
                        <NavLink item={runtimeUsageItem} pathname={pathname} onClose={onClose} />
                    </div>
                </nav>

                {/* Footer: User info + Logout — always visible, especially on mobile */}
                <div className="shrink-0 border-t border-white/10 p-4 relative space-y-2">
                    {user && (
                        <div className="px-3 py-2 border border-white/5 bg-white/2 flex items-center gap-2 min-w-0 overflow-hidden">
                            <div className="w-6 h-6 rounded-none border border-cyan-500/30 bg-cyan-500/10 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-black text-cyan-400">
                                    {user.email?.[0]?.toUpperCase() || "U"}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white truncate leading-none">
                                    {user.email?.split("@")[0] || "OPERATOR"}
                                </p>
                                <p className="text-[8px] font-mono text-slate-600 truncate leading-none mt-0.5">
                                    {user.email}
                                </p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center gap-3 px-4 py-3 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 transition-all duration-200 group"
                    >
                        <Lock className="w-4 h-4 text-rose-500/50 group-hover:text-rose-500 transition-colors shrink-0" />
                        <span className="text-[11px] font-bold uppercase tracking-wider italic text-rose-500/50 group-hover:text-rose-500 transition-colors">
                            Lock Terminal
                        </span>
                    </button>
                </div>
            </div>
        </>
    );
}
