"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const engine_1 = require("../engine");
const memory_db_1 = require("./memory-db");
const db_1 = require("../db");
(0, vitest_1.describe)("Phase-2 Identity Enforcement — Dispatch Guards", () => {
    let db;
    (0, vitest_1.beforeEach)(() => {
        db = new memory_db_1.MemoryDb();
        (0, db_1.setDb)(db);
    });
    (0, vitest_1.it)("Test: Missing agent → hard fail (AGENT_PROVISIONING_FAILED) — Phase 2 always enforces", async () => {
        // DB is empty — no agents seeded
        await (0, vitest_1.expect)((0, engine_1.dispatch)({
            prompt: "Production fail test",
            userId: "user_test",
            agentId: "agent_unknown_dispatch"
        })).rejects.toThrow("AGENT_PROVISIONING_FAILED");
    });
    (0, vitest_1.it)("Test: Unverified agent → quarantined envelope (verified=false path)", async () => {
        const { COLLECTIONS } = await Promise.resolve().then(() => __importStar(require("../constants")));
        // Seed an UNVERIFIED agent (verified = false)
        await db.collection(COLLECTIONS.AGENTS).doc("agent_coo").set({
            agent_id: "agent_coo",
            identity_fingerprint: "fp_coo",
            canonical_identity_json: JSON.stringify({ agent_id: "agent_coo" }),
            verified: false,
        });
        // Seed all other pipeline agents as verified
        for (const agentId of ["agent_researcher", "agent_worker", "agent_grader"]) {
            await db.collection(COLLECTIONS.AGENTS).doc(agentId).set({
                agent_id: agentId,
                identity_fingerprint: `fp_${agentId}`,
                canonical_identity_json: JSON.stringify({ agent_id: agentId }),
                verified: true,
            });
        }
        const result = await (0, engine_1.dispatch)({
            prompt: "Unverified agent test",
            userId: "user_test",
            agentId: "agent_coo",
        });
        // Should return an envelope in quarantined state
        (0, vitest_1.expect)(result.success).toBe(false);
        (0, vitest_1.expect)(result.envelope_id).toBeDefined();
        // Verify the envelope is marked quarantined in DB
        const envDoc = await db.collection(COLLECTIONS.EXECUTION_ENVELOPES).doc(result.envelope_id).get();
        (0, vitest_1.expect)(envDoc.data()?.status).toBe("quarantined");
    });
});
//# sourceMappingURL=lazy-provisioning.test.js.map