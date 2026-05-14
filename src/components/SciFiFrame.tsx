"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SciFiFrameProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  showGlow?: boolean;
  variant?: "default" | "glass" | "dark";
}

export function SciFiFrame({
  children,
  title,
  showGlow = true,
  variant = "default",
  className,
  ...props
}: SciFiFrameProps) {
  return (
    <div
      className={cn(
        "relative p-[2px] overflow-hidden transition-all duration-500 group",
        "scifi-clip",
        className
      )}
      {...props}
    >
      {/* Outer Border Glow */}
      {showGlow && (
        <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10" />
      )}

      {/* Main Content Area */}
      <div
        className={cn(
          "w-full h-full p-4 relative scifi-clip",
          variant === "default" && "glass border-white/5",
          variant === "glass" && "bg-white/5 backdrop-blur-3xl border-white/10",
          variant === "dark" && "glass-dark border-white/5"
        )}
      >
        {/* Decorative Technical Corners */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/30 rounded-tl-sm pointer-events-none" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/30 rounded-tr-sm pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/30 rounded-bl-sm pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/30 rounded-br-sm pointer-events-none" />

        {/* Header Ribbon if title exists */}
        {title && (
          <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
            <div className="w-1.5 h-4 bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
            <h3 className="text-[11px] uppercase font-bold tracking-[0.2em] text-slate-400 italic">
              {title}
            </h3>
            <div className="flex-1 h-[1px] bg-gradient-to-r from-white/10 to-transparent ml-2" />
          </div>
        )}

        {children}
      </div>

      {/* Tech line detail */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-cyan-500/20 blur-sm" />
    </div>
  );
}
