"use client";

import React, { useState, useEffect } from "react";
import { HUDFrame } from "./HUDFrame";
import { Shield, Key, Copy, Check, RefreshCcw, Code, Terminal, Zap } from "lucide-react";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export default function ApiIntegration() {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const userId = auth.currentUser?.uid;

    const fetchKey = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/user/master-secret?user_id=${userId}`);
            const data = await res.json();
            if (data.exists) {
                setApiKey(null); // Explicitly clear any old raw key
                setMaskedKey(data.masked_secret);
            }
        } catch (err) {
            console.error("Failed to fetch API key:", err);
        } finally {
            setLoading(false);
        }
    };

    const generateKey = async () => {
        if (!userId || !confirm("Generating a new Master Secret will REVOKE your existing one. Agents using the old secret will fail. Proceed?")) return;
        
        setGenerating(true);
        try {
            const res = await fetch("/api/user/master-secret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                setApiKey(data.api_key);
                setMaskedKey(data.masked_secret);
            }
        } catch (err) {
            console.error("Failed to generate API key:", err);
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    useEffect(() => {
        fetchKey();
    }, [userId]);

    const pythonSnippet = `
import requests

# ACEPLACE — Phase 2 Execution Envelope Dispatch
MASTER_SECRET = "${apiKey || 'YOUR_MASTER_SECRET'}"
API_URL = "http://localhost:3000/api/runtime/dispatch"

def dispatch_task(root_task, entry_agent="COO"):
    headers = {
        "Authorization": f"Bearer {MASTER_SECRET}",
        "Content-Type": "application/json"
    }
    # Phase 2 contract: targets an Execution Envelope, not an agent directly.
    # The backend creates the envelope + step graph and routes via #us# protocol.
    payload = {
        "root_task": root_task,
        "execution_policy": {
            "entry_agent": entry_agent   # COO is the default entry point
        }
    }
    response = requests.post(API_URL, json=payload, headers=headers)
    return response.json()

# Execute
result = dispatch_task("Analyze market trends for AI agents")
print(result)
`.trim();

    return (
        <div className="space-y-6">
            <HUDFrame 
                title="Master Secret Control" 
                subtitle="Auth Token Management"
                variant="dark"
                headerAction={
                    <button 
                        onClick={generateKey}
                        disabled={generating || loading}
                        className="flex items-center gap-1.5 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 text-[10px] font-black uppercase tracking-widest hover:bg-cyan-500/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <RefreshCcw className={cn("w-3 h-3", generating && "animate-spin")} />
                        {apiKey ? "Regenerate" : "Generate"}
                    </button>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center border",
                            apiKey ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-slate-500/5 border-white/5 text-slate-600"
                        )}>
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-[12px] font-black uppercase tracking-wider text-slate-200 italic">API Access Token</h4>
                            <p className="text-[11px] text-slate-500 font-bold leading-tight">Shared secret used by agents to validate your identity.</p>
                        </div>
                    </div>

                    <div className="p-4 bg-black/40 border border-white/5 scifi-clip group relative overflow-hidden">
                        <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-center justify-between relative z-10">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Current Secret</span>
                                <div className="text-xs font-mono text-cyan-400 break-all pr-8">
                                    {loading ? "Decrypting..." : (apiKey ? (maskedKey || apiKey) : "No Secret Generated")}
                                </div>
                            </div>
                            {apiKey && (
                                <button 
                                    onClick={() => copyToClipboard(apiKey)}
                                    className="p-2 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all active:scale-90"
                                >
                                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-cyan-500" />}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-amber-500/80 font-bold uppercase tracking-widest bg-amber-500/5 p-2 border-l-2 border-amber-500/40">
                         <Shield className="w-3 h-3" /> Warning: Never share this secret. It grants full authority over your agents.
                    </div>
                </div>
            </HUDFrame>

            <HUDFrame 
                title="Agent Integration SDK" 
                subtitle="Python Standard"
                variant="dark"
            >
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                                <Terminal className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">Integration Snippet</span>
                        </div>
                        <button 
                            onClick={() => copyToClipboard(pythonSnippet)}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors flex items-center gap-1"
                        >
                            <Copy className="w-3 h-3" /> Copy Snippet
                        </button>
                    </div>

                    <div className="p-4 bg-slate-950/80 border border-white/5 font-mono text-[10px] text-slate-400 overflow-x-auto whitespace-pre leading-relaxed relative group">
                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-100 transition-opacity">
                            <Zap className="w-4 h-4 text-cyan-500 animate-pulse" />
                        </div>
                        {pythonSnippet}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="p-2 bg-white/5 border border-white/5 flex items-center gap-2">
                            <Code className="w-3 h-3 text-cyan-500" />
                            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">REST Compliant</span>
                        </div>
                        <div className="p-2 bg-white/5 border border-white/5 flex items-center gap-2">
                            <Shield className="w-3 h-3 text-purple-500" />
                            <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Bearer Authenticated</span>
                        </div>
                    </div>
                </div>
            </HUDFrame>
        </div>
    );
}
