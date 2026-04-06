/**
 * #us# Message Engine — deterministic execution grammar (ACEPLACE spec).
 * All step execution persists messages to execution_messages + execution_traces.
 */
import type { ProtocolVerb, USMessage } from "./types";
export declare function createUSMessage(input: Omit<USMessage, "protocol" | "version" | "metadata">): USMessage;
export declare function storeUSMessage(msg: USMessage): Promise<string>;
export declare function mapStepTypeToUSMessage(stepType: string): ProtocolVerb;
export declare function handleUSMessage(msg: USMessage): Promise<USMessage | null>;
//# sourceMappingURL=us-message-engine.d.ts.map