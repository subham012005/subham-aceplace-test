"use strict";
/**
 * Prime guard cache for a batch of steps before parallel execution (deduped per agent).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchPrimeExecutionGuards = batchPrimeExecutionGuards;
const acelogic_guard_1 = require("./acelogic-guard");
async function batchPrimeExecutionGuards(agents) {
    const seen = new Set();
    const unique = [];
    for (const a of agents) {
        const k = `${a.agent_id}:${a.instance_id}:${a.license_id}`;
        if (seen.has(k))
            continue;
        seen.add(k);
        unique.push(a);
    }
    await Promise.all(unique.map((a) => (0, acelogic_guard_1.acelogicExecutionGuard)(a)));
}
//# sourceMappingURL=batch-execution-guard.js.map