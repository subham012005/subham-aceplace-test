"use client";

/**
 * ProtocolViewer — Debug viewer for #us# protocol messages.
 * T-038 | Sprint 6
 */

import React, { useState } from "react";
import { Terminal, ChevronDown, ChevronRight, Radio } from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { cn } from "@/lib/utils";
import type { ProtocolMessage } from "@aceplace/runtime-core";

interface ProtocolViewerProps {
  executionId?: string;
  messages?: ProtocolMessage[];
  loading?: boolean;
}

interface MessageRowProps {
  message: ProtocolMessage;
}

const VERB_COLORS: Record<string, string> = {
  "us#.task.plan": "text-blue-400 border-blue-500/30 bg-blue-500/10",
  "us#.task.research": "text-purple-400 border-purple-500/30 bg-purple-500/10",
  "us#.artifact.produce": "text-amber-400 border-amber-500/30 bg-amber-500/10",
  "us#.artifact.grade": "text-orange-400 border-orange-500/30 bg-orange-500/10",
  "us#.governance.approve": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  "us#.governance.reject": "text-rose-400 border-rose-500/30 bg-rose-500/10",
  "us#.system.checkpoint": "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
};

function MessageRow({ message }: MessageRowProps) {
  const [expanded, setExpanded] = useState(false);

  // Defensive access for v1.0 vs legacy formats
  const verb = message.message_type || (message as unknown as { verb: string }).verb;
  const senderId = message.identity?.agent_id || (message as unknown as { sender_agent_id: string }).sender_agent_id;
  const targetId = (message as unknown as { target_agent_id: string }).target_agent_id; // Phase 2 protocol has no explicit target, fallback to broadcast
  const stepId = message.execution?.step_id || (message as unknown as { step_id: string }).step_id;

  const verbColor = VERB_COLORS[verb] || "text-slate-400 border-slate-500/30 bg-slate-500/10";

  return (
    <div className="border border-white/5 hover:border-white/10 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-slate-600 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        )}
        <span className={cn("text-[8px] font-black uppercase tracking-widest border px-2 py-0.5 shrink-0", verbColor)}>
          {verb}
        </span>
        <span className="text-[8px] font-mono text-slate-500 truncate flex-1">
          {senderId} → {targetId ?? "broadcast"}
        </span>
        <span className="text-[7px] font-mono text-slate-700 shrink-0">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </button>

      {expanded && (
        <div className="px-7 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Message ID</span>
              <p className="text-[8px] font-mono text-cyan-500">{message.message_id}</p>
            </div>
            <div>
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600">Step Ref</span>
              <p className="text-[8px] font-mono text-slate-400">{stepId || "—"}</p>
            </div>
          </div>
          {message.payload && (
            <div>
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 block mb-1">Payload</span>
              <pre className="text-[8px] font-mono text-slate-400 bg-black/40 p-2 border border-white/5 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(message.payload, null, 2)}
              </pre>
            </div>
          )}
          {(message.metadata && Object.keys(message.metadata).length > 0) && (
            <div>
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-600 block mb-1">Metadata</span>
              <pre className="text-[8px] font-mono text-slate-300 bg-black/40 p-2 border border-white/5 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(message.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProtocolViewer({ executionId, messages = [], loading = false }: ProtocolViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <HUDFrame
      title="Protocol Viewer"
      subtitle="#us# Message Log"
      headerAction={
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
        >
          <Radio className="w-3 h-3" />
          {isOpen ? "Collapse" : "Expand"}
        </button>
      }
    >
      {isOpen && (
        <div className="space-y-1 mt-2 max-h-[400px] overflow-y-auto custom-scroll">
          {loading ? (
            <div className="flex items-center gap-2 p-4 justify-center">
              <Terminal className="w-4 h-4 text-cyan-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Reading Protocol Stream...
              </span>
            </div>
          ) : messages.length === 0 ? (
            <div className="p-6 text-center text-[9px] uppercase font-black tracking-[0.3em] text-slate-600 italic border border-dashed border-white/5">
              {executionId ? "No messages for this execution." : "No execution selected."}
            </div>
          ) : (
            messages.map((msg) => (
              <MessageRow key={msg.message_id} message={msg} />
            ))
          )}
        </div>
      )}
    </HUDFrame>
  );
}
