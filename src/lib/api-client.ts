/**
 * Unified client for ACEPLACE Workstation API.
 * 
 * All client-side calls go through local /api proxy routes.
 */
import { auth } from "./firebase";
import { getIdToken } from "firebase/auth";

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

class AceApiClient {
    async createJob(data: CreateJobData) {
        const response = await this.secureFetch("/api/jobs/intake", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    /**
     * Dashboard-oriented helper: dispatch a deterministic runtime task
     * from an authenticated workstation session.
     *
     * This hits /api/runtime/dispatch/from-dashboard which:
     *  - Authenticates via Firebase ID token (verifyUserApiKey)
     *  - Calls the runtime engine dispatcher
     */
    async dispatchFromDashboard(data: {
        root_task: string;
        job_id?: string;
        execution_policy?: { entry_agent: string };
        knowledge_context?: { collections?: string[]; direct_text?: string; enabled: boolean };
        instruction_context?: { profiles?: string[]; enabled: boolean };
        web_search_context?: { enabled: boolean; queries?: string[]; sources_used?: string[] };
    }) {
        const response = await this.secureFetch("/api/runtime/dispatch/from-dashboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async getAllJobs(userId: string) {
        const response = await this.secureFetch(`/api/jobs?user_id=${userId}`);
        return this.handleResponse(response);
    }

    async getJob(jobId: string, userId?: string) {
        const url = userId ? `/api/jobs/${jobId}?user_id=${userId}` : `/api/jobs/${jobId}`;
        const response = await this.secureFetch(url);
        return this.handleResponse(response);
    }

    async deleteJob(jobId: string, userId?: string) {
        const url = userId ? `/api/jobs/${jobId}?user_id=${userId}` : `/api/jobs/${jobId}`;
        const response = await this.secureFetch(url, {
            method: "DELETE"
        });
        return this.handleResponse(response);
    }

    async approveJob(jobId: string) {
        const response = await this.secureFetch("/api/jobs/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId }),
        });
        return this.handleResponse(response);
    }

    async rejectJob(jobId: string, reason: string) {
        const response = await this.secureFetch("/api/jobs/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId, reason }),
        });
        return this.handleResponse(response);
    }

    async resurrectJob(jobId: string, reason: string) {
        const response = await this.secureFetch(`/api/jobs/${jobId}/resurrect`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        });
        return this.handleResponse(response);
    }

    async approveFallback(jobId: string) {
        const response = await this.secureFetch(`/api/jobs/${jobId}/fallback/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        return this.handleResponse(response);
    }

    async rejectFallback(jobId: string, reason: string) {
        const response = await this.secureFetch(`/api/jobs/${jobId}/fallback/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
        });
        return this.handleResponse(response);
    }

    async simulateFork(data: ForkSimulateData) {
        const response = await this.secureFetch(`/api/jobs/${data.job_id}/fork-simulate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    // ─── Phase 2 Runtime API ────────────────────────────────

    async dispatchTask(data: any) {
        const response = await this.secureFetch("/api/runtime/dispatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }


    async getEnvelope(id: string) {
        const response = await this.secureFetch(`/api/runtime/envelope/${id}`);
        return this.handleResponse(response);
    }

    async getEnvelopeSteps(id: string) {
        const response = await this.secureFetch(`/api/runtime/envelope/${id}/steps`);
        return this.handleResponse(response);
    }

    async acquireLease(data: { execution_id: string; agent_id: string }) {
        const response = await this.secureFetch("/api/runtime/lease/acquire", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async releaseLease(leaseId: string) {
        const response = await this.secureFetch("/api/runtime/lease/release", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lease_id: leaseId }),
        });
        return this.handleResponse(response);
    }

    async updateCheckpoint(id: string, data: any) {
        const response = await this.secureFetch(`/api/runtime/checkpoint/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    async verifyIdentity(data: { agent_id: string; fingerprint: string }) {
        const response = await this.secureFetch("/api/runtime/identity/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        return this.handleResponse(response);
    }

    // ─── Dashboard Data Fetching (Secure Layer) ───────

    async getActiveLeases() {
        const response = await this.secureFetch("/api/runtime/leases/active");
        return this.handleResponse(response);
    }

    async getAgentIdentity(agentId: string) {
        const response = await this.secureFetch(`/api/runtime/identity/${agentId}`);
        if (response.status === 404) {
            return null;
        }
        return this.handleResponse(response);
    }

    async getUserEnvelopes(userId: string) {
        const response = await this.secureFetch(`/api/runtime/envelopes?user_id=${userId}`);
        return this.handleResponse(response);
    }

    async getRuntimeStats() {
        const response = await this.secureFetch("/api/runtime/stats");
        return this.handleResponse(response);
    }

    async getSecureJobs() {
        const response = await this.secureFetch("/api/runtime/jobs");
        return this.handleResponse(response);
    }

    async getSecureJobDetail(jobId: string) {
        const response = await this.secureFetch(`/api/runtime/jobs/${jobId}`);
        return this.handleResponse(response);
    }

    async getSecureJobTraces(jobId: string) {
        const response = await this.secureFetch(`/api/runtime/jobs/${jobId}/traces`);
        return this.handleResponse(response);
    }

    async getSecureJobArtifacts(jobId: string) {
        const response = await this.secureFetch(`/api/runtime/jobs/${jobId}/artifacts`);
        return this.handleResponse(response);
    }

    // ─── Intelligence Provider Config (Secure Admin Layer) ───

    async getIntelligenceConfig() {
        const response = await this.secureFetch("/api/user/intelligence-providers");
        if (response.status === 404) return null;
        return this.handleResponse(response);
    }

    async saveIntelligenceConfig(config: any) {
        const response = await this.secureFetch("/api/user/intelligence-providers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        });
        return this.handleResponse(response);
    }

    async listExplorerEnvelopes(params?: { org_id?: string; status?: string; limit?: number }) {
        const qs = new URLSearchParams();
        if (params?.org_id) qs.set("org_id", params.org_id);
        if (params?.status) qs.set("status", params.status);
        if (params?.limit != null) qs.set("limit", String(params.limit));
        const response = await fetch(`/api/explorer/envelopes?${qs.toString()}`);
        return this.handleResponse(response);
    }

    async getExplorerEnvelopeDetail(envelopeId: string) {
        const response = await fetch(`/api/explorer/envelopes/${envelopeId}`);
        return this.handleResponse(response);
    }

    async getExplorerEnvelopeSummary(envelopeId: string) {
        const response = await fetch(`/api/explorer/envelopes/${envelopeId}/summary`);
        return this.handleResponse(response);
    }

    async getExplorerTraces(envelopeId: string) {
        const response = await fetch(`/api/explorer/traces/${envelopeId}`);
        return this.handleResponse(response);
    }

    async getExplorerMessages(envelopeId: string) {
        const response = await fetch(`/api/explorer/messages/${envelopeId}`);
        return this.handleResponse(response);
    }

    async getExplorerArtifacts(envelopeId: string) {
        const response = await fetch(`/api/explorer/artifacts/${envelopeId}`);
        return this.handleResponse(response);
    }

    async getExplorerTelemetryEnvelope(envelopeId: string) {
        const response = await this.secureFetch(`/api/explorer/telemetry/envelope/${envelopeId}`);
        return this.handleResponse(response);
    }

    async getExplorerTelemetryAgent(agentId: string) {
        const response = await this.secureFetch(`/api/explorer/telemetry/agent/${agentId}`);
        return this.handleResponse(response);
    }

    /** 🔓 Public alias for secureFetch — for use by components that need direct authenticated calls */
    async secureFetchPublic(url: string, init: RequestInit = {}) {
        return this.secureFetch(url, init);
    }

    /** 🔒 Private helper to inject Authorization Bearer token */
    private async secureFetch(url: string, init: RequestInit = {}) {
        const user = auth.currentUser;
        const headers = new Headers(init.headers || {});
        
        if (user) {
            try {
                const token = await getIdToken(user);
                headers.set("Authorization", `Bearer ${token}`);
            } catch (err) {
                console.error("[AceApiClient] Failed to get ID token:", err);
            }
        }

        return fetch(url, {
            ...init,
            headers
        });
    }

    private async handleResponse(response: Response) {
        if (!response.ok) {
            const error = (await response.json().catch(() => ({}))) as {
                error?: string;
                message?: string;
            };
            throw new Error(
                error.message || error.error || `Request failed with status ${response.status}`
            );
        }
        return response.json();
    }
}

export const aceApi = new AceApiClient();
