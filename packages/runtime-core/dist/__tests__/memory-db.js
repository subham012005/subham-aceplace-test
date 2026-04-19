"use strict";
/**
 * Deterministic In-Memory Firestore Driver
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryDb = exports.MemoryDb = void 0;
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
    set(data, opts) { return this.db._write(this.col, this.id, data, opts?.merge); }
    update(data) { return this.db._patch(this.col, this.id, data); }
    delete() { return this.db._delete(this.col, this.id); }
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
}
class MemoryDb {
    store = new Map();
    collection(col) {
        return {
            doc: (id) => new MockDocRef(col, id, this),
            add: async (data) => {
                const id = `auto_${Math.random().toString(36).slice(2, 12)}`;
                const ref = new MockDocRef(col, id, this);
                await ref.set(data, {});
                return ref;
            },
            where: (f, o, v) => new MockQuery(col, this).where(f, o, v),
            orderBy: (f, d) => new MockQuery(col, this).orderBy(f, d),
            limit: (n) => new MockQuery(col, this).limit(n),
            get: async () => new MockQuery(col, this).get()
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
    _read(col, id) {
        const data = this.store.get(`${col}/${id}`);
        const res = {
            exists: !!data,
            id,
            data: () => data ? { ...data } : undefined
        };
        return res;
    }
    _write(col, id, data, merge) {
        const key = `${col}/${id}`;
        const existing = merge ? (this.store.get(key) || {}) : {};
        const final = { ...existing, ...data, _id: id };
        this.store.set(key, final);
    }
    _patch(col, id, data) {
        const key = `${col}/${id}`;
        const existing = this.store.get(key) || {};
        const final = { ...existing, ...data, _id: id };
        this.store.set(key, final);
    }
    _delete(col, id) {
        this.store.delete(`${col}/${id}`);
    }
    _query(col, filters) {
        let results = [];
        this.store.forEach((val, key) => {
            if (key.startsWith(`${col}/`)) {
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
        });
        return results;
    }
    reset() { this.store.clear(); }
}
exports.MemoryDb = MemoryDb;
exports.memoryDb = global.__ACEPLACE_MEMORY_DB__ || new MemoryDb();
global.__ACEPLACE_MEMORY_DB__ = exports.memoryDb;
//# sourceMappingURL=memory-db.js.map