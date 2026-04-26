import { NextRequest, NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";
import { verifyUserApiKey, secureJson } from "@/lib/api-security";

// Governance Protocol: Fallback Rejection Route

export async function POST(
    req: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const { jobId } = await params;
        const { reason } = await req.json();
        const auth = await verifyUserApiKey(req);
        if (auth.error) return auth.error;

        const result = await workflowEngine.rejectFallback({
            jobId,
            userId: auth.userId,
            reason: reason || "Operator Manual Fallback Rejection"
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[API] rejectFallback error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
