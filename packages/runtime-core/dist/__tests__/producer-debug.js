"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = debug;
const engine_1 = require("../engine");
const memory_db_1 = require("./memory-db");
const db_1 = require("../db");
const constants_1 = require("../constants");
async function debug() {
    const db = new memory_db_1.MemoryDb();
    (0, db_1.setDb)(db);
    // Seed one agent so it's found
    await db.collection(constants_1.COLLECTIONS.AGENTS).doc("agent_coo").set({
        agent_id: "agent_coo",
        display_name: "COO",
        identity_fingerprint: "coo_fp",
        canonical_identity_json: "{}",
        verified: true
    });
    console.log("--- DISPATCHING ---");
    const result = await (0, engine_1.dispatch)({
        prompt: "Test Task",
        userId: "user_01",
        orgId: "org_01",
        agentId: "agent_coo"
    });
    console.log("--- PRODUCED STEPS ---");
    console.log(JSON.stringify(result.envelope.steps, null, 2));
    return result.envelope;
}
if (require.main === module) {
    debug().catch(console.error);
}
//# sourceMappingURL=producer-debug.js.map