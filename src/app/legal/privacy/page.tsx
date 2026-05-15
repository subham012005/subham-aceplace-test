export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050a0f", color: "#e2e8f0", fontFamily: "Inter, sans-serif", padding: "80px 24px 48px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(6,182,212,0.5)", marginBottom: "8px" }}>ACEPLACE SANDBOX</p>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#fff", margin: 0 }}>Privacy Policy</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>Effective for Developer Sandbox / Public Runtime Preview environments.</p>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px", fontSize: "13px", lineHeight: "1.8", color: "rgba(255,255,255,0.5)" }}>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Data We Collect</strong><br />
          In the sandbox environment, we collect email addresses for authentication, IP addresses for rate limiting and abuse prevention, timestamps of legal acceptance, and runtime job metadata (prompts, outputs, statuses).</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>API Credentials</strong><br />
          User-provided API keys are used only for the duration of the active session to route inference requests. They are not stored persistently beyond the session.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Data Retention</strong><br />
          Sandbox data is subject to automatic cleanup after {`${48}`} hours of inactivity. Sessions inactive for {`${120}`} minutes may be terminated.</p>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Third Parties</strong><br />
          ACEPLACE uses Firebase (Google) for authentication and database storage. Your use is also subject to Google's privacy policy.</p>
        </div>
      </div>
    </div>
  );
}
