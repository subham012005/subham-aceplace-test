/**
 * Queue Kernel — Phase 2
 *
 * Manages the execution_queue collection.
 * Ported from runtime-worker to allow library-level access and testing.
 */
/**
 * Claim the next available envelope from the queue.
 * Implements strict 4-part AND condition for reclamation.
 */
export declare function claimNextEnvelope(workerId: string): Promise<{
    envelope_id: string;
} | null>;
/**
 * Reset queue entry to queued and clear ALL ownership fields.
 */
export declare function requeueEnvelope(envelopeId: string): Promise<void>;
/**
 * Mark queue entry as finalized (completed or failed).
 */
export declare function finalizeQueueEntry(envelopeId: string, status: "completed" | "failed", error?: string): Promise<void>;
//# sourceMappingURL=queue.d.ts.map