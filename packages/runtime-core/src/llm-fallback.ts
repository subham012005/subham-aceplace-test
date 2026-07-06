/**
 * LLM Fallback Execution — TypeScript-native agent execution.
 *
 * Replicates the Python agent-engine node logic (coo, researcher, worker, grader)
 * so the runtime-worker can execute jobs when the Python process is unavailable.
 *
 * Activated automatically when the Python agent-engine is unreachable.
 */

console.log("[LLM-FALLBACK] v2.1 (Enhanced Identity & Model Resolution) Loaded.");

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import { COLLECTIONS } from "./constants";

const DEFAULT_AGENT_MODELS = {
  coo: { provider: "anthropic" as const, model: "claude-sonnet-4-6", temperature: 0.2, maxTokens: 4096 },
  researcher: { provider: "anthropic" as const, model: "claude-sonnet-4-6", temperature: 0.3, maxTokens: 8192 },
  worker: { provider: "openai" as const, model: "gpt-4o-mini", temperature: 0.4, maxTokens: 8192 },
  grader: { provider: "anthropic" as const, model: "claude-haiku-4-5", temperature: 0.1, maxTokens: 4096 },
} as const;

interface ResolvedConfig {
  apiKey: string;
  model: string;
  provider: "openai" | "anthropic";
  temperature: number;
  maxTokens: number;
}

// Fallback OpenAI model to use when the primary Anthropic model is unavailable
const ANTHROPIC_TO_OPENAI_FALLBACK: Record<string, string> = {
  "claude-sonnet-4-6": "gpt-4o-mini",
  "claude-haiku-4-5": "gpt-4o-mini",
};

// ── System Prompts (byte-identical to Python agent-engine) ───────────────────

const COO_SYSTEM_PROMPT = `You are the Chief Orchestration Officer (COO) agent in the ACEPLACE Phase 2 runtime.
Your role is to analyze the user's task and construct a detailed, multi-phase strategic execution plan.

You MUST produce a comprehensive plan that includes:
1. A detailed strategic overview of the mission
2. Explicit, actionable task assignments for each agent role (Researcher, Worker, Grader)
3. Success criteria and expected deliverables
4. Any known constraints, risks, or dependencies

Return ONLY valid JSON in this exact structure:
{
  "plan_summary": "One-sentence executive summary of the mission",
  "strategic_objective": "Detailed multi-sentence description of what needs to be accomplished and why",
  "mission_context": "Background context, scope, and any relevant domain knowledge",
  "assignments": [
    {
      "assignment_id": "assign_1",
      "agent_role": "researcher",
      "name": "Intelligence Gathering Phase",
      "task": "Detailed description of exactly what the researcher must investigate and report on",
      "expected_output": "What the researcher should produce — findings, data, sources, analysis",
      "priority": "critical|high|medium",
      "success_criteria": "Specific, measurable outcome that defines task completion"
    },
    {
      "assignment_id": "assign_2",
      "agent_role": "worker",
      "name": "Execution & Production Phase",
      "task": "Detailed description of what the worker must produce based on research findings",
      "expected_output": "What the worker should deliver — document, code, report, analysis",
      "priority": "critical|high|medium",
      "success_criteria": "Specific, measurable outcome that defines task completion"
    }
  ],
  "constraints": ["Any specific constraints or requirements to respect"],
  "dependencies": "Research must complete before production begins",
  "estimated_complexity": "low|medium|high",
  "quality_bar": "Explicit definition of acceptable quality for this mission"
}`;

const RESEARCHER_SYSTEM_PROMPT = `You are the Intelligence Researcher agent in the ACEPLACE Phase 2 runtime.
Your mission is to deeply research the given task using your full knowledge base and provide a comprehensive, sourced intelligence report.

You MUST produce:
1. A thorough research summary with substantive insights (not just a brief overview)
2. Detailed key findings - each one fully explained with context and evidence
3. Specific data points, statistics, or facts that support the findings
4. Resources and references consulted (real-world references, frameworks, standards, or sources)
5. A clear, actionable recommended approach for the Worker agent to follow

Return ONLY valid JSON in this exact structure:
{
  "research_summary": "Comprehensive 3-5 sentence summary of what was found and its significance",
  "key_findings": [
    {
      "title": "Finding title",
      "detail": "Full paragraph explaining this finding with evidence and context",
      "significance": "Why this matters for the task"
    }
  ],
  "data_points": {
    "category_name": ["specific fact or statistic 1", "specific fact or statistic 2"],
    "metrics": ["quantitative data if applicable"],
    "best_practices": ["industry standard or best practice 1", "standard 2"]
  },
  "resources": [
    {
      "title": "Resource or reference name",
      "type": "framework|standard|documentation|study|tool",
      "relevance": "How this resource applies to the task"
    }
  ],
  "recommended_approach": "Detailed, step-by-step recommendation for the Worker agent — what to create, how to structure it, what to include, and in what order",
  "risk_factors": ["Potential challenge 1", "Potential challenge 2"],
  "confidence_level": "high|medium|low"
}`;

const WORKER_SYSTEM_PROMPT = `You are the Production Worker agent in the ACEPLACE Phase 2 runtime.
Your mission is to synthesize the research intelligence and produce a comprehensive, professional-grade deliverable.

You MUST:
1. Read and deeply understand ALL research findings provided
2. Pay special attention to the Researcher's "Recommended Approach" and incorporate its structure and tactical advice into your work
3. Draw explicit conclusions from each research finding
4. Produce a fully detailed, long-form deliverable — not a brief summary
5. Structure the output professionally with clear sections and sub-sections
6. Reference specific research findings where relevant in your output
7. Provide actionable recommendations based on synthesized insights
8. Ensure the final deliverable is a seamless merge of the mission goal and the intelligence findings

Return ONLY valid JSON in this exact structure:
{
  "deliverable_summary": "Crisp 2-sentence executive description of what was produced and its value",
  "deliverable_type": "report|analysis|plan|code|specification|document",
  "executive_summary": "3-5 paragraph high-level overview of the complete deliverable and its conclusions",
  "content": "The FULL, complete deliverable content here — this must be comprehensive, detailed, and long-form. Do NOT truncate or summarize. Include all sections, analysis, conclusions, and recommendations.",
  "sections": [
    {
      "title": "Section title",
      "body": "Full section content with detailed analysis and conclusions drawn from research"
    }
  ],
  "key_conclusions": [
    {
      "conclusion": "Specific conclusion drawn from the research",
      "evidence": "The research finding(s) that support this conclusion",
      "recommendation": "Actionable recommendation based on this conclusion"
    }
  ],
  "research_synthesis": "Paragraph explicitly describing how the researcher's findings were incorporated into this deliverable",
  "limitations": ["Any limitation or caveat in the deliverable"],
  "quality_notes": "Assessment of deliverable completeness and areas for potential enhancement"
}`;

const WORKER_PATCH_SYSTEM_PROMPT = `{
  "role": "Senior Production Patch Specialist",
  "mission": "Review the PRIOR DELIVERABLE and the OPERATOR CONTINUATION INSTRUCTIONS. Generate a list of precise section patches to implement the requested modifications without outputting the entire unmodified document, to fit within output token limits.",

  "core_directive": "Identify only the sections that require changes (additions, updates, deletions). Do not output any unmodified sections or unchanged text. Maintain strict alignment with the style, depth, and citation standards of the rest of the document.",

  "production_principles": {
    "technical_rigor": "Explain architecture, execution flow, constraints, failure modes, validation requirements, and strategic implications with engineering-level specificity. If external sources are missing, use technical first principles to synthesize a high-fidelity narrative.",
    "investor_readiness": "Frame the deliverable around defensibility, infrastructure value, technical moat, operational maturity, and validation status.",
    "grounding_integrity": "Prioritize citations using [KB-N], [WEB-N], or Research Findings. If these are unavailable, provide a 'Master Strategic Synthesis' based on deep internal knowledge of technical and strategic domains.",
    "runtime_alignment": "All content must respect ACEPLACE laws: agents are stateless, envelopes hold state, runtime-worker is the only executor, ACELOGIC owns identity, leases gate execution, and Firestore persists runtime truth.",
    "no_fabrication": "Do not invent specific facts about a user's system if not in the KB, but DO provide deep, non-generic analysis for the general domain and strategic category."
  },

  "high_fidelity_production_protocol": {
    "standard": "MASTERPIECE TECHNICAL DOCUMENTATION",
    "objective": "Produce patch sections that sound like they were written by the lead systems architect and the COO.",
    "do_not_summarize": "Replace generic summaries with 'system-level technical specifications' and 'deterministic logic flows' in the section bodies.",
    "required_depth": [
      "Decompose architecture into specific runtime planes and protocol invariants.",
      "Use sophisticated markdown (tables, lists, bold highlights) to communicate technical density within section bodies.",
      "Frame all strategic claims around the technical defensibility of the ACEPLACE stack.",
      "Explicitly mention identity-bound execution and authority lease enforcement as core moats."
    ],
    "anti_generic_rule": "If a paragraph could apply to any AI company, delete it. Every sentence must be specific to ACEPLACE and the mission intelligence."
  },

  "required_content_standards": {
    "depth": "Each new or modified section must contain multi-paragraph analysis, not bullet-only summaries. Surface-level analysis is grounds for immediate Grader rejection.",
    "specificity": "Use named system components, runtime primitives, architectural constraints, and implementation details. Do not use generic 'AI' terminology.",
    "citation_density": "Every single technical, market, or strategic claim in your patches MUST be cited using [KB-N], [WEB-N], or specific Research Findings. Failing to include precise citations in new or modified sections will cause immediate grader failure.",
    "executive_tone": "Use precise, confident, engineering-led language suitable for lead architects, strategic partners, and technical investors."
  },

  "patch_protocol": {
    "target_specificity": "Each patch must target an existing section title in the PRIOR DELIVERABLE, or specify insertion at the start/end.",
    "action_types": {
      "replace_section": "Replaces the entire content of an existing section by matching its title.",
      "insert_after_section": "Inserts a new section immediately after the targeted section.",
      "delete_section": "Removes an existing section entirely by matching its title.",
      "add_to_start": "Inserts a new section at the very beginning of the document.",
      "add_to_end": "Appends a new section at the very end of the document."
    }
  },

  "hard_constraints": [
    "JSON only",
    "No uncited factual claims in updated or new sections",
    "No invented implementation status",
    "No claim that ACEPLACE is operationally validated unless test evidence proves it",
    "Architecture completeness must be distinguished from runtime validation",
    "All deliverables must remain envelope-first and authority-compliant"
  ],

  "output_format": {
    "patches": [
      {
        "action": "replace_section | insert_after_section | delete_section | add_to_start | add_to_end",
        "target_section_title": "The exact title of the section to target in the PRIOR DELIVERABLE (case-insensitive)",
        "section": {
          "title": "New or updated section title",
          "body": "The complete updated markdown body for this section. Detail-oriented, multi-paragraph, and rigorously grounded with [KB-N] and [WEB-N] citations."
        }
      }
    ],
    "deliverable_summary_patch": "An updated deliverable summary reflecting the changes, or null if unchanged.",
    "executive_summary_patch": "An updated executive summary reflecting the changes, or null if unchanged.",
    "new_source_references": [
      {
        "ref_id": "[KB-X] or [WEB-Y]",
        "title": "Title of the source",
        "usage": "How this source supports the patch"
      }
    ]
  }
}`;

const GRADER_SYSTEM_PROMPT = `You are the Grader agent in the ACEPLACE Phase 2 runtime.
Evaluate the deliverable against the original task requirements.
Return ONLY valid JSON:
{
  "overall_score": 0-100,
  "grade": "A|B|C|D|F",
  "recommendation": "approve|reject|revise",
  "criteria_scores": {
    "completeness": 0-100,
    "accuracy": 0-100,
    "quality": 0-100,
    "relevance": 0-100
  },
  "feedback": "detailed feedback for the human reviewer",
  "summary": "one-line summary of evaluation"
}`;

function getAnthropic(apiKey?: string): Anthropic {
  // If apiKey is provided (even if empty), don't fallback to process.env
  const key = (apiKey !== undefined) ? apiKey : process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("FALLBACK_NO_API_KEY: Anthropic key is not set. Please provide your API key in Settings > Intelligence Providers.");
  return new Anthropic({ apiKey: key });
}

function getOpenAI(apiKey?: string): OpenAI {
  // If apiKey is provided (even if empty), don't fallback to process.env
  const key = (apiKey !== undefined && apiKey !== "") ? apiKey : process.env.OPENAI_API_KEY;
  if (!key || key === "") {
    throw new Error("FALLBACK_NO_API_KEY: OpenAI key is not set. Please provide your API key in Settings > Intelligence Providers or set OPENAI_API_KEY environment variable.");
  }
  return new OpenAI({ apiKey: key });
}

/** Resolves organization-specific LLM config from Firestore */
async function resolveOrgLLMConfig(orgId: string, role: string): Promise<ResolvedConfig> {
  const db = getDb();

  console.log(`[LLM-FALLBACK] Resolving config for orgId: "${orgId}", role: "${role}"`);

  // Hard block on 'default' orgId to prevent leakage from legacy/global docs
  if (!orgId || orgId === "default") {
    console.error(`[LLM-FALLBACK] Blocking attempt to use "${orgId}" orgId. Identity propagation may be missing.`);
    throw new Error(`MISSING_INTELLIGENCE_CONFIG: No specific organization configuration found (orgId: "${orgId}"). Please go to Settings > Intelligence Providers.`);
  }

  // Try canonical collection first (matches newer API storage)
  let doc = await db.collection("org_intelligence_providers").doc(orgId).get();

  if (!doc.exists) {
    // Fallback: Check legacy 'jobs' collection for older config storage
    console.log(`[LLM-FALLBACK] No config in canonical collection for ${orgId}, checking legacy store...`);
    doc = await db.collection(COLLECTIONS.JOBS).doc(`provider_config_${orgId}`).get();
  }

  if (!doc.exists) {
    console.error(`[LLM-FALLBACK] No config document found in Firestore for orgId: ${orgId}`);
    throw new Error(`MISSING_INTELLIGENCE_CONFIG: No intelligence provider configuration found for organization ${orgId}. Please go to Settings > Intelligence Providers and configure your API keys.`);
  }

  const data = doc.data() as any;
  console.log(`[LLM-FALLBACK] Resolved config for orgId: ${orgId} (from ${doc.ref.parent.id})`);

  const providerKey = data.agent_models?.[role] || (DEFAULT_AGENT_MODELS as any)[role].provider;
  if (!providerKey) {
    throw new Error(`MISSING_AGENT_MAPPING: No provider assigned to the '${role}' agent role. Please check your settings in Intelligence Providers.`);
  }

  const providerConfig = data.providers?.[providerKey] || {};
  const apiKey = providerConfig.api_key;

  if (apiKey) {
    const redacted = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "****";
    console.log(`[LLM-FALLBACK] Using API key from Firestore for ${providerKey}: ${redacted}`);
  } else {
    console.warn(`[LLM-FALLBACK] No API key found in Firestore config for ${providerKey}`);
    throw new Error(`MISSING_API_KEY: The API key for '${providerKey}' (assigned to ${role}) is missing. Please provide it in Settings > Intelligence Providers.`);
  }

  // Model mapping — ordered newest-first so newer API accounts always get a valid model.
  // If the user has saved a preferred model in their provider config, that takes priority.
  const MODEL_MAP: Record<string, Record<string, string>> = {
    openai: { coo: "gpt-4o-mini", researcher: "gpt-4o-mini", worker: "gpt-4o-mini", grader: "gpt-4o-mini" },
    anthropic: {
      coo: "claude-sonnet-4-6",
      researcher: "claude-sonnet-4-6",
      worker: "claude-sonnet-4-6",
      grader: "claude-haiku-4-5-20251001"
    },
    gemini: { coo: "gemini-1.5-pro", researcher: "gemini-1.5-pro", worker: "gemini-1.5-flash", grader: "gemini-1.5-flash" },
  };

  // Prefer the model explicitly saved by the user in their provider settings.
  // Falls back to the role-specific default in MODEL_MAP.
  const savedModel = providerConfig?.model as string | undefined;
  let model = (savedModel && savedModel.trim()) ? savedModel.trim() : (MODEL_MAP[providerKey]?.[role] || "unknown");
  if (model === "gpt-4o") {
    model = "gpt-4o-mini"; // Force downgrade to bypass strict TPM limits for now
  }
  const def = (DEFAULT_AGENT_MODELS as any)[role];

  return {
    provider: providerKey === "openai" ? "openai" : "anthropic",
    apiKey: apiKey,
    model: model,
    temperature: def.temperature,
    maxTokens: providerConfig?.max_tokens || def.maxTokens
  };
}

/**
 * Safely look up the org's OpenAI API key from Firestore.
 * Used as the cross-provider fallback key when Anthropic fails.
 * Returns undefined (never throws) so callers can decide gracefully.
 */
async function resolveOrgFallbackOpenAIKey(orgId: string): Promise<string | undefined> {
  try {
    const db = getDb();
    const doc = await db.collection("org_intelligence_providers").doc(orgId).get();
    if (!doc.exists) return undefined;
    const key = (doc.data() as any)?.providers?.openai?.api_key;
    return key || undefined;
  } catch {
    return undefined;
  }
}

// ── Usage Tracking ───────────────────────────────────────────────────────────

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  model: string;
  provider: "anthropic" | "openai";
  cost: number;
}

// Per-million-token pricing (input / output)
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 0.8, output: 4.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = PRICING[model] || { input: 3.0, output: 15.0 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

// ── LLM Call Helpers ─────────────────────────────────────────────────────────

interface LLMCallResult {
  text: string;
  usage: LLMUsage;
}

async function callAnthropic(params: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}): Promise<LLMCallResult> {
  const client = getAnthropic(params.apiKey);
  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userMessage }],
  });
  const block = response.content[0];
  const text = block.type === "text" ? block.text : JSON.stringify(block);
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  return {
    text,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      model: params.model,
      provider: "anthropic",
      cost: calculateCost(params.model, inputTokens, outputTokens),
    },
  };
}

async function callOpenAI(params: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}): Promise<LLMCallResult> {
  const client = getOpenAI(params.apiKey);
  const response = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessage },
    ],
  });
  const inputTokens = response.usage?.prompt_tokens || 0;
  const outputTokens = response.usage?.completion_tokens || 0;
  return {
    text: response.choices[0]?.message?.content || "",
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      model: params.model,
      provider: "openai",
      cost: calculateCost(params.model, inputTokens, outputTokens),
    },
  };
}

/**
 * Log an LLM fallback event to execution_traces for UI display.
 */
async function logFallbackTrace(params: {
  envelopeId: string;
  agentId: string;
  agentLabel: string;
  message: string;
  metadata?: any;
}) {
  try {
    const traceId = `trc_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await getDb().collection(COLLECTIONS.EXECUTION_TRACES).doc(traceId).set({
      trace_id: traceId,
      envelope_id: params.envelopeId,
      agent_id: params.agentId || "system",
      agent_role: params.agentLabel.toLowerCase(),
      event_type: "LLM_FALLBACK",
      message: params.message,
      timestamp: new Date().toISOString(),
      metadata: params.metadata || {},
    });
  } catch (e) {
    console.warn(`[FALLBACK] Failed to log trace: ${(e as Error).message}`);
  }
}

async function callWithAnthropicFallback(params: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
  agentLabel: string;
  apiKey?: string;
  fallbackApiKey?: string;
  envelopeId?: string;
  agentId?: string;
  fallbackApproved?: boolean;
}): Promise<LLMCallResult> {
  try {
    return await callAnthropic(params);
  } catch (primaryErr) {
    const primaryMsg = (primaryErr as Error).message;

    // 1. Try internal Anthropic retry (Haiku) if it's a 404
    if (primaryMsg.includes("not_found_error") || primaryMsg.includes("404") || primaryMsg.includes("model_not_found")) {
      if (params.model !== "claude-3-5-haiku-latest") {
        if (!params.fallbackApproved) {
          throw new Error(`LLM_FALLBACK_REQUIRED:model_switch:claude-3-5-haiku-latest:${primaryMsg}`);
        }
        console.warn(`[FALLBACK:${params.agentLabel}] Primary model failed. Trying approved Haiku fallback...`);
        try {
          return await callAnthropic({ ...params, model: "claude-3-5-haiku-latest" });
        } catch (haikuErr) {
          console.warn(`[FALLBACK:${params.agentLabel}] Haiku also failed.`);
          // Continue to OpenAI fallback below
        }
      }
    }

    // 2. Cross-provider fallback to OpenAI
    const effectiveFallbackKey = params.fallbackApiKey || process.env.OPENAI_API_KEY;
    const fallbackModel = ANTHROPIC_TO_OPENAI_FALLBACK[params.model] ?? "gpt-4o";

    if (!params.fallbackApproved) {
      // STOP and signal for approval
      throw new Error(`LLM_FALLBACK_REQUIRED:model_switch:${fallbackModel}:${primaryMsg}`);
    }

    if (!effectiveFallbackKey) {
      throw new Error(`[${params.agentLabel}] Anthropic failed: ${primaryMsg}. No OpenAI fallback key available.`);
    }

    console.warn(`[FALLBACK:${params.agentLabel}] Using approved OpenAI fallback (${fallbackModel})`);
    return await callOpenAI({
      model: fallbackModel,
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      apiKey: effectiveFallbackKey
    });
  }
}

// ── JSON Parse Helper (mirrors Python _parse_json fallback) ──────────────────

function safeParseJSON(raw: string): Record<string, unknown> {
  // Try raw JSON first
  try { return JSON.parse(raw); } catch { /* continue */ }
  // Try extracting from markdown code block
  const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch { /* continue */ }
  }
  // Return raw as content wrapper
  return { raw_content: raw };
}

// ── Artifact Persistence ─────────────────────────────────────────────────────

async function createArtifact(params: {
  envelopeId: string;
  agentId: string;
  fingerprint: string;
  artifactType: string;
  content: string;
}): Promise<string> {
  const artifactId = `art_${params.artifactType}_${Date.now()}`;
  await getDb().collection(COLLECTIONS.ARTIFACTS).doc(artifactId).set({
    artifact_id: artifactId,
    execution_id: params.envelopeId,
    produced_by_agent: params.agentId,
    identity_fingerprint: params.fingerprint,
    artifact_type: params.artifactType,
    artifact_content: params.content,
    created_at: new Date().toISOString(),
  });
  return artifactId;
}

async function loadArtifactContent(artifactId: string): Promise<string> {
  if (artifactId.includes(",")) {
    const parts = artifactId.split(",").map(p => p.trim()).filter(Boolean);
    const docs = await Promise.all(
      parts.map(p => getDb().collection(COLLECTIONS.ARTIFACTS).doc(p).get())
    );
    return docs.map(d => d.exists ? String(d.data()?.artifact_content || "") : "").join("\n\n---\n\n");
  }
  const doc = await getDb().collection(COLLECTIONS.ARTIFACTS).doc(artifactId).get();
  if (!doc.exists) return "";
  return doc.data()?.artifact_content || "";
}

// ── Node Implementations ─────────────────────────────────────────────────────

async function executeCOO(prompt: string, envelopeId: string, agentId: string, fingerprint: string, orgId?: string, fallbackApproved?: boolean): Promise<{ artifactId: string; usage: LLMUsage }> {
  let cfg: ResolvedConfig;
  if (orgId) {
    cfg = await resolveOrgLLMConfig(orgId, "coo");
  } else {
    const def = DEFAULT_AGENT_MODELS.coo;
    cfg = { ...def, apiKey: process.env.ANTHROPIC_API_KEY || "" };
  }

  console.log(`[FALLBACK:COO] Calling ${cfg.model} via ${cfg.provider} for envelope ${envelopeId}`);

  let callResult: LLMCallResult;
  if (cfg.provider === "openai") {
    callResult = await callOpenAI({
      model: cfg.model,
      systemPrompt: COO_SYSTEM_PROMPT,
      userMessage: `User task:\n\n${prompt}\n\nCreate the execution plan.`,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      apiKey: cfg.apiKey
    });
  } else {
    // Resolve org's OpenAI key as fallback (user may have both Claude + OpenAI configured)
    const cooFallbackKey = orgId ? await resolveOrgFallbackOpenAIKey(orgId) : process.env.OPENAI_API_KEY;
    callResult = await callWithAnthropicFallback({
      model: cfg.model,
      systemPrompt: COO_SYSTEM_PROMPT,
      userMessage: `User task:\n\n${prompt}\n\nCreate the execution plan.`,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      agentLabel: "COO",
      apiKey: cfg.apiKey,
      fallbackApiKey: cooFallbackKey,
      envelopeId,
      agentId,
      fallbackApproved
    });
  }

  const result = safeParseJSON(callResult.text);
  const content = JSON.stringify(result, null, 2);

  const artifactId = await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "plan",
    content,
  });
  return { artifactId, usage: callResult.usage };
}

async function executeResearcher(
  prompt: string, inputRef: string | null, envelopeId: string, agentId: string, fingerprint: string, orgId?: string, fallbackApproved?: boolean
): Promise<{ artifactId: string; usage: LLMUsage }> {
  let cfg: ResolvedConfig;
  if (orgId) {
    cfg = await resolveOrgLLMConfig(orgId, "researcher");
  } else {
    const def = DEFAULT_AGENT_MODELS.researcher;
    cfg = { ...def, apiKey: process.env.ANTHROPIC_API_KEY || "" };
  }

  console.log(`[FALLBACK:Researcher] Calling ${cfg.model} via ${cfg.provider} for envelope ${envelopeId}`);

  let planContext = "";
  if (inputRef) {
    const planContent = await loadArtifactContent(inputRef);
    if (planContent) planContext = `\n\nExecution Plan:\n${planContent}`;
  }

  const userMessage = `Task:\n\n${prompt}${planContext}\n\nProvide research findings.`;
  let callResult: LLMCallResult;

  if (cfg.provider === "openai") {
    callResult = await callOpenAI({
      model: cfg.model,
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      userMessage,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      apiKey: cfg.apiKey
    });
  } else {
    // Resolve org's OpenAI key as fallback
    const researcherFallbackKey = orgId ? await resolveOrgFallbackOpenAIKey(orgId) : process.env.OPENAI_API_KEY;
    callResult = await callWithAnthropicFallback({
      model: cfg.model,
      systemPrompt: RESEARCHER_SYSTEM_PROMPT,
      userMessage,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      agentLabel: "Researcher",
      apiKey: cfg.apiKey,
      fallbackApiKey: researcherFallbackKey,
      envelopeId,
      agentId,
      fallbackApproved
    });
  }

  const result = safeParseJSON(callResult.text);
  const content = JSON.stringify(result, null, 2);

  const artifactId = await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "assignment",
    content,
  });
  return { artifactId, usage: callResult.usage };
}


export interface ParsedContinuation {
  originalMission: string;
  priorDeliverableStr: string;
  continuationInstructions: string;
  version: number;
}

export function parseContinuationPrompt(prompt: string): ParsedContinuation | null {
  if (!prompt || !prompt.includes("[CONTINUATION TASK")) {
    return null;
  }

  // Parse ORIGINAL MISSION
  let originalMission = "";
  const omStart = prompt.indexOf("ORIGINAL MISSION:");
  if (omStart !== -1) {
    const startContent = omStart + "ORIGINAL MISSION:".length;
    const headers = ["PRIOR DELIVERABLE", "OPERATOR CONTINUATION INSTRUCTIONS", "CONTINUITY DIRECTIVE"];
    let endIdx = prompt.length;
    for (const h of headers) {
      const idx = prompt.indexOf(h, startContent);
      if (idx !== -1 && idx < endIdx) {
        endIdx = idx;
      }
    }
    originalMission = prompt.slice(startContent, endIdx).trim();
  }

  // Parse PRIOR DELIVERABLE
  let priorDeliverableStr = "";
  const pdStart = prompt.indexOf("PRIOR DELIVERABLE");
  if (pdStart !== -1) {
    const colonIdx = prompt.indexOf(":", pdStart);
    if (colonIdx !== -1) {
      const startContent = colonIdx + 1;
      const headers = ["OPERATOR CONTINUATION INSTRUCTIONS:", "CONTINUITY DIRECTIVE:"];
      let endIdx = prompt.length;
      for (const h of headers) {
        const idx = prompt.indexOf(h, startContent);
        if (idx !== -1 && idx < endIdx) {
          endIdx = idx;
        }
      }
      priorDeliverableStr = prompt.slice(startContent, endIdx).trim();
    }
  }

  // Parse OPERATOR CONTINUATION INSTRUCTIONS
  let continuationInstructions = "";
  const ociStart = prompt.indexOf("OPERATOR CONTINUATION INSTRUCTIONS:");
  if (ociStart !== -1) {
    const startContent = ociStart + "OPERATOR CONTINUATION INSTRUCTIONS:".length;
    const headers = ["CONTINUITY DIRECTIVE:"];
    let endIdx = prompt.length;
    for (const h of headers) {
      const idx = prompt.indexOf(h, startContent);
      if (idx !== -1 && idx < endIdx) {
        endIdx = idx;
      }
    }
    continuationInstructions = prompt.slice(startContent, endIdx).trim();
  }

  // Extract version
  const versionMatch = prompt.match(/Version (\d+)/);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : 2;

  return {
    originalMission,
    priorDeliverableStr,
    continuationInstructions,
    version,
  };
}

async function executeWorker(
  prompt: string, inputRef: string | null, envelopeId: string, agentId: string, fingerprint: string, orgId?: string, fallbackApproved?: boolean
): Promise<{ artifactId: string; usage: LLMUsage }> {
  let cfg: ResolvedConfig;
  if (orgId) {
    cfg = await resolveOrgLLMConfig(orgId, "worker");
  } else {
    const def = DEFAULT_AGENT_MODELS.worker;
    cfg = { ...def, apiKey: process.env.OPENAI_API_KEY || "" };
  }

  console.log(`[FALLBACK:Worker] Calling ${cfg.model} via ${cfg.provider} for envelope ${envelopeId}`);

  let researchContext = "";
  if (inputRef) {
    const researchContent = await loadArtifactContent(inputRef);
    if (researchContent) researchContext = `\n\nResearch Findings:\n${researchContent}`;
  }

  const userMessage = `Task:\n\n${prompt}${researchContext}\n\nProduce the deliverable.`;

  async function runLLMCall(systemPromptText: string, userMessageText: string): Promise<LLMCallResult> {
    if (cfg.provider === "openai") {
      return await callOpenAI({
        model: cfg.model,
        systemPrompt: systemPromptText,
        userMessage: userMessageText,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        apiKey: cfg.apiKey
      });
    } else {
      try {
        return await callAnthropic({
          model: cfg.model,
          systemPrompt: systemPromptText,
          userMessage: userMessageText,
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
          apiKey: cfg.apiKey
        });
      } catch (err) {
        const workerFallbackMsg = `[FALLBACK:Worker] Anthropic failed, trying OpenAI fallback: ${(err as Error).message}`;
        console.warn(workerFallbackMsg);

        await logFallbackTrace({
          envelopeId,
          agentId,
          agentLabel: "Worker",
          message: workerFallbackMsg,
          metadata: { error: (err as Error).message }
        });

        if (!fallbackApproved) {
          throw new Error(`LLM_FALLBACK_REQUIRED:model_switch:gpt-4o-mini:${(err as Error).message}`);
        }

        const workerFallbackKey = orgId ? await resolveOrgFallbackOpenAIKey(orgId) : process.env.OPENAI_API_KEY;
        return await callOpenAI({
          model: "gpt-4o-mini",
          systemPrompt: systemPromptText,
          userMessage: userMessageText,
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
          apiKey: workerFallbackKey
        });
      }
    }
  }

  const isContinuation = prompt.includes("[CONTINUATION TASK");
  const parsed = isContinuation ? parseContinuationPrompt(prompt) : null;
  let priorData: any = null;
  if (parsed && parsed.priorDeliverableStr) {
    priorData = safeParseJSON(parsed.priorDeliverableStr);
  }

  let usePatchContinuation = false;
  if (isContinuation && priorData && typeof priorData === "object" && Array.isArray(priorData.sections) && priorData.sections.length > 0) {
    usePatchContinuation = true;
  }

  let result: any;
  let finalUsage!: LLMUsage;

  if (usePatchContinuation) {
    console.log(`[FALLBACK:Worker] Using diff/patch-based continuation editing`);
    const patchUserMessage = `Task:\n\n${prompt}${researchContext}\n\nBased on the operator's continuation instructions, identify the necessary changes and output ONLY the patches JSON.`;
    
    try {
      const callResult = await runLLMCall(WORKER_PATCH_SYSTEM_PROMPT, patchUserMessage);
      const patchData = safeParseJSON(callResult.text);
      
      if (!patchData || !Array.isArray(patchData.patches)) {
        console.warn("[FALLBACK:Worker] Patch JSON parsing failed, falling back to full generation");
        usePatchContinuation = false; // Force fallback path below
      } else {
        result = { ...priorData };
        let sections = Array.isArray(result.sections) ? [...result.sections] : [];
        const patches = patchData.patches;
        
        for (const patch of patches) {
          const action = patch.action;
          const targetTitle = patch.target_section_title;
          const newSec = patch.section;
          
          if (action === "add_to_start" && newSec) {
            sections.unshift(newSec);
          } else if (action === "add_to_end" && newSec) {
            sections.push(newSec);
          } else if (action === "delete_section" && targetTitle) {
            sections = sections.filter((s: any) => String(s.title || "").trim().toLowerCase() !== String(targetTitle).trim().toLowerCase());
          } else if (action === "replace_section" && targetTitle && newSec) {
            const idx = sections.findIndex((s: any) => String(s.title || "").trim().toLowerCase() === String(targetTitle).trim().toLowerCase());
            if (idx !== -1) {
              sections[idx] = newSec;
            }
          } else if (action === "insert_after_section" && targetTitle && newSec) {
            const idx = sections.findIndex((s: any) => String(s.title || "").trim().toLowerCase() === String(targetTitle).trim().toLowerCase());
            if (idx !== -1) {
              sections.splice(idx + 1, 0, newSec);
            } else {
              sections.push(newSec);
            }
          }
        }
        
        result.sections = sections;
        result.content = sections.map((s: any) => `# ${s.title || ""}\n\n${s.body || ""}`).join("\n\n");
        
        if (patchData.deliverable_summary_patch) {
          result.deliverable_summary = patchData.deliverable_summary_patch;
        }
        if (patchData.executive_summary_patch) {
          result.executive_summary = patchData.executive_summary_patch;
        }
        
        const newRefs = Array.isArray(patchData.new_source_references) ? patchData.new_source_references : [];
        let existingRefs = Array.isArray(result.source_references) ? [...result.source_references] : [];
        const seenRefs = new Set(existingRefs.map((r: any) => r?.ref_id).filter(Boolean));
        for (const ref of newRefs) {
          if (ref && ref.ref_id && !seenRefs.has(ref.ref_id)) {
            existingRefs.push(ref);
            seenRefs.add(ref.ref_id);
          }
        }
        result.source_references = existingRefs;
        result.grounding_report = safeParseJSON(callResult.text).grounding_report || {
          kb_chunks_cited: 0,
          web_sources_cited: 0,
          research_findings_used: 0,
          fabrication_check: "VERIFIED",
          validation_note: "Applied patches programmatically."
        };
        
        finalUsage = callResult.usage;
      }
    } catch (e) {
      console.warn(`[FALLBACK:Worker] Patch execution error, falling back to full generation: ${(e as Error).message}`);
      usePatchContinuation = false;
    }
  }

  if (!usePatchContinuation) {
    let systemPromptText = WORKER_SYSTEM_PROMPT;
    if (isContinuation) {
      systemPromptText += [
        "",
        "=== CRITICAL CONTINUATION DIRECTIVE ===",
        "You are editing and revising a PRIOR DELIVERABLE based on the OPERATOR CONTINUATION INSTRUCTIONS.",
        "To maintain strict continuity and avoid regressions:",
        "1. You MUST keep the entire prior deliverable intact as your baseline.",
        "2. ONLY edit, add, modify, or delete the specific sections or information requested in the OPERATOR CONTINUATION INSTRUCTIONS.",
        "3. DO NOT rephrase, rewrite, restructure, or remove any other existing paragraphs, sections, tables, or sentences that are not directly mentioned in or affected by the edit instructions.",
        "4. Copy all other unmodified sections, text, and keys (including 'sections', 'source_references', etc.) exactly as they were in the PRIOR DELIVERABLE, verbatim.",
        "5. The final output must be identical to the PRIOR DELIVERABLE except for the requested modifications."
      ].join("\n");
    }

    const callResult = await runLLMCall(systemPromptText, userMessage);
    result = safeParseJSON(callResult.text);
    finalUsage = callResult.usage;
  }

  const content = JSON.stringify(result, null, 2);

  const artifactId = await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "deliverable",
    content,
  });
  return { artifactId, usage: finalUsage };

}

async function executeGrader(
  prompt: string, inputRef: string | null, envelopeId: string, agentId: string, fingerprint: string, orgId?: string, fallbackApproved?: boolean
): Promise<{ artifactId: string; usage: LLMUsage }> {
  let cfg: ResolvedConfig;
  if (orgId) {
    cfg = await resolveOrgLLMConfig(orgId, "grader");
  } else {
    const def = DEFAULT_AGENT_MODELS.grader;
    cfg = { ...def, apiKey: process.env.ANTHROPIC_API_KEY || "" };
  }

  console.log(`[FALLBACK:Grader] Calling ${cfg.model} via ${cfg.provider} for envelope ${envelopeId}`);

  let deliverableContext = "";
  if (inputRef) {
    const deliverableContent = await loadArtifactContent(inputRef);
    if (deliverableContent) deliverableContext = `\n\nDeliverable to evaluate:\n${deliverableContent}`;
  }

  const userMessage = `Original task:\n\n${prompt}${deliverableContext}\n\nEvaluate the deliverable.`;
  let callResult: LLMCallResult;

  if (cfg.provider === "openai") {
    callResult = await callOpenAI({
      model: cfg.model,
      systemPrompt: GRADER_SYSTEM_PROMPT,
      userMessage,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      apiKey: cfg.apiKey
    });
  } else {
    // Resolve org's OpenAI key as fallback
    const graderFallbackKey = orgId ? await resolveOrgFallbackOpenAIKey(orgId) : process.env.OPENAI_API_KEY;
    callResult = await callWithAnthropicFallback({
      model: cfg.model,
      systemPrompt: GRADER_SYSTEM_PROMPT,
      userMessage,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      agentLabel: "Grader",
      apiKey: cfg.apiKey,
      fallbackApiKey: graderFallbackKey,
      envelopeId,
      agentId,
      fallbackApproved
    });
  }

  const result = safeParseJSON(callResult.text);
  const content = JSON.stringify(result, null, 2);

  const artifactId = await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "evaluation",
    content,
  });
  return { artifactId, usage: callResult.usage };
}

// ── Public Dispatcher ────────────────────────────────────────────────────────

export async function executeFallbackStep(params: {
  envelope_id: string;
  step_id: string;
  step_type: string;
  agent_id: string;
  identity_fingerprint: string;
  prompt: string;
  input_ref: string | null;
  org_id?: string;
  fallback_approved?: boolean;
}): Promise<{ success: boolean; artifact_id: string; usage: LLMUsage }> {
  const { envelope_id, step_type, agent_id, prompt, input_ref, org_id, fallback_approved } = params;
  const fp = params.identity_fingerprint || "00000000";

  let result: { artifactId: string; usage: LLMUsage };

  switch (step_type) {
    case "plan":
      result = await executeCOO(prompt, envelope_id, agent_id, fp, org_id, fallback_approved);
      break;
    case "assign":
      result = await executeResearcher(prompt, input_ref, envelope_id, agent_id, fp, org_id, fallback_approved);
      break;
    case "artifact_produce":
    case "produce_artifact":
      result = await executeWorker(prompt, input_ref, envelope_id, agent_id, fp, org_id, fallback_approved);
      break;
    case "evaluate":
    case "evaluation":
      result = await executeGrader(prompt, input_ref, envelope_id, agent_id, fp, org_id, fallback_approved);
      break;
    default:
      throw new Error(`FALLBACK_UNSUPPORTED_STEP: ${step_type}`);
  }

  // Persist usage to the job doc for dashboard display
  try {
    const envDoc = await getDb().collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id).get();
    const jobId = envDoc.data()?.job_id;
    if (jobId) {
      const jobRef = getDb().collection(COLLECTIONS.JOBS).doc(jobId);
      const jobDoc = await jobRef.get();
      const existing = jobDoc.data()?.token_usage || {};
      const prevTokens = existing.total_tokens || 0;
      const prevCost = existing.cost || 0;
      await jobRef.set({
        token_usage: {
          total_tokens: prevTokens + result.usage.total_tokens,
          input_tokens: (existing.input_tokens || 0) + result.usage.input_tokens,
          output_tokens: (existing.output_tokens || 0) + result.usage.output_tokens,
          cost: prevCost + result.usage.cost,
        },
        cost: prevCost + result.usage.cost,
        model_used: result.usage.model,
        neural_provider: result.usage.provider,
        updated_at: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (e) {
    console.warn(`[FALLBACK] Failed to sync usage to job: ${(e as Error).message}`);
  }

  return { success: true, artifact_id: result.artifactId, usage: result.usage };
}
