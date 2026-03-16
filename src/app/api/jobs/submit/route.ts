import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const n8nUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
        if (!n8nUrl) {
            return NextResponse.json({ error: "NEXT_PUBLIC_N8N_WEBHOOK_URL is not defined in environment." }, { status: 500 });
        }
        console.log(`[PROXY] Submitting job at: ${n8nUrl}`);

        // Enrich payload with telemetry
        const enrichedPayload = {
            ...body,
            metadata: {
                source: "NXQ-Workstation",
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV,
                requestId: Math.random().toString(36).substring(7)
            }
        };

        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.N8N_ACCESS_TOKEN}`
            },
            body: JSON.stringify(enrichedPayload),
        });

        // Robust JSON parsing
        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.error("[PROXY] Failed to parse n8n response as JSON:", responseText);
            data = { error: responseText || "Empty response from n8n" };
        }

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Submission error:", error);
        return NextResponse.json({ error: error.message || "Failed to submit job" }, { status: 500 });
    }
}
