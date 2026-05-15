"use client";

export default function AcceptableUsePage() {
  const lastUpdated = "05/11/2026";

  return (
    <div className="min-h-screen stardust-bg tech-grid selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        {/* Header Section */}
        <header className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-cyan-500/50" />
            <span className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 font-bold text-glow-cyan">
              Runtime Conduct Protocol
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase">
            Acceptable <span className="text-cyan-500">Use</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40 uppercase tracking-widest">
            <p>Project: <span className="text-white/80">ACEPLACE™ Sandbox</span></p>
            <p>Policy ID: <span className="text-cyan-500/80">NXQ-AUP-2026</span></p>
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
                  1. Scope of Permitted Evaluation
                </h2>
                <p className="text-white/60 leading-relaxed">
                  The <span className="text-white font-semibold">ACEPLACE™ Sandbox</span> is provided for the sole purpose of non-production evaluation. Permitted activities include:
                </p>
                <ul className="text-xs text-white/50 space-y-2 mt-4 list-disc pl-5">
                  <li>Stress-testing multi-agent orchestration logic.</li>
                  <li>Developing and debugging runtime instruction profiles.</li>
                  <li>Integrating third-party LLM providers for experimental workflows.</li>
                  <li>Benchmarking autonomous execution latencies and success rates.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-red-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3 text-glow-red">
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  2. Strict Prohibitions
                </h2>
                <p className="text-white/60 leading-relaxed mb-4 font-medium italic">
                  Any attempt to weaponize or destabilize the runtime environment will result in immediate suspension. Prohibited activities include:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-sm">
                    <h3 className="text-[10px] text-red-400 uppercase tracking-widest mb-2 font-bold">Infrastructure Abuse</h3>
                    <ul className="list-none p-0 m-0 space-y-1 text-xs text-white/70">
                      <li>• Circumventing execution rate limits</li>
                      <li>• Deploying resource-heavy recursive loops</li>
                      <li>• Attempting unauthorized container breakout</li>
                      <li>• Reverse engineering proprietary ACELOGIC™ systems</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-sm">
                    <h3 className="text-[10px] text-red-400 uppercase tracking-widest mb-2 font-bold">Content Violations</h3>
                    <ul className="list-none p-0 m-0 space-y-1 text-xs text-white/70">
                      <li>• Generating malicious or unlawful automation</li>
                      <li>• Distributing prohibited/copyrighted datasets</li>
                      <li>• Social engineering or phishing automation</li>
                      <li>• Violating third-party AI provider safety policies</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  3. Enforcement &amp; Triage
                </h2>
                <p className="text-white/60 leading-relaxed">
                  NXQ employs automated heuristic monitoring to detect anomalous execution patterns. Upon detection of a violation:
                </p>
                <ul className="text-xs text-white/50 space-y-2 mt-4 list-disc pl-5">
                  <li>Active runtime sessions will be <span className="text-white font-bold">Instantly Terminated</span>.</li>
                  <li>Account access will be suspended pending manual review.</li>
                  <li>Source IP addresses may be blacklisted across the NXQ global edge network.</li>
                </ul>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  4. Reporting Vulnerabilities
                </h2>
                <p className="text-white/60 leading-relaxed">
                  If you discover a security vulnerability or infrastructure weakness within the Sandbox, we encourage responsible disclosure via our security portal.
                </p>
              </div>

              <div className="pt-8 border-t border-white/5 text-center">
                <p className="text-[10px] text-white/30 uppercase tracking-[0.2em]">
                  Failure to comply with these guidelines constitutes a breach of the Terms & Conditions.
                </p>
              </div>

            </div>
          </section>

          {/* Footer Branding */}
          <footer className="text-center py-12 opacity-40">
            <p className="text-[10px] uppercase tracking-[0.8em] text-white mb-2">NOVA X QUANTUM INC.</p>
            <p className="text-[9px] text-white/50">Runtime Governance • ACELOGIC Compliance Unit</p>
          </footer>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="fixed top-0 right-0 p-8 opacity-10 pointer-events-none">
        <div className="text-[60px] font-black text-white select-none uppercase leading-none">
          NXQ<br />CONDUCT
        </div>
      </div>
    </div>
  );
}
