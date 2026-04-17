/**
 * LLM Fallback Execution — TypeScript-native agent execution.
 *
 * Replicates the Python agent-engine node logic (coo, researcher, worker, grader)
 * so the runtime-worker can execute jobs when the Python process is unavailable.
 *
 * Activated when envelope.execution_mode === "fallback".
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { getDb } from "./db";
import { COLLECTIONS } from "./constants";

// ── Model Configuration (mirrors agent-engine/config.py) ─────────────────────

const AGENT_MODELS = {
  coo:        { provider: "anthropic" as const, model: "claude-sonnet-4-6",   temperature: 0.2, maxTokens: 4096 },
  researcher: { provider: "anthropic" as const, model: "claude-sonnet-4-6",   temperature: 0.3, maxTokens: 8192 },
  worker:     { provider: "openai"    as const, model: "gpt-4o",              temperature: 0.4, maxTokens: 8192 },
  grader:     { provider: "anthropic" as const, model: "claude-haiku-4-5",    temperature: 0.1, maxTokens: 4096 },
} as const;

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

// ── LLM Clients (lazy singleton) ─────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("FALLBACK_NO_API_KEY: ANTHROPIC_API_KEY is not set. Cannot run fallback execution.");
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("FALLBACK_NO_API_KEY: OPENAI_API_KEY is not set. Cannot run fallback worker execution.");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

// ── LLM Call Helpers ─────────────────────────────────────────────────────────

async function callAnthropic(params: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userMessage }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : JSON.stringify(block);
}

async function callOpenAI(params: {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}): Promise<string> {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.maxTokens,
    temperature: params.temperature,
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userMessage },
    ],
  });
  return response.choices[0]?.message?.content || "";
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
  const doc = await getDb().collection(COLLECTIONS.ARTIFACTS).doc(artifactId).get();
  if (!doc.exists) return "";
  return doc.data()?.artifact_content || "";
}

// ── Node Implementations ─────────────────────────────────────────────────────

async function executeCOO(prompt: string, envelopeId: string, agentId: string, fingerprint: string): Promise<string> {
  const cfg = AGENT_MODELS.coo;
  console.log(`[FALLBACK:COO] Calling ${cfg.model} for envelope ${envelopeId}`);

  const raw = await callAnthropic({
    model: cfg.model,
    systemPrompt: COO_SYSTEM_PROMPT,
    userMessage: `User task:\n\n${prompt}\n\nCreate the execution plan.`,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  });

  const result = safeParseJSON(raw);
  const content = JSON.stringify(result, null, 2);

  return await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "plan",
    content,
  });
}

async function executeResearcher(
  prompt: string, inputRef: string | null, envelopeId: string, agentId: string, fingerprint: string
): Promise<string> {
  const cfg = AGENT_MODELS.researcher;
  console.log(`[FALLBACK:Researcher] Calling ${cfg.model} for envelope ${envelopeId}`);

  let planContext = "";
  if (inputRef) {
    const planContent = await loadArtifactContent(inputRef);
    if (planContent) planContext = `\n\nExecution Plan:\n${planContent}`;
  }

  const raw = await callAnthropic({
    model: cfg.model,
    systemPrompt: RESEARCHER_SYSTEM_PROMPT,
    userMessage: `Task:\n\n${prompt}${planContext}\n\nProvide research findings.`,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  });

  const result = safeParseJSON(raw);
  const content = JSON.stringify(result, null, 2);

  return await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "assignment",
    content,
  });
}

async function executeWorker(
  prompt: string, inputRef: string | null, envelopeId: string, agentId: string, fingerprint: string
): Promise<string> {
  const cfg = AGENT_MODELS.worker;
  console.log(`[FALLBACK:Worker] Calling ${cfg.model} for envelope ${envelopeId}`);

  let researchContext = "";
  if (inputRef) {
    const researchContent = await loadArtifactContent(inputRef);
    if (researchContent) researchContext = `\n\nResearch Findings:\n${researchContent}`;
  }

  const userMessage = `Task:\n\n${prompt}${researchContext}\n\nProduce the deliverable.`;
  let raw: string;

  try {
    raw = await callOpenAI({
      model: cfg.model,
      systemPrompt: WORKER_SYSTEM_PROMPT,
      userMessage,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    });
  } catch (err) {
    console.warn(`[FALLBACK:Worker] OpenAI failed, falling back to Anthropic:`, err);
    raw = await callAnthropic({
      model: "claude-sonnet-4-6",
      systemPrompt: WORKER_SYSTEM_PROMPT,
      userMessage,
      temperature: cfg.temperature,
      maxTokens: 8192,
    });
  }

  const result = safeParseJSON(raw);
  const content = JSON.stringify(result, null, 2);

  return await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "deliverable",
    content,
  });
}

async function executeGrader(
  prompt: string, inputRef: string | null, envelopeId: string, agentId: string, fingerprint: string
): Promise<string> {
  const cfg = AGENT_MODELS.grader;
  console.log(`[FALLBACK:Grader] Calling ${cfg.model} for envelope ${envelopeId}`);

  let deliverableContext = "";
  if (inputRef) {
    const deliverableContent = await loadArtifactContent(inputRef);
    if (deliverableContent) deliverableContext = `\n\nDeliverable to evaluate:\n${deliverableContent}`;
  }

  const raw = await callAnthropic({
    model: cfg.model,
    systemPrompt: GRADER_SYSTEM_PROMPT,
    userMessage: `Original task:\n\n${prompt}${deliverableContext}\n\nEvaluate the deliverable.`,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
  });

  const result = safeParseJSON(raw);
  const content = JSON.stringify(result, null, 2);

  return await createArtifact({
    envelopeId, agentId, fingerprint,
    artifactType: "evaluation",
    content,
  });
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
}): Promise<{ success: boolean; artifact_id: string }> {
  const { envelope_id, step_type, agent_id, prompt, input_ref } = params;
  const fp = params.identity_fingerprint || "00000000";

  let artifactId: string;

  switch (step_type) {
    case "plan":
      artifactId = await executeCOO(prompt, envelope_id, agent_id, fp);
      break;
    case "assign":
      artifactId = await executeResearcher(prompt, input_ref, envelope_id, agent_id, fp);
      break;
    case "artifact_produce":
    case "produce_artifact":
      artifactId = await executeWorker(prompt, input_ref, envelope_id, agent_id, fp);
      break;
    case "evaluate":
    case "evaluation":
      artifactId = await executeGrader(prompt, input_ref, envelope_id, agent_id, fp);
      break;
    default:
      throw new Error(`FALLBACK_UNSUPPORTED_STEP: ${step_type}`);
  }

  return { success: true, artifact_id: artifactId };
}
