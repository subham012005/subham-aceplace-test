export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050a0f", color: "#e2e8f0", fontFamily: "Inter, sans-serif", padding: "80px 24px 48px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(6,182,212,0.5)", marginBottom: "8px" }}>ACEPLACE SANDBOX</p>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#fff", margin: 0 }}>Terms &amp; Conditions</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>Effective for Developer Sandbox / Public Runtime Preview environments.</p>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px", fontSize: "13px", lineHeight: "1.8", color: "rgba(255,255,255,0.5)" }}>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>1. Sandbox Environment</strong><br />
          This is a non-production sandbox environment provided for evaluation purposes only. Usage is subject to rate limits, execution quotas, and may be terminated at any time without notice.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>2. User Responsibilities</strong><br />
          Users are solely responsible for their own API provider credentials, associated costs, and data submitted to the runtime. ACEPLACE does not store, log, or access user-provided credentials beyond the active session.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>3. No Warranty</strong><br />
          The sandbox is provided "AS IS" without warranty of any kind. ACEPLACE makes no guarantees regarding uptime, data retention, or output accuracy in sandbox environments.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>4. Limitation of Liability</strong><br />
          ACEPLACE shall not be liable for any loss of data, compute costs, or damages arising from use of the sandbox environment.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>5. Changes</strong><br />
          These terms may be updated at any time. Continued use of the sandbox after changes constitutes acceptance.</p>
        </div>
      </div>
    </div>
  );
}
