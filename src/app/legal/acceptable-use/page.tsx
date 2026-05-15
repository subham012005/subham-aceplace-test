export default function AcceptableUsePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050a0f", color: "#e2e8f0", fontFamily: "Inter, sans-serif", padding: "80px 24px 48px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(6,182,212,0.5)", marginBottom: "8px" }}>ACEPLACE SANDBOX</p>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#fff", margin: 0 }}>Acceptable Use Policy</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>Effective for Developer Sandbox / Public Runtime Preview environments.</p>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px", fontSize: "13px", lineHeight: "1.8", color: "rgba(255,255,255,0.5)" }}>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Permitted Use</strong><br />
          The sandbox may be used for: evaluating the ACEPLACE runtime, testing agent configurations, developing integrations in non-production environments, and educational purposes.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Prohibited Use</strong><br />
          You may not use the sandbox for: generating harmful, illegal, or offensive content; attempting to circumvent rate limits or quotas; reverse engineering the ACEPLACE runtime; commercial production workloads; or unauthorized access to third-party systems.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Enforcement</strong><br />
          Violations may result in immediate session termination, IP banning, and removal of sandbox access without notice.</p>
        </div>
      </div>
    </div>
  );
}
