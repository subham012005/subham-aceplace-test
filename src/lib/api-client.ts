/**
 * Unified client for NXQ Workstation API.
 * 
 * All client-side calls go through local /api proxy routes.
 */

export interface CreateJobData {
    user_id: string;
    requested_agent_id: string;
    job_type: string;
    prompt: string;
    job_id?: string;
    force_crash?: boolean;
}

export interface JobActionData {
    job_id: string;
    reason?: string;
}

export interface ForkSimulateData {
    job_id: string;
    identity_id: string;
    attempted_by: string;
    reason: string;
}

class NXQApiClient {
    async createJob(data: CreateJobData) {
        const response = await fetch("/api/jobs/intake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async getAllJobs(userId: string) {
        const response = await fetch(`/api/jobs?user_id=${userId}`);
        return this.handleResponse(response);
    }

    async getJob(jobId: string, userId?: string) {
        const url = userId ? `/api/jobs/${jobId}?user_id=${userId}` : `/api/jobs/${jobId}`;
        const response = await fetch(url);
        return this.handleResponse(response);
    }

    async approveJob(jobId: string) {
        const response = await fetch("/api/jobs/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId }),
        });
        return this.handleResponse(response);
    }

    async rejectJob(jobId: string, reason: string) {
        const response = await fetch("/api/jobs/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId, reason }),
        });
        return this.handleResponse(response);
    }

    async resurrectJob(jobId: string, reason: string) {
        const response = await fetch(`/api/jobs/${jobId}/resurrect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        });
        return this.handleResponse(response);
    }

    async simulateFork(data: ForkSimulateData) {
        const response = await fetch(`/api/jobs/${data.job_id}/fork-simulate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    // ─── Phase 2 Runtime API ────────────────────────────────

    async dispatchTask(data: any) {
        const response = await fetch("/api/runtime/dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async getEnvelope(id: string) {
        const response = await fetch(`/api/runtime/envelope/${id}`);
        return this.handleResponse(response);
    }

    async getEnvelopeSteps(id: string) {
        const response = await fetch(`/api/runtime/envelope/${id}/steps`);
        return this.handleResponse(response);
    }

    async acquireLease(data: { execution_id: string; agent_id: string }) {
        const response = await fetch("/api/runtime/lease/acquire", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async releaseLease(leaseId: string) {
        const response = await fetch("/api/runtime/lease/release", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lease_id: leaseId }),
        });
        return this.handleResponse(response);
    }

    async updateCheckpoint(id: string, data: any) {
        const response = await fetch(`/api/runtime/checkpoint/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async verifyIdentity(data: { agent_id: string; fingerprint: string }) {
        const response = await fetch("/api/runtime/identity/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    private async handleResponse(response: Response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(error.error || `Request failed with status ${response.status}`);
        }
        return response.json();
    }
}

export const nxqApi = new NXQApiClient();
