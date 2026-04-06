/**
 * Identity & Runtime — End-to-End Integration Test
 *
 * Proves the critical identity invariant through a complete execution path:
 *
 *   1.  Register agent identity  (agents collection)
 *   2.  Build envelope with correct fingerprint
 *   3.  Persist envelope to execution_envelopes
 *   4.  Add entry to execution_queue
 *   5.  Worker claims the queue entry (status: queued → claimed)
 *   6.  verifyIdentity()           — fingerprint verified against stored agent record
 *   7.  acquirePerAgentLease()     — per-agent lease written to envelope
 *   8.  claimEnvelopeStep()        — step status: ready → executing
 *   9.  finalizeEnvelopeStep()     — step status: executing → completed
 *   10. Assert execution_traces contains an IDENTITY_VERIFIED event
 *
 * Also verifies the mismatch path:
 *   - tampered fingerprint in identity_context → verifyIdentity returns verified:false
 *   - envelope status transitions to "quarantined"
 *
 * Uses an in-memory Firestore mock — no live connection required.
 */
export {};
//# sourceMappingURL=identity-e2e.test.d.ts.map