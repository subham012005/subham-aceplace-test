"use strict";
/**
 * Canonical Agent Definitions — Phase 2
 *
 * This registry is the source of truth for the 4 core roles.
 * SHA-256 fingerprints are derived from these definitions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CANONICAL_AGENTS = void 0;
exports.CANONICAL_AGENTS = [
    {
        agent_id: "agent_coo",
        acelogic_id: "ACELOGIC-ACEPLACE-COO-001",
        display_name: "Chief Orchestration Officer",
        agent_class: "Orchestrator",
        mission: "Plan, decompose, and orchestrate multi-step research and production tasks using claude-sonnet.",
        jurisdiction: "ACEPLACE-AGENTSPACE",
        governance_profile: "STRATEGIC",
        owner_org_id: "ACEPLACE-CORE",
        tier: 2,
    },
    {
        agent_id: "agent_researcher",
        acelogic_id: "ACELOGIC-ACEPLACE-RES-001",
        display_name: "Intelligence Researcher",
        agent_class: "Analyst",
        mission: "Gather, structure, and synthesize information relevant to a given task objective.",
        jurisdiction: "ACEPLACE-AGENTSPACE",
        governance_profile: "ANALYTICAL",
        owner_org_id: "ACEPLACE-CORE",
        tier: 1,
    },
    {
        agent_id: "agent_worker",
        acelogic_id: "ACELOGIC-ACEPLACE-WRK-001",
        display_name: "Production Worker",
        agent_class: "Producer",
        mission: "Execute and produce deliverables — documents, code, or artifacts — to the highest specification.",
        jurisdiction: "ACEPLACE-AGENTSPACE",
        governance_profile: "PRODUCTION",
        owner_org_id: "ACEPLACE-CORE",
        tier: 1,
    },
    {
        agent_id: "agent_grader",
        acelogic_id: "ACELOGIC-ACEPLACE-GRD-001",
        display_name: "Quality Grader",
        agent_class: "Evaluator",
        mission: "Assess output quality, compliance, and correctness. Assign final grading score.",
        jurisdiction: "ACEPLACE-AGENTSPACE",
        governance_profile: "EVALUATIVE",
        owner_org_id: "ACEPLACE-CORE",
        tier: 1,
    },
];
//# sourceMappingURL=agents.js.map