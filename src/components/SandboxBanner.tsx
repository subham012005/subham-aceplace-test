"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * SandboxBanner
 * Fixed top banner indicating this is a Developer Sandbox / Public Runtime Preview.
 * Must be rendered at the root layout level or inside the page wrapper.
 */
export function SandboxBanner() {
  return (
    <div
      role="banner"
      aria-label="Sandbox environment notice"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        borderBottom: "1px solid rgba(234, 179, 8, 0.25)",
        background:
          "linear-gradient(90deg, rgba(0,0,0,0.97) 0%, rgba(20,14,0,0.98) 50%, rgba(0,0,0,0.97) 100%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {/* Amber scan-line accent */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(234,179,8,0.015) 2px, rgba(234,179,8,0.015) 4px)",
          pointerEvents: "none",
        }}
      />

      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 py-2.5 px-4 relative min-h-[38px] md:min-h-[44px]">
        {/* Main text — responsive font-size (10px on mobile, 14px on PC/desktop) */}
        <div className="text-center leading-normal md:leading-none flex items-center justify-center flex-wrap gap-x-1.5 gap-y-0.5">
          <span className="text-[10px] md:text-[14px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em] text-amber-500">
            DEVELOPER SANDBOX
          </span>
          <span className="text-[9px] md:text-[12px] font-bold text-white/25 mx-0.5">
            |
          </span>
          <span className="text-[10px] md:text-[14px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em] text-amber-500">
            PUBLIC RUNTIME PREVIEW
          </span>
          {/* Subtitle — hidden on mobile, visible on desktop */}
          <span className="hidden lg:inline text-[9px] md:text-[11px] font-semibold text-white/40 tracking-wider ml-1">
            · Sandbox environment for ACEPLACE runtime evaluation. Not a licensed production deployment.
          </span>
        </div>

        {/* Sandbox Active chip */}
        <SandboxStatusChip />
      </div>
    </div>
  );
}

/**
 * SandboxStatusChip
 * Small "SANDBOX ACTIVE" pill:
 * - Positioned relatively in flex flow on mobile (preventing any overlap)
 * - Absolute anchored to the right side on desktop (where screen is wide)
 */
export function SandboxStatusChip() {
  return (
    <div
      aria-label="Sandbox active indicator"
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 border border-amber-500/35 bg-amber-500/10 rounded-[3px] shrink-0",
        "relative md:absolute md:right-4 md:top-1/2 md:-translate-y-1/2"
      )}
    >
      {/* Blinking dot */}
      <span
        style={{
          width: "5px",
          height: "5px",
          borderRadius: "50%",
          background: "#eab308",
          display: "block",
          animation: "sandbox-blink 1.4s ease-in-out infinite",
        }}
      />
      <span className="text-[8.5px] md:text-[9.5px] font-black tracking-widest text-amber-500 uppercase whitespace-nowrap">
        SANDBOX ACTIVE
      </span>
      {/* Inline keyframes via style tag */}
      <style>{`
        @keyframes sandbox-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
