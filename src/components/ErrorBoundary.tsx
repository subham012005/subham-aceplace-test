"use client";

/**
 * ErrorBoundary — Graceful error handling for runtime components.
 * T-033 | Sprint 6
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { HUDFrame } from "./HUDFrame";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught component error:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <HUDFrame
          title={this.props.title || "Runtime Error"}
          className="border-rose-500/30 bg-rose-500/5"
        >
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="relative">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
              <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">
                Component Fault Detected
              </p>
              {this.state.error && (
                <p className="text-[9px] font-mono text-slate-500 max-w-sm break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-[0.2em] transition-all"
            >
              <RotateCw className="w-3 h-3" />
              Reinitialize Component
            </button>
          </div>
        </HUDFrame>
      );
    }

    return this.props.children;
  }
}
