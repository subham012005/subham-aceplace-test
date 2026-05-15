"use client";

import React from "react";
import { Radio } from "lucide-react";

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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "12px 16px",
          position: "relative",
        }}
      >

        {/* Main text */}
        <div style={{ textAlign: "center" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "rgba(234,179,8,1)",
              display: "inline",
            }}
          >
            DEVELOPER SANDBOX
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "rgba(255,255,255,0.2)",
              margin: "0 8px",
            }}
          >
            |
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 900,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "rgba(234,179,8,1)",
              display: "inline",
            }}
          >
            PUBLIC RUNTIME PREVIEW
          </span>
          <span
            style={{
              display: "block",
              fontSize: "10px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.08em",
              marginTop: "2px",
            }}
          >
            Sandbox environment for ACEPLACE runtime evaluation. Not a licensed
            production deployment.
          </span>
        </div>

        {/* Sandbox Active chip — top-right absolute */}
        <SandboxStatusChip />
      </div>
    </div>
  );
}

/**
 * SandboxStatusChip
 * Small "SANDBOX ACTIVE" pill anchored to the right side of the banner.
 */
export function SandboxStatusChip() {
  return (
    <div
      aria-label="Sandbox active indicator"
      style={{
        position: "absolute",
        right: "16px",
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 8px",
        border: "1px solid rgba(234,179,8,0.3)",
        borderRadius: "4px",
        background: "rgba(234,179,8,0.07)",
      }}
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
      <span
        style={{
          fontSize: "8.5px",
          fontWeight: 900,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(234,179,8,0.9)",
          whiteSpace: "nowrap",
        }}
      >
        SANDBOX ACTIVE
      </span>
      {/* Inline keyframes via style tag — only injected once */}
      <style>{`
        @keyframes sandbox-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
