import { NextResponse } from "next/server";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("user_id");

        if (!userId) {
            return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;
        if (!baseUrl) {
            return NextResponse.json({ error: "NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL is not defined in environment." }, { status: 500 });
        }
        const n8nStatsUrl = `${baseUrl}dashboard-stats?user_id=${userId}`;
        console.log(`[PROXY] Fetching stats from: ${n8nStatsUrl}`);

        const response = await fetch(n8nStatsUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.N8N_ACCESS_TOKEN}`
            },
            cache: 'no-store' // Ensure we get fresh stats
        });

        if (!response.ok) {
            console.warn("n8n stats endpoint returned error, using fallback data");
            return NextResponse.json(getFallbackData());
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Stats fetch error:", error);
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
