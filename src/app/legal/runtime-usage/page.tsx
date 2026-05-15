import { USAGE_LIMITS, RATE_LIMITS, STORAGE_LIMITS, FIRESTORE_CAPS } from "@/lib/sandbox-config";

export default function RuntimeUsagePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050a0f", color: "#e2e8f0", fontFamily: "Inter, sans-serif", padding: "80px 24px 48px" }}>
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(6,182,212,0.5)", marginBottom: "8px" }}>ACEPLACE SANDBOX</p>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#fff", margin: 0 }}>Runtime Usage Policy</h1>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>Effective for Developer Sandbox / Public Runtime Preview environments.</p>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px", fontSize: "13px", lineHeight: "1.8", color: "rgba(255,255,255,0.5)" }}>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Execution Limits</strong></p>
          <ul style={{ marginLeft: "20px" }}>
            <li>Max executions per day: <strong style={{ color: "#fff" }}>{USAGE_LIMITS.MAX_EXECUTIONS_PER_DAY}</strong></li>
            <li>Max active runtime envelopes: <strong style={{ color: "#fff" }}>{USAGE_LIMITS.MAX_ACTIVE_RUNTIME_ENVELOPES}</strong></li>
            <li>Cooldown between executions: <strong style={{ color: "#fff" }}>{USAGE_LIMITS.COOLDOWN_BETWEEN_EXECUTIONS_SECONDS}s</strong></li>
            <li>Total queued steps quota: <strong style={{ color: "#fff" }}>{USAGE_LIMITS.EXECUTION_QUOTA_TOTAL_STEPS}</strong></li>
          </ul>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Rate Limits</strong></p>
          <ul style={{ marginLeft: "20px" }}>
            <li>IP requests per minute: <strong style={{ color: "#fff" }}>{RATE_LIMITS.IP_REQUESTS_PER_MINUTE}</strong></li>
            <li>API requests per user per minute: <strong style={{ color: "#fff" }}>{RATE_LIMITS.USER_REQUESTS_PER_MINUTE}</strong></li>
            <li>WebSocket messages per second: <strong style={{ color: "#fff" }}>{RATE_LIMITS.WS_MESSAGES_PER_SECOND}</strong></li>
          </ul>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Storage</strong></p>
          <ul style={{ marginLeft: "20px" }}>
            <li>Max artifact storage: <strong style={{ color: "#fff" }}>{STORAGE_LIMITS.MAX_ARTIFACT_BYTES_PER_USER / (1024 * 1024)}MB per user</strong></li>
            <li>Artifact expiration: <strong style={{ color: "#fff" }}>{STORAGE_LIMITS.ARTIFACT_EXPIRATION_HOURS}h after creation</strong></li>
            <li>Session inactivity timeout: <strong style={{ color: "#fff" }}>{STORAGE_LIMITS.SESSION_INACTIVITY_CLEANUP_MINUTES}min</strong></li>
          </ul>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>Firestore Caps</strong></p>
          <ul style={{ marginLeft: "20px" }}>
            <li>Max writes per user per hour: <strong style={{ color: "#fff" }}>{FIRESTORE_CAPS.MAX_WRITES_PER_USER_PER_HOUR}</strong></li>
            <li>Max reads per user per hour: <strong style={{ color: "#fff" }}>{FIRESTORE_CAPS.MAX_READS_PER_USER_PER_HOUR}</strong></li>
            <li>Max telemetry events per day: <strong style={{ color: "#fff" }}>{FIRESTORE_CAPS.MAX_TELEMETRY_EVENTS_PER_DAY}</strong></li>
            <li>Queue overload threshold: <strong style={{ color: "#fff" }}>{FIRESTORE_CAPS.QUEUE_OVERLOAD_THRESHOLD} envelopes</strong></li>
          </ul>
          <p><strong style={{ color: "rgba(255,255,255,0.8)" }}>API Credentials</strong><br />
          The ACEPLACE runtime routes inference through user-provided API credentials (e.g., OpenAI, Anthropic keys). You are solely responsible for any costs incurred by your configured providers.</p>
        </div>
      </div>
    </div>
  );
}
