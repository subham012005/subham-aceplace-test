"use client";

/**
 * IntelligenceProviders — BYO-LLM configuration panel.
 * Phase 2 Compliance: Issue #7 — Missing Intelligence Provider config layer.
 *
 * Allows licensees to configure their own API keys for:
 *   OpenAI, Anthropic (Claude), Google Gemini, Custom/Private endpoint
 *
 * Per-agent role assignment: which provider handles COO / Researcher / Worker / Grader.
 * Persists to Firestore: org_intelligence_providers/{userId}
 * No platform key fallback — each licensee is responsible for their own keys.
 */

import React, { useState, useEffect } from "react";
import {
  Key,
  Globe,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Save,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { HUDFrame } from "./HUDFrame";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { aceApi } from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────
type ProviderKey = "openai" | "anthropic" | "gemini" | "custom";
type AgentRole   = "coo" | "researcher" | "worker" | "grader";

interface ProviderConfig {
  enabled: boolean;
  api_key: string;
  model?: string;    // user-selected model for this provider
  base_url?: string;
}

interface AgentProviderMap {
  coo:        ProviderKey;
  researcher: ProviderKey;
  worker:     ProviderKey;
  grader:     ProviderKey;
}

interface IntelligenceConfig {
  providers:    Record<ProviderKey, ProviderConfig>;
  agent_models: AgentProviderMap;
}

// ── Default state ──────────────────────────────────────────────────────────
const DEFAULT_CONFIG: IntelligenceConfig = {
  providers: {
    openai:    { enabled: false, api_key: "", model: "gpt-4o" },
    anthropic: { enabled: false, api_key: "", model: "claude-sonnet-4-6" },
    gemini:    { enabled: false, api_key: "", model: "gemini-1.5-pro" },
    custom:    { enabled: false, api_key: "" },
  },
  agent_models: {
    coo:        "anthropic",
    researcher: "anthropic",
    worker:     "openai",
    grader:     "anthropic",
  },
};

// ── Provider metadata ──────────────────────────────────────────────────────
const PROVIDERS: {
  key: ProviderKey;
  label: string;
  color: string;
  border: string;
  placeholder: string;
}[] = [
  {
    key: "openai",
    label: "OpenAI",
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    placeholder: "sk-…",
  },
  {
    key: "anthropic",
    label: "Anthropic (Claude)",
    color: "text-purple-400",
    border: "border-purple-500/30",
    placeholder: "sk-ant-…",
  },
  {
    key: "gemini",
    label: "Google Gemini",
    color: "text-blue-400",
    border: "border-blue-500/30",
    placeholder: "AI…",
  },
  {
    key: "custom",
    label: "Custom / Private Endpoint",
    color: "text-amber-400",
    border: "border-amber-500/30",
    placeholder: "Bearer token or API key",
  },
];

// ── Per-provider model options ─────────────────────────────────────────────
const PROVIDER_MODELS: Record<string, { label: string; value: string }[]> = {
  openai: [
    { label: "GPT-4o",                value: "gpt-4o"       },
    { label: "GPT-4o Mini",           value: "gpt-4o-mini"  },
    { label: "o1-mini",               value: "o1-mini"      },
  ],
  anthropic: [
    { label: "Claude Sonnet 4.6",     value: "claude-sonnet-4-6"          },
    { label: "Claude Haiku 4.5",      value: "claude-haiku-4-5-20251001"  },
    { label: "Claude 3.5 Sonnet",     value: "claude-3-5-sonnet-latest"   },
    { label: "Claude 3.5 Haiku",      value: "claude-3-5-haiku-latest"    },
  ],
  gemini: [
    { label: "Gemini 1.5 Pro",    value: "gemini-1.5-pro"   },
    { label: "Gemini 1.5 Flash",  value: "gemini-1.5-flash" },
    { label: "Gemini 2.0 Flash",  value: "gemini-2.0-flash" },
  ],
  custom: [],
};

const AGENT_ROLES: { key: AgentRole; label: string; capability: string }[] = [
  { key: "coo",        label: "COO",        capability: "planning"    },
  { key: "researcher", label: "Researcher",  capability: "research"    },
  { key: "worker",     label: "Worker",      capability: "execution"   },
  { key: "grader",     label: "Grader",      capability: "evaluation"  },
];

// ── Provider Card ──────────────────────────────────────────────────────────
function ProviderCard({
  provider,
  config,
  onChange,
}: {
  provider: typeof PROVIDERS[number];
  config: ProviderConfig;
  onChange: (updated: ProviderConfig) => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "border transition-colors",
        config.enabled ? provider.border : "border-white/5",
        "bg-black/30"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Enable toggle */}
        <button
          onClick={() => onChange({ ...config, enabled: !config.enabled })}
          className={cn(
            "w-4 h-4 border-2 flex items-center justify-center shrink-0 transition-colors",
            config.enabled ? `${provider.border} bg-current/10` : "border-white/20"
          )}
          title={config.enabled ? "Disable provider" : "Enable provider"}
        >
          {config.enabled && (
            <div className={cn("w-2 h-2", provider.color.replace("text-", "bg-"))} />
          )}
        </button>

        <span className={cn("text-[9px] font-black uppercase tracking-widest flex-1", config.enabled ? provider.color : "text-slate-500")}>
          {provider.label}
        </span>

        {config.enabled && config.api_key && (
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">Configured</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          </div>
        )}
        {config.enabled && !config.api_key && (
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 animate-pulse" />
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-600 hover:text-slate-400 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/5">
          {/* API Key */}
          <div className="pt-2">
            <label className="text-[7px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1 mb-1">
              <Key className="w-2.5 h-2.5" /> API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={config.api_key}
                  onChange={(e) => onChange({ ...config, api_key: e.target.value })}
                  placeholder={provider.placeholder}
                  className="w-full bg-black/60 border border-white/10 px-2 py-1.5 text-[9px] font-mono text-cyan-400 placeholder:text-slate-700 focus:outline-none focus:border-cyan-500/50 transition-all"
                />
                {!showKey && config.api_key && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
                    <span className="text-[6px] font-black uppercase tracking-tighter text-emerald-400">
                      Stored in Secure Vault
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowKey(!showKey)}
                className="px-2 border border-white/10 hover:border-cyan-500/30 transition-colors text-slate-600 hover:text-cyan-400"
              >
                {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Model selection */}
          {(PROVIDER_MODELS[provider.key]?.length ?? 0) > 0 && (
            <div className="pt-2 border-t border-white/5">
              <label className="text-[7px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1 mb-1">
                <Zap className="w-2.5 h-2.5" /> Model Configuration
              </label>
              <select
                value={config.model || PROVIDER_MODELS[provider.key]?.[0]?.value || ""}
                onChange={(e) => onChange({ ...config, model: e.target.value })}
                className="w-full bg-black/60 border border-white/10 text-[8px] font-mono text-cyan-400 px-2 py-1.5 focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer"
              >
                {PROVIDER_MODELS[provider.key].map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-[6px] text-slate-500 mt-1 uppercase tracking-tighter">
                Ensure your API key has access to the selected model.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function IntelligenceProviders() {
  const [config, setConfig] = useState<IntelligenceConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { user } = useAuth();
  const userId = user?.uid;

  // Load existing config from Firestore
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const data = await aceApi.getIntelligenceConfig();
        if (data) {
          // Merge with defaults to handle missing keys
          setConfig({
            providers: {
              ...DEFAULT_CONFIG.providers,
              ...(data.providers ?? {}),
            },
            agent_models: {
              ...DEFAULT_CONFIG.agent_models,
              ...(data.agent_models ?? {}),
            },
          });
        }
      } catch (err: any) {
        console.error("[IntelligenceProviders] Load error:", err);
        setLoadError("Could not load saved configuration.");
      }
    };
    load();
  }, [userId]);

  const handleProviderChange = (key: ProviderKey, updated: ProviderConfig) => {
    setConfig((prev) => ({
      ...prev,
      providers: { ...prev.providers, [key]: updated },
    }));
    setSaved(false);
  };

  const handleAgentModelChange = (role: AgentRole, provider: ProviderKey) => {
    setConfig((prev) => ({
      ...prev,
      agent_models: { ...prev.agent_models, [role]: provider },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!userId) {
      console.warn("[IntelligenceProviders] Cannot save: No userId found.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      console.log("[IntelligenceProviders] Saving configuration via secure API...");
      await aceApi.saveIntelligenceConfig(config);
      console.log("[IntelligenceProviders] Save successful!");
      setSaved(true);
    } catch (err: any) {
      console.error("[IntelligenceProviders] Save error:", err);
      setSaveError(err.message || "Failed to save configuration");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const enabledProviders = PROVIDERS.filter(
    (p) => config.providers[p.key]?.enabled
  );
  const missingKeyProviders = enabledProviders.filter(
    (p) => !config.providers[p.key]?.api_key
  );

  return (
    <div className="space-y-5">
      {/* Critical BYO-LLM notice */}
      <div className="flex items-start gap-2 p-3 border border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">
            BYO-LLM Required
          </p>
          <p className="text-[9px] text-slate-400 leading-relaxed">
            Each licensee must supply their own API keys. No platform-level keys are used as
            fallback. Agents will not execute without a configured provider.
          </p>
        </div>
      </div>

      {loadError && (
        <p className="text-[8px] text-rose-400 font-mono">{loadError}</p>
      )}

      {/* Missing key warning */}
      {missingKeyProviders.length > 0 && (
        <div className="flex items-center gap-2 p-2 border border-rose-500/20 bg-rose-500/5">
          <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
          <p className="text-[8px] text-rose-400 font-bold">
            {missingKeyProviders.map((p) => p.label).join(", ")} enabled but API key missing
          </p>
        </div>
      )}

      {/* Provider configuration */}
      <HUDFrame title="API Providers" subtitle="Configure your LLM credentials" variant="dark">
        <div className="space-y-2 pt-1">
          {PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.key}
              provider={provider}
              config={config.providers[provider.key]}
              onChange={(updated) => handleProviderChange(provider.key, updated)}
            />
          ))}
        </div>
      </HUDFrame>

      {/* Per-agent provider assignment */}
      <HUDFrame title="Agent Provider Assignment" subtitle="Which provider handles each role" variant="dark">
        <div className="space-y-2 pt-1">
          {AGENT_ROLES.map((role) => (
            <div key={role.key} className="flex items-center justify-between border border-white/5 bg-black/20 px-3 py-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">
                  {role.label}
                </p>
                <p className="text-[7px] text-slate-600 uppercase tracking-widest">
                  CAPABILITY: {role.capability}
                </p>
              </div>
              <select
                value={config.agent_models[role.key]}
                onChange={(e) => handleAgentModelChange(role.key, e.target.value as ProviderKey)}
                className="bg-black/60 border border-white/10 text-[8px] font-black uppercase tracking-widest text-cyan-400 px-2 py-1 focus:outline-none focus:border-cyan-500/40 transition-all cursor-pointer"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="mt-3 p-2 border border-white/5 bg-black/20 flex items-center gap-2">
          <Zap className="w-3 h-3 text-cyan-500/60 shrink-0" />
          <p className="text-[7px] text-slate-600 font-bold">
            Provider is resolved at runtime per org. Model class (high_reasoning / standard) determines which model within the provider is used.
          </p>
        </div>
      </HUDFrame>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !userId}
        className={cn(
          "w-full py-3 text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3",
          saved && !saveError
            ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            : saveError
            ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]"
            : "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(6,182,212,0.2)] disabled:bg-slate-900 disabled:text-slate-600"
        )}
      >
        {saving ? (
          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
        ) : saved && !saveError ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : saveError ? (
          <AlertTriangle className="w-4 h-4" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saveError ? `ERROR: ${saveError}` : saved ? "SAVED" : saving ? "SAVING..." : "SAVE CONFIGURATION"}
      </button>
    </div>
  );
}
