import { NextRequest, NextResponse } from "next/server";
import { workflowEngine } from "@/lib/workflow-engine";
import { verifyUserApiKey, secureJson } from "@/lib/api-security";

// Governance Protocol: Fallback Approval Route

export async function POST(
    req: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        const { jobId } = await params;
        const auth = await verifyUserApiKey(req);
        if (auth.error) return auth.error;

        const result = await workflowEngine.approveFallback({
            jobId,
            userId: auth.userId
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("[API] approveFallback error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" },
            { status: 500 }
        );
    }
}
