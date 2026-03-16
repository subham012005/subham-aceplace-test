import React from "react";
import { cn } from "@/lib/utils";

interface HUDFrameProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    subtitle?: string;
    variant?: "default" | "glass" | "dark";
    showRefLines?: boolean;
    headerAction?: React.ReactNode;
    isProcessing?: boolean;
}

export function HUDFrame({
    children,
    title,
    subtitle,
    variant = "default",
    showRefLines = true,
    headerAction,
    isProcessing = false,
    className,
    ...props
}: HUDFrameProps) {
    return (
        <div
            className={cn(
                "relative p-[1px] hud-border group transition-all duration-700 holo-noise",
                variant === "default" && "glass",
                variant === "dark" && "bg-black/80 backdrop-blur-md border border-white/5",
                isProcessing && "animate-breathing",
                className
            )}
            {...props}
        >
            {/* Corner Accents */}
            <div className="hud-corner hud-corner-tl" />
            <div className="hud-corner hud-corner-tr" />
            <div className="hud-corner hud-corner-bl" />
            <div className="hud-corner hud-corner-br" />
            {/* Top Left Label Tab */}
            {(title || subtitle) && (
                <div className="absolute -top-[1px] left-0 right-0 flex items-center justify-between h-[22px] bg-cyan-500/10 border-r border-b border-cyan-500/30 px-2.5 z-10 transition-all">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-1 h-3.5 bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
                        <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-cyan-500 whitespace-nowrap glitch-text">
                            {title}
                            {subtitle && <span className="text-slate-500/80 ml-2 hidden sm:inline">[{subtitle}]</span>}
                        </span>
                    </div>
                    {headerAction && (
                        <div className="animate-in fade-in duration-500 mr-1">
                            {headerAction}
                        </div>
                    )}
                </div>
            )}

            {/* Decorative Technical Segments */}
            {showRefLines && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-0 right-10 w-20 h-[1px] bg-cyan-500/10" />
                    <div className="absolute bottom-0 left-10 w-20 h-[1px] bg-cyan-500/10" />
                    <div className="absolute top-10 right-0 w-[1px] h-20 bg-cyan-500/10" />
                    <div className="absolute bottom-10 left-0 w-[1px] h-20 bg-cyan-500/10" />
                </div>
            )}

            {/* Internal Content Wrapper */}
            <div className={cn("relative p-3 md:p-4 h-full", title && "pt-8 md:pt-9")}>
                {children}
            </div>
        </div>
    );
}
