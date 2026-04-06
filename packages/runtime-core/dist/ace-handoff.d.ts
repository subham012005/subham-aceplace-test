/**
 * ACEPLACE ACE → #us#.task.handoff → execution envelope (entry contract).
 */
import type { IdentityContext, RuntimeRole } from "./types";
export type HandoffRole = {
    role: RuntimeRole;
    agent_id: string;
};
export type AceHandoffMessage = {
    protocol: "#us#";
    version?: "1.0";
    message_type: "#us#.task.handoff";
    execution: {
        org_id: string;
        requested_by_user_id: string;
        session_id: string;
        draft_id: string;
        license_id?: string;
    };
    authority?: {
        approval_required?: boolean;
    };
    payload: {
        task: {
            description: string;
            context?: Record<string, unknown>;
            attachments?: string[];
        };
        role_assignments: HandoffRole[];
    };
    identity?: {
        agent_id: string;
        identity_fingerprint: string;
    };
    metadata?: {
        created_at?: string;
    };
};
export type CreateAceHandoffInput = {
    org_id: string;
    requested_by_user_id: string;
    session_id: string;
    task_description: string;
    context?: Record<string, unknown>;
    attachments?: string[];
    role_assignments: Partial<Record<RuntimeRole, string>>;
    require_human_approval?: boolean;
    license_id?: string;
};
export declare function createAceHandoff(input: CreateAceHandoffInput): AceHandoffMessage;
export declare function validateAceHandoff(handoff: unknown): asserts handoff is AceHandoffMessage;
export declare function createExecutionEnvelopeFromHandoff(params: {
    envelope_id: string;
    org_id: string;
    root_task_id: string;
    coordinator_agent_id: string;
    identity_contexts: Record<string, IdentityContext>;
    role_assignments: Partial<Record<RuntimeRole, string>>;
    require_human_approval: boolean;
    license_id?: string;
    task_description?: string;
    requested_by_user_id?: string;
}): Promise<void>;
export declare function acceptAceHandoff(handoff: AceHandoffMessage): Promise<{
    success: boolean;
    envelope_id: string;
}>;
//# sourceMappingURL=ace-handoff.d.ts.map