"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HUDFrame } from "@/components/HUDFrame";
import { cn } from "@/lib/utils";
import { LogIn, UserPlus, ShieldCheck, Mail, Lock, AlertCircle } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
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
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Google sign-in failed.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center p-4 tech-grid scanline">
            <div className="w-full max-w-md relative z-10">
                {/* Header branding */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center gap-4 mb-2">
                        <img src="/nxq-symbol.png" alt="NXQ Symbol" className="h-16 w-auto object-contain" />
                        <span className="text-4xl font-black text-white italic tracking-tighter">NXQ</span>
                        <div className="h-8 w-[1px] bg-white/10 mx-2" />
                        <span className="text-xl font-bold text-white tracking-[0.3em] uppercase">Security</span>
                    </div>
                    <p className="text-[10px] text-cyan-500/50 font-black tracking-[0.4em] uppercase">Command Center Authorization</p>
                </div>

                <HUDFrame title={isLogin ? "AUTHORIZATION REQUIRED" : "CREATE NEW IDENTITY"} className="p-6">
                    <div className="space-y-6">
                        <div className="flex items-center justify-center mb-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                                <div className="relative w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center bg-cyan-500/5 backdrop-blur-sm">
                                    <ShieldCheck className="w-8 h-8 text-cyan-500" />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest leading-tight">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-1">Dimensional ID (Email)</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <Mail className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="user@nxq.system"
                                        className="w-full bg-black/40 border border-white/5 focus:border-cyan-500/50 outline-none p-3 pl-10 text-sm font-mono transition-all text-white placeholder:text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] uppercase font-black tracking-widest text-slate-500 px-1">Access Protocol (Password)</label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                        <Lock className="w-4 h-4 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-black/40 border border-white/5 focus:border-cyan-500/50 outline-none p-3 pl-10 text-sm font-mono transition-all text-white placeholder:text-slate-700"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={cn(
                                    "w-full p-4 mt-4 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all font-black uppercase tracking-[0.2em] text-[11px] relative group overflow-hidden scifi-clip",
                                    loading && "opacity-50 cursor-wait"
                                )}
                            >
                                <div className="relative z-10 flex items-center justify-center gap-3">
                                    {loading ? (
                                        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                    ) : (
                                        isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />
                                    )}
                                    <span>{loading ? "AUTHENTICATING..." : isLogin ? "INITIALIZE SESSION" : "REGISTER IDENTITY"}</span>
                                </div>
                                <div className="absolute inset-0 bg-cyan-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                            </button>
                        </form>

                        <div className="flex items-center gap-4 py-2">
                            <div className="flex-1 h-[1px] bg-white/5" />
                            <span className="text-[9px] font-black text-slate-600 tracking-widest italic">OR</span>
                            <div className="flex-1 h-[1px] bg-white/5" />
                        </div>

                        <button
                            onClick={handleGoogleSignIn}
                            className="w-full p-3 border border-white/5 bg-white/5 hover:bg-white/10 transition-all font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3"
                        >
                            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                            Continue with Nexus ID
                        </button>

                        <div className="pt-4 text-center">
                            <button
                                onClick={() => setIsLogin(!isLogin)}
                                className="text-[9px] font-black text-cyan-500/50 hover:text-cyan-500 transition-colors uppercase tracking-[0.2em]"
                            >
                                {isLogin ? "Terminate session? Create new identity" : "Already registered? Authentication portal"}
                            </button>
                        </div>
                    </div>
                </HUDFrame>

                {/* Footer security badge */}
                <div className="mt-8 flex items-center justify-center gap-2 opacity-30 group hover:opacity-100 transition-opacity">
                    <ShieldCheck className="w-3 h-3 text-cyan-500" />
                    <span className="text-[8px] font-black tracking-[0.3em] uppercase">AES-256 Quantum Encrypted Session</span>
                </div>
            </div>
        </div>
    );
}
