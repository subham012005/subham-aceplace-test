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
exports.FieldValue = exports.LocalJsonDb = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function seedAgents(store) {
    const CANONICAL_AGENTS = [
        {
            agent_id: "agent_coo",
            acelogic_id: "ACELOGIC-ACEPLACE-COO-001",
            display_name: "Chief Orchestration Officer",
            agent_class: "Orchestrator",
            mission: "Plan, decompose, and orchestrate multi-step research and production tasks using claude-sonnet.",
            jurisdiction: "ACEPLACE-AGENTSPACE",
            governance_profile: "STRATEGIC",
            owner_org_id: "ACEPLACE-CORE",
            tier: 2,
        },
        {
            agent_id: "agent_researcher",
            acelogic_id: "ACELOGIC-ACEPLACE-RES-001",
            display_name: "Intelligence Researcher",
            agent_class: "Analyst",
            mission: "Gather, structure, and synthesize information relevant to a given task objective.",
            jurisdiction: "ACEPLACE-AGENTSPACE",
            governance_profile: "ANALYTICAL",
            owner_org_id: "ACEPLACE-CORE",
            tier: 1,
        },
        {
            agent_id: "agent_worker",
            acelogic_id: "ACELOGIC-ACEPLACE-WRK-001",
            display_name: "Production Worker",
            agent_class: "Producer",
            mission: "Execute and produce deliverables — documents, code, or artifacts — to the highest specification.",
            jurisdiction: "ACEPLACE-AGENTSPACE",
            governance_profile: "PRODUCTION",
            owner_org_id: "ACEPLACE-CORE",
            tier: 1,
        },
        {
            agent_id: "agent_grader",
            acelogic_id: "ACELOGIC-ACEPLACE-GRD-001",
            display_name: "Quality Grader",
            agent_class: "Evaluator",
            mission: "Assess output quality, compliance, and correctness. Assign final grading score.",
            jurisdiction: "ACEPLACE-AGENTSPACE",
            governance_profile: "EVALUATIVE",
            owner_org_id: "ACEPLACE-CORE",
            tier: 1,
        },
    ];
    const sha256 = (str) => {
        const crypto = require("crypto");
        return crypto.createHash("sha256").update(str).digest("hex");
    };
    const hexFormat = (str) => "hex:0x" + str;
    for (const canonical of CANONICAL_AGENTS) {
        const key = `agents/${canonical.agent_id}`;
        if (!store[key]) {
            const canonicalJson = JSON.stringify({
                agent_id: canonical.agent_id,
                acelogic_id: canonical.acelogic_id,
                display_name: canonical.display_name,
                tier: canonical.tier,
                owner_org_id: canonical.owner_org_id,
            });
            const fp = hexFormat(sha256(canonicalJson));
            store[key] = {
                agent_id: canonical.agent_id,
                display_name: canonical.display_name,
                agent_class: canonical.agent_class,
                owner_org_id: canonical.owner_org_id,
                acelogic_id: canonical.acelogic_id,
                identity_fingerprint: fp,
                canonical_identity_json: canonicalJson,
                mission_hash: hexFormat(sha256(canonical.mission)),
                policy_hash: hexFormat(sha256("ACEPLACE_DEFAULT_POLICY")),
                identity_version: "v1",
                public_key: "",
                jurisdiction: canonical.jurisdiction,
                governance_profile: canonical.governance_profile,
                mission: canonical.mission,
                continuity_status: "ACTIVE",
                created_at: new Date().toISOString(),
                verified: true,
            };
        }
    }
    const emailKey = "subham@novaxquantum.com";
    const wlKey = `aceplace_whitelist/${emailKey}`;
    if (!store[wlKey]) {
        store[wlKey] = {
            email: emailKey,
            whitelisted: true,
            assignedTier: "Tier 0 Sandbox",
            status: "ACTIVE",
            createdAt: new Date().toISOString()
        };
    }
    const reqKey = `aceplace_whitelist_requests/${emailKey}`;
    if (!store[reqKey]) {
        store[reqKey] = {
            _id: "mock_subham",
            fullName: "Subham",
            company: "Nova X Quantum",
            email: emailKey,
            useCase: "Development / Testing",
            deploymentInterest: "Sandbox Runtime",
            infrastructureTier: "Tier 0 Sandbox",
            providerInterest: ["Gemini"],
            classification: "Research",
            status: "APPROVED",
            source: "local-dev-fallback",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }
}
class MockDocRef {
    col;
    id;
    db;
    constructor(col, id, db) {
        this.col = col;
        this.id = id;
        this.db = db;
    }
    async get() { return this.db._read(this.col, this.id); }
    async set(data, opts) { return this.db._write(this.col, this.id, data, opts?.merge); }
    async update(data) { return this.db._patch(this.col, this.id, data); }
    async delete() { return this.db._delete(this.col, this.id); }
    collection(subCol) { return this.db.collection(`${this.col}/${this.id}/${subCol}`); }
}
class MockQuery {
    filters = [];
    _limit = 0;
    _order = [];
    col;
    db;
    constructor(col, db) {
        this.col = col;
        this.db = db;
    }
    where(field, op, value) {
        this.filters.push({ field, op, value });
        return this;
    }
    orderBy(field, dir = "asc") {
        this._order.push({ field, dir });
        return this;
    }
    limit(n) {
        this._limit = n;
        return this;
    }
    async get() {
        let docs = this.db._query(this.col, this.filters);
        if (this._order.length > 0) {
            docs.sort((a, b) => {
                const field = this._order[0].field;
                const dir = this._order[0].dir === "asc" ? 1 : -1;
                if (a[field] < b[field])
                    return -1 * dir;
                if (a[field] > b[field])
                    return 1 * dir;
                return 0;
            });
        }
        if (this._limit > 0)
            docs = docs.slice(0, this._limit);
        return {
            empty: docs.length === 0,
            size: docs.length,
            docs: docs.map((d) => ({
                id: d._id,
                ref: new MockDocRef(this.col, d._id, this.db),
                data: () => d
            }))
        };
    }
    onSnapshot(onNext, onError) {
        this.get().then(onNext).catch(onError);
        let lastJson = "";
        const interval = setInterval(async () => {
            try {
                const snap = await this.get();
                const docsJson = JSON.stringify(snap.docs.map(d => ({ id: d.id, data: d.data() })));
                if (docsJson !== lastJson) {
                    lastJson = docsJson;
                    onNext(snap);
                }
            }
            catch (e) {
                if (onError)
                    onError(e);
            }
        }, 1000);
        return () => clearInterval(interval);
    }
}
class LocalJsonDb {
    filepath;
    constructor(filepath) {
        this.filepath = filepath || path.resolve(process.cwd(), ".aceplace-local-db.json");
    }
    _load() {
        try {
            if (!fs.existsSync(this.filepath)) {
                const initial = {};
                seedAgents(initial);
                fs.writeFileSync(this.filepath, JSON.stringify(initial, null, 2), "utf8");
                return initial;
            }
            const content = fs.readFileSync(this.filepath, "utf8");
            const store = JSON.parse(content);
            let needsSave = false;
            if (!store["agents/agent_coo"] || !store["aceplace_whitelist/subham@novaxquantum.com"]) {
                seedAgents(store);
                needsSave = true;
            }
            if (needsSave) {
                fs.writeFileSync(this.filepath, JSON.stringify(store, null, 2), "utf8");
            }
            return store;
        }
        catch (e) {
            console.error("[LocalJsonDb] Error loading:", e);
            return {};
        }
    }
    _save(data) {
        try {
            fs.writeFileSync(this.filepath, JSON.stringify(data, null, 2), "utf8");
        }
        catch (e) {
            console.error("[LocalJsonDb] Error saving:", e);
        }
    }
    _processValue(val, existing) {
        if (val && typeof val === "object" && val.type === "serverTimestamp") {
            return new Date().toISOString();
        }
        if (val && typeof val === "object" && val.type === "increment") {
            const prev = typeof existing === "number" ? existing : 0;
            return prev + (val.args || 0);
        }
        if (val && typeof val === "object" && val.type === "arrayUnion") {
            const prev = Array.isArray(existing) ? existing : [];
            const newItems = val.args || [];
            const union = [...prev];
            for (const item of newItems) {
                if (!union.includes(item))
                    union.push(item);
            }
            return union;
        }
        return val;
    }
    _processObject(obj, existingObj) {
        if (!obj || typeof obj !== "object")
            return obj;
        if (obj.type && ["serverTimestamp", "increment", "arrayUnion"].includes(obj.type)) {
            return this._processValue(obj, existingObj);
        }
        const result = Array.isArray(obj) ? [] : {};
        for (const [k, v] of Object.entries(obj)) {
            const prev = existingObj ? existingObj[k] : undefined;
            result[k] = this._processObject(v, prev);
        }
        return result;
    }
    collection(col) {
        return {
            doc: (id) => {
                const finalId = id || `auto_${Math.random().toString(36).slice(2, 12)}`;
                return new MockDocRef(col, finalId, this);
            },
            add: async (data) => {
                const id = `auto_${Math.random().toString(36).slice(2, 12)}`;
                const ref = new MockDocRef(col, id, this);
                await ref.set(data, {});
                return ref;
            },
            where: (f, o, v) => new MockQuery(col, this).where(f, o, v),
            orderBy: (f, d) => new MockQuery(col, this).orderBy(f, d),
            limit: (n) => new MockQuery(col, this).limit(n),
            get: async () => new MockQuery(col, this).get(),
            onSnapshot: (onNext, onError) => new MockQuery(col, this).onSnapshot(onNext, onError)
        };
    }
    async runTransaction(fn) {
        const tx = {
            get: async (ref) => ref.get(),
            update: (ref, data) => ref.update(data),
            set: (ref, data, opts) => ref.set(data, opts),
            delete: (ref) => ref.delete()
        };
        return fn(tx);
    }
    batch() {
        const ops = [];
        return {
            set: (ref, data, opts) => {
                ops.push(() => ref.set(data, opts));
            },
            update: (ref, data) => {
                ops.push(() => ref.update(data));
            },
            delete: (ref) => {
                ops.push(() => ref.delete());
            },
            commit: async () => {
                for (const op of ops) {
                    op();
                }
            }
        };
    }
    _read(col, id) {
        const store = this._load();
        const data = store[`${col}/${id}`];
        return {
            exists: !!data,
            id,
            data: () => data ? { ...data } : undefined
        };
    }
    _write(col, id, data, merge) {
        const store = this._load();
        const key = `${col}/${id}`;
        const existing = merge ? (store[key] || {}) : {};
        const processed = this._processObject(data, existing);
        const final = { ...existing, ...processed, _id: id };
        store[key] = final;
        this._save(store);
    }
    _patch(col, id, data) {
        const store = this._load();
        const key = `${col}/${id}`;
        const existing = store[key] || {};
        const processed = this._processObject(data, existing);
        const final = { ...existing, ...processed, _id: id };
        store[key] = final;
        this._save(store);
    }
    _delete(col, id) {
        const store = this._load();
        delete store[`${col}/${id}`];
        this._save(store);
    }
    _query(col, filters) {
        const store = this._load();
        let results = [];
        Object.entries(store).forEach(([key, val]) => {
            if (key.startsWith(`${col}/`)) {
                const remaining = key.substring(col.length + 1);
                if (!remaining.includes("/")) {
                    let match = true;
                    for (const f of filters) {
                        if (f.op === "==")
                            match = val[f.field] === f.value;
                        else if (f.op === "in")
                            match = Array.isArray(f.value) && f.value.includes(val[f.field]);
                        else if (f.op === ">=")
                            match = val[f.field] >= f.value;
                        if (!match)
                            break;
                    }
                    if (match)
                        results.push({ ...val });
                }
            }
        });
        return results;
    }
}
exports.LocalJsonDb = LocalJsonDb;
exports.FieldValue = {
    serverTimestamp: () => ({ type: "serverTimestamp" }),
    increment: (n) => ({ type: "increment", args: n }),
    arrayUnion: (...args) => ({ type: "arrayUnion", args }),
};
//# sourceMappingURL=local-json-db.js.map