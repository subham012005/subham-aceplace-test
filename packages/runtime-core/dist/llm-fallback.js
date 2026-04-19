"use strict";
/**
 * LLM Fallback Execution — TypeScript-native agent execution.
 *
 * Replicates the Python agent-engine node logic (coo, researcher, worker, grader)
 * so the runtime-worker can execute jobs when the Python process is unavailable.
 *
 * Activated automatically when the Python agent-engine is unreachable.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeFallbackStep = executeFallbackStep;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const openai_1 = __importDefault(require("openai"));
const db_1 = require("./db");
const constants_1 = require("./constants");
// ── Model Configuration (mirrors agent-engine/config.py) ─────────────────────
const AGENT_MODELS = {
    coo: { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.2, maxTokens: 4096 },
    researcher: { provider: "anthropic", model: "claude-sonnet-4-6", temperature: 0.3, maxTokens: 8192 },
    worker: { provider: "openai", model: "gpt-4o", temperature: 0.4, maxTokens: 8192 },
    grader: { provider: "anthropic", model: "claude-haiku-4-5", temperature: 0.1, maxTokens: 4096 },
};
// Fallback OpenAI model to use when the primary Anthropic model is unavailable
const ANTHROPIC_TO_OPENAI_FALLBACK = {
    "claude-sonnet-4-6": "gpt-4o",
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
let _anthropic = null;
let _openai = null;
function getAnthropic() {
    if (!_anthropic) {
        const key = process.env.ANTHROPIC_API_KEY;
        if (!key)
            throw new Error("FALLBACK_NO_API_KEY: ANTHROPIC_API_KEY is not set. Cannot run fallback execution.");
        _anthropic = new sdk_1.default({ apiKey: key });
    }
    return _anthropic;
}
function getOpenAI() {
    if (!_openai) {
        const key = process.env.OPENAI_API_KEY;
        if (!key)
            throw new Error("FALLBACK_NO_API_KEY: OPENAI_API_KEY is not set. Cannot run OpenAI fallback execution.");
        _openai = new openai_1.default({ apiKey: key });
    }
    return _openai;
}
// Per-million-token pricing (input / output)
const PRICING = {
    "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
    "claude-haiku-4-5": { input: 0.8, output: 4.0 },
    "gpt-4o": { input: 2.5, output: 10.0 },
    "gpt-4o-mini": { input: 0.15, output: 0.60 },
};
function calculateCost(model, inputTokens, outputTokens) {
    const rates = PRICING[model] || { input: 3.0, output: 15.0 };
    return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}
async function callAnthropic(params) {
    const client = getAnthropic();
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
async function callOpenAI(params) {
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
// ── Provider Fallback Helper ─────────────────────────────────────────────────
// Tries Anthropic first; on ANY error automatically retries with the mapped
// OpenAI model. This ensures Anthropic quota/rate-limit errors never surface
// as hard job failures when an OpenAI key is available.
async function callWithAnthropicFallback(params) {
    try {
        return await callAnthropic(params);
    }
    catch (primaryErr) {
        const fallbackModel = ANTHROPIC_TO_OPENAI_FALLBACK[params.model] ?? "gpt-4o";
        console.warn(`[FALLBACK:${params.agentLabel}] Anthropic (${params.model}) failed — ` +
            `switching to OpenAI (${fallbackModel}): ${primaryErr.message}`);
        return await callOpenAI({
            model: fallbackModel,
            systemPrompt: params.systemPrompt,
            userMessage: params.userMessage,
            temperature: params.temperature,
            maxTokens: params.maxTokens,
        });
    }
}
// ── JSON Parse Helper (mirrors Python _parse_json fallback) ──────────────────
function safeParseJSON(raw) {
    // Try raw JSON first
    try {
        return JSON.parse(raw);
    }
    catch { /* continue */ }
    // Try extracting from markdown code block
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
        try {
            return JSON.parse(match[1].trim());
        }
        catch { /* continue */ }
    }
    // Return raw as content wrapper
    return { raw_content: raw };
}
// ── Artifact Persistence ─────────────────────────────────────────────────────
async function createArtifact(params) {
    const artifactId = `art_${params.artifactType}_${Date.now()}`;
    await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.ARTIFACTS).doc(artifactId).set({
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
async function loadArtifactContent(artifactId) {
    const doc = await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.ARTIFACTS).doc(artifactId).get();
    if (!doc.exists)
        return "";
    return doc.data()?.artifact_content || "";
}
// ── Node Implementations ─────────────────────────────────────────────────────
async function executeCOO(prompt, envelopeId, agentId, fingerprint) {
    const cfg = AGENT_MODELS.coo;
    console.log(`[FALLBACK:COO] Calling ${cfg.model} for envelope ${envelopeId}`);
    const { text, usage } = await callWithAnthropicFallback({
        model: cfg.model,
        systemPrompt: COO_SYSTEM_PROMPT,
        userMessage: `User task:\n\n${prompt}\n\nCreate the execution plan.`,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        agentLabel: "COO",
    });
    const result = safeParseJSON(text);
    const content = JSON.stringify(result, null, 2);
    const artifactId = await createArtifact({
        envelopeId, agentId, fingerprint,
        artifactType: "plan",
        content,
    });
    return { artifactId, usage };
}
async function executeResearcher(prompt, inputRef, envelopeId, agentId, fingerprint) {
    const cfg = AGENT_MODELS.researcher;
    console.log(`[FALLBACK:Researcher] Calling ${cfg.model} for envelope ${envelopeId}`);
    let planContext = "";
    if (inputRef) {
        const planContent = await loadArtifactContent(inputRef);
        if (planContent)
            planContext = `\n\nExecution Plan:\n${planContent}`;
    }
    const { text, usage } = await callWithAnthropicFallback({
        model: cfg.model,
        systemPrompt: RESEARCHER_SYSTEM_PROMPT,
        userMessage: `Task:\n\n${prompt}${planContext}\n\nProvide research findings.`,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        agentLabel: "Researcher",
    });
    const result = safeParseJSON(text);
    const content = JSON.stringify(result, null, 2);
    const artifactId = await createArtifact({
        envelopeId, agentId, fingerprint,
        artifactType: "assignment",
        content,
    });
    return { artifactId, usage };
}
async function executeWorker(prompt, inputRef, envelopeId, agentId, fingerprint) {
    const cfg = AGENT_MODELS.worker;
    console.log(`[FALLBACK:Worker] Calling ${cfg.model} for envelope ${envelopeId}`);
    let researchContext = "";
    if (inputRef) {
        const researchContent = await loadArtifactContent(inputRef);
        if (researchContent)
            researchContext = `\n\nResearch Findings:\n${researchContent}`;
    }
    const userMessage = `Task:\n\n${prompt}${researchContext}\n\nProduce the deliverable.`;
    let callResult;
    try {
        callResult = await callOpenAI({
            model: cfg.model,
            systemPrompt: WORKER_SYSTEM_PROMPT,
            userMessage,
            temperature: cfg.temperature,
            maxTokens: cfg.maxTokens,
        });
    }
    catch (err) {
        console.warn(`[FALLBACK:Worker] OpenAI failed, falling back to Anthropic:`, err);
        callResult = await callAnthropic({
            model: "claude-sonnet-4-6",
            systemPrompt: WORKER_SYSTEM_PROMPT,
            userMessage,
            temperature: cfg.temperature,
            maxTokens: 8192,
        });
    }
    const result = safeParseJSON(callResult.text);
    const content = JSON.stringify(result, null, 2);
    const artifactId = await createArtifact({
        envelopeId, agentId, fingerprint,
        artifactType: "deliverable",
        content,
    });
    return { artifactId, usage: callResult.usage };
}
async function executeGrader(prompt, inputRef, envelopeId, agentId, fingerprint) {
    const cfg = AGENT_MODELS.grader;
    console.log(`[FALLBACK:Grader] Calling ${cfg.model} for envelope ${envelopeId}`);
    let deliverableContext = "";
    if (inputRef) {
        const deliverableContent = await loadArtifactContent(inputRef);
        if (deliverableContent)
            deliverableContext = `\n\nDeliverable to evaluate:\n${deliverableContent}`;
    }
    const { text, usage } = await callWithAnthropicFallback({
        model: cfg.model,
        systemPrompt: GRADER_SYSTEM_PROMPT,
        userMessage: `Original task:\n\n${prompt}${deliverableContext}\n\nEvaluate the deliverable.`,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        agentLabel: "Grader",
    });
    const result = safeParseJSON(text);
    const content = JSON.stringify(result, null, 2);
    const artifactId = await createArtifact({
        envelopeId, agentId, fingerprint,
        artifactType: "evaluation",
        content,
    });
    return { artifactId, usage };
}
// ── Public Dispatcher ────────────────────────────────────────────────────────
async function executeFallbackStep(params) {
    const { envelope_id, step_type, agent_id, prompt, input_ref } = params;
    const fp = params.identity_fingerprint || "00000000";
    let result;
    switch (step_type) {
        case "plan":
            result = await executeCOO(prompt, envelope_id, agent_id, fp);
            break;
        case "assign":
            result = await executeResearcher(prompt, input_ref, envelope_id, agent_id, fp);
            break;
        case "artifact_produce":
        case "produce_artifact":
            result = await executeWorker(prompt, input_ref, envelope_id, agent_id, fp);
            break;
        case "evaluate":
        case "evaluation":
            result = await executeGrader(prompt, input_ref, envelope_id, agent_id, fp);
            break;
        default:
            throw new Error(`FALLBACK_UNSUPPORTED_STEP: ${step_type}`);
    }
    // Persist usage to the job doc for dashboard display
    try {
        const envDoc = await (0, db_1.getDb)().collection(constants_1.COLLECTIONS.EXECUTION_ENVELOPES).doc(envelope_id).get();
        const jobId = envDoc.data()?.job_id;
        if (jobId) {
            const jobRef = (0, db_1.getDb)().collection(constants_1.COLLECTIONS.JOBS).doc(jobId);
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
                updated_at: new Date().toISOString(),
            }, { merge: true });
        }
    }
    catch (e) {
        console.warn(`[FALLBACK] Failed to sync usage to job: ${e.message}`);
    }
    return { success: true, artifact_id: result.artifactId, usage: result.usage };
}
//# sourceMappingURL=llm-fallback.js.map