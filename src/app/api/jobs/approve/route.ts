import { NextResponse } from "next/server";

/**
 * Global Job Approve Proxy
 * Purely forwards the request to n8n for processing.
 */
export async function POST(req: Request) {
    try {
        const body = await req.json();

        const baseUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_BASE_URL;
        if (!baseUrl) {
            return NextResponse.json({ error: "N8N_BASE_URL_NOT_CONFIGURED" }, { status: 500 });
        }

        const n8nUrl = `${baseUrl}job-approve`;

        const response = await fetch(n8nUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.N8N_ACCESS_TOKEN}`
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ error: "n8n approval failed", details: errorText }, { status: response.status });
        }

        const text = await response.text();
        let result = {};
        try {
            result = text ? JSON.parse(text) : { success: true, message: "Approval triggered" };
        } catch (e) {
            result = { success: true, message: text || "Approval triggered" };
        }

        return NextResponse.json(result, { status: response.status });

    } catch (error: any) {
        console.error("Global Approve Proxy Error:", error);
        return NextResponse.json({
            error: "PROXY_ERROR",
            message: error.message || "Failed to forward request to n8n"
        }, { status: 500 });
    }
}
