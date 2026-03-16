export interface JobPayload {
    job_type: string;
    assigned_agent: string;
    payload: any;
}

/**
 * Dispatches a job to the n8n orchestration engine via the local API proxy.
 * This ensures the N8N_ACCESS_TOKEN is never exposed to the client browser.
 */
export async function submitJob(data: JobPayload) {
    const response = await fetch("/api/jobs/submit", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Dimensional dispatch failed");
    }

    return response.json();
}
