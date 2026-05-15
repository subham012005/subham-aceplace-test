"use client";

import { USAGE_LIMITS, RATE_LIMITS, STORAGE_LIMITS, FIRESTORE_CAPS } from "@/lib/sandbox-config";

export default function RuntimeUsagePage() {
  const lastUpdated = "05/11/2026";

  return (
    <div className="min-h-screen stardust-bg tech-grid selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        {/* Header Section */}
        <header className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-cyan-500/50" />
            <span className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 font-bold text-glow-cyan">
              Resource Allocation Protocol
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase">
            Runtime <span className="text-cyan-500">Usage</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40 uppercase tracking-widest">
            <p>Project: <span className="text-white/80">ACEPLACE™ Sandbox</span></p>
            <p>Config Version: <span className="text-cyan-500/80">v{lastUpdated.replace(/\//g, ".")}</span></p>
            <p>Revision: <span className="text-white/80">{lastUpdated}</span></p>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid gap-8">
          <section className="scifi-glass p-8 hud-border animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            <div className="prose prose-invert prose-sm max-w-none space-y-12">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Execution Limits */}
                <div className="space-y-6">
                  <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                    <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full" />
                    Execution Quotas
                  </h2>
                  <div className="space-y-4">
                    <UsageItem label="Max Executions / Day" value={USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY} />
                    <UsageItem label="Active Runtime Envelopes" value={USAGE_LIMITS.MAX_ACTIVE_RUNTIME_ENVELOPES} />
                    <UsageItem label="Cooldown Interval" value={`${USAGE_LIMITS.COOLDOWN_BETWEEN_EXECUTIONS_SECONDS}s`} />
                    <UsageItem label="Total Step Quota" value={USAGE_LIMITS.EXECUTION_QUOTA_TOTAL_STEPS} />
                  </div>
                </div>

                {/* Rate Limits */}
                <div className="space-y-6">
                  <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                    <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full" />
                    Throughput Limits
                  </h2>
                  <div className="space-y-4">
                    <UsageItem label="IP Requests / Minute" value={RATE_LIMITS.IP_REQUESTS_PER_MINUTE} />
                    <UsageItem label="User API Requests / Min" value={RATE_LIMITS.USER_REQUESTS_PER_MINUTE} />
                    <UsageItem label="WebSocket Message Rate" value={`${RATE_LIMITS.WS_MESSAGES_PER_SECOND}/s`} />
                  </div>
                </div>

                {/* Storage */}
                <div className="space-y-6">
                  <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                    <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full" />
                    Storage &amp; Persistence
                  </h2>
                  <div className="space-y-4">
                    <UsageItem label="Artifact Storage" value={`${Math.round(STORAGE_LIMITS.MAX_ARTIFACT_BYTES_PER_USER / (1024 * 1024))}MB`} />
                    <UsageItem label="Artifact Expiration" value={`${STORAGE_LIMITS.ARTIFACT_EXPIRATION_HOURS}h`} />
                    <UsageItem label="Session Timeout" value={`${STORAGE_LIMITS.SESSION_INACTIVITY_CLEANUP_MINUTES}min`} />
                  </div>
                </div>

                {/* Firestore Caps */}
                <div className="space-y-6">
                  <h2 className="text-cyan-400 text-sm font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                    <span className="h-1.5 w-1.5 bg-cyan-500 rounded-full" />
                    Database Governance
                  </h2>
                  <div className="space-y-4">
                    <UsageItem label="Writes / User / Hour" value={FIRESTORE_CAPS.MAX_WRITES_PER_USER_PER_HOUR} />
                    <UsageItem label="Reads / User / Hour" value={FIRESTORE_CAPS.MAX_READS_PER_USER_PER_HOUR} />
                    <UsageItem label="Telemetry Limit / Day" value={FIRESTORE_CAPS.MAX_TELEMETRY_EVENTS_PER_DAY} />
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <div className="bg-cyan-500/5 border border-cyan-500/10 p-6 rounded-sm">
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-3">Cost Transparency Notice</h3>
                  <p className="text-xs text-white/50 leading-relaxed">
                    The Platform operates as an orchestration layer. All costs associated with third-party model inference (OpenAI, Anthropic, etc.) are the sole responsibility of the user via their provided API credentials. ACEPLACE does not add surcharges to third-party API usage within the Sandbox environment.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {/* Footer Branding */}
          <footer className="text-center py-12 opacity-40">
            <p className="text-[10px] uppercase tracking-[0.8em] text-white mb-2">NOVA X QUANTUM INC.</p>
            <p className="text-[9px] text-white/50">Infrastructure Allocation Matrix // Node: NXQ-Sandbox-Alpha</p>
          </footer>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="fixed top-0 right-0 p-8 opacity-10 pointer-events-none">
        <div className="text-[60px] font-black text-white select-none uppercase leading-none text-right">
          RUNTIME<br />MATRIX
        </div>
      </div>
    </div>
  );
}

function UsageItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center group">
      <span className="text-[10px] text-white/40 uppercase tracking-widest group-hover:text-white/60 transition-colors">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-white/5" />
        <span className="text-xs font-mono text-cyan-400 font-bold tabular-nums">
          {value}
        </span>
      </div>
    </div>
  );
}
