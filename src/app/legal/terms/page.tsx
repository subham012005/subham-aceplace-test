"use client";

export default function TermsPage() {
  const lastUpdated = "05/11/2026";

  return (
    <div className="min-h-screen stardust-bg tech-grid selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        {/* Header Section */}
        <header className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px w-12 bg-cyan-500/50" />
            <span className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 font-bold text-glow-cyan">
              Governance Framework
            </span>
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tight uppercase">
            Terms <span className="text-cyan-500">&amp;</span> Conditions
          </h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40 uppercase tracking-widest">
            <p>Project: <span className="text-white/80">ACEPLACE™ Sandbox</span></p>
            <p>Status: <span className="text-cyan-500/80">Public Runtime Preview</span></p>
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
                  1. Acceptance of Terms
                </h2>
                <p className="text-white/60 leading-relaxed">
                  By accessing, interacting with, or deploying workloads via the <span className="text-white font-semibold">ACEPLACE™ Sandbox</span> (the "Platform"), you signify your irrevocable acceptance of these Terms &amp; Conditions. These terms constitute a binding legal agreement between you and <span className="text-white font-semibold">NOVA X Quantum Inc. ("NXQ")</span>. If you do not agree to these terms, you must immediately cease all use of the Platform.
                </p>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  2. Platform Characterization
                </h2>
                <p className="text-white/60 leading-relaxed mb-4">
                  The Platform is an experimental <span className="text-cyan-500/80 italic font-medium">Public Runtime Preview</span> designed exclusively for evaluation, stress-testing, and demonstration of autonomous orchestration.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="bg-white/5 border border-white/10 p-4 rounded-sm">
                    <h3 className="text-[10px] text-white/40 uppercase tracking-widest mb-2 font-bold">Functional Scope</h3>
                    <ul className="list-none p-0 m-0 space-y-1 text-xs text-white/70">
                      <li>• Governed runtime orchestration</li>
                      <li>• Autonomous execution infrastructure</li>
                      <li>• Real-time telemetry &amp; observability</li>
                      <li>• Multi-agent workflow coordination</li>
                    </ul>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-sm">
                    <h3 className="text-[10px] text-red-400/60 uppercase tracking-widest mb-2 font-bold">Out of Scope</h3>
                    <ul className="list-none p-0 m-0 space-y-1 text-xs text-white/70">
                      <li>• Production-grade managed services</li>
                      <li>• Sovereign decision-making authority</li>
                      <li>• Replacement for human oversight</li>
                      <li>• Guaranteed data persistence</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  3. User Responsibility &amp; Autonomy
                </h2>
                <p className="text-white/60 leading-relaxed">
                  All runtime activity is initiated, configured, and controlled exclusively by the user. NXQ provides the infrastructure but does not supervise, validate, or approve the specific outputs generated. You maintain sole responsibility for:
                </p>
                <ul className="text-xs text-white/50 grid grid-cols-1 sm:grid-cols-2 gap-y-2 mt-4 list-disc pl-5">
                  <li>Account security and session integrity</li>
                  <li>Prompts, inputs, and instructional context</li>
                  <li>Third-party API credentials and billing</li>
                  <li>Deployment of generated code or outputs</li>
                  <li>Compliance with global and local regulations</li>
                </ul>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  4. Third-Party Intelligence Providers
                </h2>
                <p className="text-white/60 leading-relaxed">
                  The Platform facilitates connection to third-party AI providers (e.g., OpenAI, Anthropic, Google). NXQ is <span className="text-white font-medium uppercase underline decoration-red-500/50 underline-offset-4">not responsible</span> for model hallucinations, provider outages, or the accuracy of third-party system behaviors. Use of these providers remains subject to their respective terms of service.
                </p>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  5. Sandbox Volatility
                </h2>
                <p className="text-white/60 leading-relaxed italic">
                  NXQ reserves the right to enforce rate limits, reset active sessions, delete ephemeral artifacts, or suspend infrastructure availability without prior notice to maintain platform stability.
                </p>
              </div>

              <div>
                <h2 className="text-cyan-400 text-lg font-bold uppercase tracking-tighter mb-4 flex items-center gap-3">
                  <span className="h-2 w-2 bg-cyan-500 rounded-full" />
                  6. Acceptable Use Policy
                </h2>
                <p className="text-white/60 leading-relaxed">
                  Prohibited activities include, but are not limited to: deploying malicious automation, reverse engineering platform architecture, interfering with runtime stability, or generating unlawful content. Violation may result in immediate and permanent account termination.
                </p>
              </div>

              <div className="pt-8 border-t border-white/5">
                <div className="flex flex-col md:flex-row justify-between gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Legal Jurisdiction</h3>
                    <p className="text-[10px] text-white/40 leading-relaxed max-w-xs">
                      These Terms are governed by the laws of the State of Alabama, United States. Disputes shall be resolved within the appropriate jurisdictions of the same.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest">Contact Repository</h3>
                    <div className="text-[10px] text-cyan-500/60 font-mono space-y-1">
                      <p>legal@novaxquantum.com</p>
                      <p>licensing@novaxquantum.com</p>
                      <p>www.aceplace.ai</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Footer Branding */}
          <footer className="text-center py-12 opacity-40">
            <p className="text-[10px] uppercase tracking-[0.8em] text-white mb-2">NOVA X QUANTUM INC.</p>
            <p className="text-[9px] text-white/50">Copyright © 2026. All rights reserved. ACEPLACE™ and ACELOGIC™ are trademarks of NXQ.</p>
          </footer>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="fixed top-0 right-0 p-8 opacity-10 pointer-events-none">
        <div className="text-[60px] font-black text-white select-none uppercase leading-none">
          NXQ<br />LEGAL
        </div>
      </div>
      <div className="fixed bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none" />
    </div>
  );
}
