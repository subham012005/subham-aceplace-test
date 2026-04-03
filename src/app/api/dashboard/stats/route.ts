import { NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";

/**
 * Dashboard Stats — Local Workflow Engine
 * Queries Firestore directly for job/agent statistics.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!userId) {
            return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
        }

        const stats = await workflowEngine.getDashboardStats(userId);
        return NextResponse.json(stats);

    } catch (error: any) {
        console.error("Stats fetch error:", error);
        // Return fallback data on error
        return NextResponse.json(getFallbackData());
    }
}

function getFallbackData() {
    return {
        stats: {
            licensees: 0,
            totalAgents: 0,
            resurrectionEvents: 0,
            averagePassRate: "0%",
            identityLogs: "0",
            lineageVerified: "0"
        },
        missionQueue: [],
        agents: [
            { name: "CLAUDE-OPS", intel: "Anthropic Claude", gate: "Gate 1", color: "text-cyan-400" },
            { name: "ORION-GPT", intel: "OpenAI GPT-4", gate: "Gate 1", color: "text-blue-400" },
            { name: "SENTINEL-X", intel: "Anthropic Claude", gate: "Gate 1", color: "text-amber-400", status: "Standby" },
            { name: "NEBULA-01", intel: "OpenAI GPT-4", gate: "Gate 1", color: "text-emerald-400" }
        ],
        jobTypes: [
            "Data Analysis",
            "Research",
            "Security Audit",
            "Network Optimization",
            "Content Generation",
        ],
        systemStatus: {
            licenseeCap: { current: 0, max: 40 },
            activeAgents: { current: 0, max: 0 },
            gateLevels: 1
        }
    };
}
