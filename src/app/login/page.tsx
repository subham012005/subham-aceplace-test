"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HUDFrame } from "@/components/HUDFrame";
import { SandboxBanner } from "@/components/SandboxBanner";
import { cn } from "@/lib/utils";
import {
  LogIn,
  UserPlus,
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  Info,
  CheckSquare,
  Square,
} from "lucide-react";
import { SANDBOX_NOTICES, POLICY_LINKS, TERMS_VERSION } from "@/lib/sandbox-config";

// ─── Policy link component ─────────────────────────────────────────────────────
function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        color: "rgba(6,182,212,0.9)",
        textDecoration: "underline",
        textDecorationColor: "rgba(6,182,212,0.3)",
        textUnderlineOffset: "2px",
        transition: "color 0.15s, text-decoration-color 0.15s",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLElement).style.color = "rgba(6,182,212,1)";
        (e.target as HTMLElement).style.textDecorationColor = "rgba(6,182,212,0.8)";
      }}
      onMouseLeave={(e) => {
        (e.target as HTMLElement).style.color = "rgba(6,182,212,0.9)";
        (e.target as HTMLElement).style.textDecorationColor = "rgba(6,182,212,0.3)";
      }}
    >
      {children}
    </a>
  );
}

// ─── Legal checkbox component ──────────────────────────────────────────────────
function LegalCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Legal agreement"
      style={{
        padding: "10px 12px",
        border: checked
          ? "1px solid rgba(6,182,212,0.3)"
          : "1px solid rgba(255,255,255,0.07)",
        background: checked ? "rgba(6,182,212,0.04)" : "rgba(0,0,0,0.25)",
        borderRadius: "6px",
        transition: "all 0.2s",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => onChange(!checked)}
    >
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
        {/* Checkbox icon */}
        <div style={{ flexShrink: 0, marginTop: "1px" }}>
          {checked ? (
            <CheckSquare size={14} style={{ color: "rgba(6,182,212,0.9)" }} />
          ) : (
            <Square size={14} style={{ color: "rgba(255,255,255,0.25)" }} />
          )}
        </div>

        {/* Legal text with policy links */}
        <p
          style={{
            fontSize: "10px",
            lineHeight: "1.6",
            color: checked ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.4)",
            transition: "color 0.2s",
            margin: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          I agree to the{" "}
          <PolicyLink href={POLICY_LINKS.TERMS_CONDITIONS}>Terms &amp; Conditions</PolicyLink>,{" "}
          <PolicyLink href={POLICY_LINKS.PRIVACY_POLICY}>Privacy Policy</PolicyLink>,{" "}
          <PolicyLink href={POLICY_LINKS.ACCEPTABLE_USE}>Acceptable Use Policy</PolicyLink>,{" "}
          and{" "}
          <PolicyLink href={POLICY_LINKS.RUNTIME_USAGE}>Runtime Usage Policy</PolicyLink>.
        </p>
      </div>
    </div>
  );
}

// ─── Sandbox notices panel ─────────────────────────────────────────────────────
function SandboxNotices() {
  return (
    <div
      style={{
        padding: "10px 12px",
        border: "1px solid rgba(234,179,8,0.15)",
        background: "rgba(234,179,8,0.03)",
        borderRadius: "6px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <Info size={10} style={{ color: "rgba(234,179,8,0.7)", flexShrink: 0 }} />
        <span
          style={{
            fontSize: "9px",
            fontWeight: 900,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(234,179,8,0.6)",
          }}
        >
          Sandbox Notice
        </span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "4px" }}>
        {SANDBOX_NOTICES.map((notice, i) => (
          <li
            key={i}
            style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}
          >
            <span
              style={{
                width: "3px",
                height: "3px",
                borderRadius: "50%",
                background: "rgba(234,179,8,0.5)",
                flexShrink: 0,
                marginTop: "5px",
              }}
            />
            <span
              style={{
                fontSize: "9.5px",
                lineHeight: "1.5",
                color: "rgba(255,255,255,0.35)",
              }}
            >
              {notice}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  // ── Log legal acceptance to backend ────────────────────────────────────────
  const logLegalAcceptance = async (userId: string) => {
    try {
      await fetch("/api/sandbox/legal-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          termsVersion: TERMS_VERSION,
          acceptedAt: new Date().toISOString(),
          acceptance: true,
        }),
      });
    } catch {
      // Non-blocking — log failure silently
      console.warn("[SANDBOX] Failed to log legal acceptance");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin && !legalAccepted) return;
    setError("");
    setLoading(true);

    try {
      let userCred;
      if (isLogin) {
        userCred = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCred = await createUserWithEmailAndPassword(auth, email, password);
        // Log legal acceptance on new account creation
        await logLegalAcceptance(userCred.user.uid);
      }
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || "Authentication failed. Check your coordinates.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!legalAccepted) {
      setError("Please accept the Terms & Conditions before initializing your Nexus ID session.");
      return;
    }

    const provider = new GoogleAuthProvider();
    try {
      const userCred = await signInWithPopup(auth, provider);
      // For Google sign-in, only log if signing up for the first time
      // (isNewUser from additionalUserInfo — simplified: log on every Google sign-in for sandbox)
      await logLegalAcceptance(userCred.user.uid);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Google sign-in failed.");
    }
  };

  return (
    <>
      {/* Fixed top banner */}
      <SandboxBanner />

      {/* Page — push content below fixed banner */}
      <div
        className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center p-4 tech-grid scanline"
        style={{ paddingTop: "72px" }}
      >
        <div className="w-full max-w-md relative z-10">

          {/* ── Header branding ──────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            {/* Unified logo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                marginBottom: "16px",
              }}
            >
              <img
                src="/ace-symbol.png"
                alt="ACEPLACE"
                style={{ height: "40px", width: "auto", objectFit: "contain" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: 900,
                    color: "#fff",
                    fontStyle: "italic",
                    letterSpacing: "-0.04em",
                    lineHeight: 1,
                  }}
                >
                  ACEPLACE
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                    lineHeight: 1.2,
                  }}
                >
                  Workstation
                </span>
              </div>
            </div>

            <p
              style={{
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                color: "rgba(6,182,212,0.45)",
                margin: 0,
              }}
            >
              Sandbox Access
            </p>
          </div>

          {/* ── Auth Card ─────────────────────────────────────────────────────── */}
          <HUDFrame
            title={isLogin ? "AUTHORIZATION REQUIRED" : "CREATE NEW IDENTITY"}
            className="p-6"
          >
            <div className="space-y-5">

              {/* Shield icon */}
              <div className="flex items-center justify-center">
                <div className="relative">
                  <div
                    className="absolute inset-0 rounded-full animate-pulse"
                    style={{ background: "rgba(6,182,212,0.1)", filter: "blur(12px)" }}
                  />
                  <div
                    className="relative w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm"
                    style={{
                      border: "1px solid rgba(6,182,212,0.25)",
                      background: "rgba(6,182,212,0.04)",
                    }}
                  >
                    <ShieldCheck className="w-6 h-6 text-cyan-500" />
                  </div>
                </div>
              </div>

              {/* Sandbox notices — always visible */}
              <SandboxNotices />

              {/* Error */}
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-[11px] font-bold text-rose-500 uppercase tracking-widest leading-tight">
                    {error}
                  </p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 px-1">
                    Dimensional ID (Email)
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@aceplace.system"
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-500 px-1">
                    Access Protocol (Password)
                  </label>
                  <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                    </div>
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                    />
                  </div>
                </div>

                {/* Legal checkbox — required for all auth methods in Sandbox */}
                <LegalCheckbox
                  checked={legalAccepted}
                  onChange={setLegalAccepted}
                />

                {/* Submit button */}
                <button
                  id={isLogin ? "btn-login-submit" : "btn-signup-submit"}
                  type="submit"
                  disabled={loading || !legalAccepted}
                  className={cn(
                    "w-full p-4 mt-2 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all font-black uppercase tracking-[0.2em] text-[11px] relative group overflow-hidden scifi-clip",
                    (loading || !legalAccepted) && "opacity-40 cursor-not-allowed"
                  )}
                  style={{
                    borderColor:
                      !legalAccepted
                        ? "rgba(255,255,255,0.08)"
                        : undefined,
                  }}
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                    ) : isLogin ? (
                      <LogIn className="w-4 h-4" />
                    ) : (
                      <UserPlus className="w-4 h-4" />
                    )}
                    <span>
                      {loading
                        ? "AUTHENTICATING..."
                        : isLogin
                        ? "INITIALIZE SESSION"
                        : "CREATE ACCOUNT"}
                    </span>
                  </div>
                  {/* Hover fill — only when not disabled */}
                  {(isLogin || legalAccepted) && (
                    <div className="absolute inset-0 bg-cyan-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-4 py-1">
                <div className="flex-1 h-[1px] bg-white/5" />
                <span className="text-[10px] font-black text-slate-600 tracking-widest italic">
                  OR
                </span>
                <div className="flex-1 h-[1px] bg-white/5" />
              </div>

              <button
                id="btn-google-signin"
                onClick={handleGoogleSignIn}
                className={cn(
                  "w-full p-3 border border-white/5 bg-white/5 hover:bg-white/10 transition-all font-bold text-[11px] uppercase tracking-widest flex items-center justify-center gap-3",
                  !legalAccepted && "opacity-50 grayscale-[0.5]"
                )}
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  className="w-4 h-4"
                  alt="Google"
                />
                Continue with Nexus ID
              </button>

              {/* Switch mode */}
              <div className="pt-2 text-center">
                <button
                  id="btn-switch-auth-mode"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setLegalAccepted(false);
                    setError("");
                  }}
                  className="text-[10px] font-black text-cyan-500/50 hover:text-cyan-500 transition-colors uppercase tracking-[0.2em]"
                >
                  {isLogin
                    ? "New to ACEPLACE? Create an identity →"
                    : "Already registered? Authentication portal →"}
                </button>
              </div>
            </div>
          </HUDFrame>

          {/* Footer security badge */}
          <div className="mt-6 flex items-center justify-center gap-2 opacity-30 group hover:opacity-100 transition-opacity">
            <ShieldCheck className="w-3 h-3 text-cyan-500" />
            <span className="text-[10px] font-black tracking-[0.3em] uppercase">
              AES-256 Encrypted Session • Identity-Bound Execution Security (ACELOGIC)
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
