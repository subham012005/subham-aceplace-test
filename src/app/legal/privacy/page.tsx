"use client";

export default function PrivacyPage() {
  const lastUpdated = "05/11/2026";

  return (
    <div className="min-h-screen stardust-bg tech-grid selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        {/* Header Section */}
        <header className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-cyan-500/50" />
            <span className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 font-bold text-glow-cyan">
              Data Sovereignty Protocol
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase">
            Privacy <span className="text-cyan-500">&amp;</span> Telemetry
          </h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40 uppercase tracking-widest">
            <p>Project: <span className="text-white/80">ACEPLACE™ Sandbox</span></p>
            <p>Policy ID: <span className="text-cyan-500/80">NXQ-PRIV-2026</span></p>
            <p>Revision: <span className="text-white/80">{lastUpdated}</span></p>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid gap-8">
          <section className="scifi-glass p-8 hud-border animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
            <div className="prose prose-invert prose-sm max-w-none space-y-12">
              
              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full animate-pulse" />
                  1. Operational Philosophy
                </h2>
                <p className="text-white/60 leading-relaxed">
                  The <span className="text-white font-semibold">ACEPLACE™ Sandbox</span> is architected to minimize the retention of sensitive user content. Our primary objective is to maintain a high-performance runtime environment while ensuring that user data remains ephemeral and governed by user intent.
                </p>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  2. Telemetry &amp; Log Collection
                </h2>
                <p className="text-white/60 leading-relaxed mb-4">
                  To ensure infrastructure stability and platform security, NXQ collects limited operational metrics during runtime execution:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-sm">
                    <h3 className="text-[10px] text-white/40 uppercase tracking-widest mb-2 font-bold">Infrastucture Metrics</h3>
                    <ul className="list-none p-0 m-0 space-y-1 text-xs text-white/70">
                      <li>• CPU / Memory utilization per session</li>
                      <li>• Network throughput and latency</li>
                      <li>• Execution success/failure rates</li>
                      <li>• Rate limit triggers and concurrency</li>
                    </ul>
                  </div>
                  <div className="bg-cyan-500/5 border border-cyan-500/10 p-4 rounded-sm">
                    <h3 className="text-[10px] text-cyan-400/60 uppercase tracking-widest mb-2 font-bold">Security Auditing</h3>
                    <ul className="list-none p-0 m-0 space-y-1 text-xs text-white/70">
                      <li>• Access logs (IP, User Agent, Timestamp)</li>
                      <li>• Authentication event records</li>
                      <li>• API call frequency (per provider)</li>
                      <li>• Error diagnostics &amp; crash reports</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  3. Credential Handling
                </h2>
                <p className="text-white/60 leading-relaxed">
                  Any third-party API credentials (e.g., OpenAI, Anthropic) provided to the Platform are handled with extreme caution. These keys are:
                </p>
                <ul className="text-xs text-white/50 space-y-2 mt-4 list-disc pl-5">
                  <li>Used exclusively to facilitate direct inference requests during active sessions.</li>
                  <li>Injected into the runtime environment via encrypted memory streams.</li>
                  <li><span className="text-white font-medium italic underline decoration-cyan-500/50">Never</span> stored in persistent databases or long-term logs by NXQ.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  4. Data Retention &amp; Cleanup
                </h2>
                <p className="text-white/60 leading-relaxed">
                  Sandbox environments are ephemeral. To prevent infrastructure bloat, NXQ implements the following cleanup protocols:
                </p>
                <ul className="text-xs text-white/50 space-y-2 mt-4 list-disc pl-5">
                  <li><span className="text-white font-medium">Session Termination:</span> Inactive sessions are pruned after 120 minutes.</li>
                  <li><span className="text-white font-medium">Artifact Deletion:</span> Generated files and ephemeral data are purged after 48 hours.</li>
                  <li><span className="text-white font-medium">No Backup:</span> NXQ does not maintain backups of sandbox-generated content.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  5. Security Standards
                </h2>
                <p className="text-white/60 leading-relaxed">
                  All communications within the ACEPLACE ecosystem are encrypted in transit. Access to runtime logs is restricted to authorized NXQ personnel for the purpose of abuse prevention and platform maintenance.
                </p>
              </div>

              <div className="pt-8 border-t border-white/5">
                <div className="flex flex-col md:flex-row justify-between gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Compliance Statement</h3>
                    <p className="text-[10px] text-white/40 leading-relaxed max-w-xs">
                      This policy is designed to align with industry standard security protocols and US privacy laws. Users are responsible for ensuring their use of the platform complies with their local regulatory requirements.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Inquiries</h3>
                    <div className="text-[10px] text-cyan-500/60 font-mono space-y-1">
                      <p>privacy@novaxquantum.com</p>
                      <p>compliance@novaxquantum.com</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Footer Branding */}
          <footer className="text-center py-12 opacity-40">
            <p className="text-[10px] uppercase tracking-[0.8em] text-white mb-2">NOVA X QUANTUM INC.</p>
            <p className="text-[9px] text-white/50">Privacy Protocol Rev 4.02 // Alabama, USA</p>
          </footer>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="fixed top-0 right-0 p-8 opacity-10 pointer-events-none">
        <div className="text-[60px] font-black text-white select-none uppercase leading-none">
          NXQ<br />PRIVACY
        </div>
      </div>
    </div>
  );
}
